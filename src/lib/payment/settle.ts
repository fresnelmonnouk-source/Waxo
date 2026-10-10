import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderEmail } from "@/lib/email";
import { auditSnapshot, isApproved, type FedapayTransaction } from "./transaction";

/**
 * Règlement d'une transaction FedaPay APPROUVÉE (appelé par le webhook, par la vérification au retour et par le cron).
 * Le montant et l'identité de la commande viennent de la transaction relue chez FedaPay quand une clé existe ;
 * mark_paid (SQL) compare de toute façon le montant à orders.total et reste idempotent.
 */

export type SettleResult = "paid" | "duplicate" | "not_found" | "amount_mismatch" | "order_cancelled" | "ignored" | "error";

type AdminClient = ReturnType<typeof createAdminClient>;

const MARK_PAID_RESULTS = new Set(["paid", "duplicate", "not_found", "amount_mismatch", "order_cancelled"]);

/** Retrouve l'identifiant de la commande : métadonnée UUID d'abord, sinon numéro WX-… (merchant_reference). */
export async function resolveOrderId(admin: AdminClient, tx: FedapayTransaction): Promise<string | null> {
  if (tx.orderId) return tx.orderId;
  if (!tx.orderNumber) return null;
  const { data, error } = await admin.from("orders").select("id").eq("number", tx.orderNumber).maybeSingle();
  if (error) throw new Error("order_lookup_failed");
  return (data as { id?: string } | null)?.id ?? null;
}

/**
 * @param eventId identifiant d'idempotence (ex. `transaction.approved:123`) ; le préfixe fournisseur est ajouté par mark_paid.
 * @throws si la base est injoignable : l'appelant répond alors 5xx pour que le prestataire réessaie.
 */
export async function settleApprovedTransaction(tx: FedapayTransaction, eventId: string): Promise<SettleResult> {
  if (!isApproved(tx)) return "ignored";
  if (tx.currency && tx.currency !== "XOF") return "ignored";
  const admin = createAdminClient();
  const orderId = await resolveOrderId(admin, tx);
  if (!orderId) return "not_found";

  const { data, error } = await admin.rpc("mark_paid", {
    p_order: orderId,
    p_provider: "fedapay",
    p_event_id: eventId,
    p_ref: tx.id,
    p_amount: tx.amount,
    p_raw: auditSnapshot(tx),
  });
  if (error) throw new Error("mark_paid_failed");
  const result = typeof data === "string" && MARK_PAID_RESULTS.has(data) ? (data as SettleResult) : "error";

  if (result === "paid") {
    // Non bloquant : un échec d'e-mail ne remet jamais en cause un paiement enregistré.
    await sendOrderEmail(orderId, "paid").catch(() => undefined);
  } else if (result === "amount_mismatch" || result === "order_cancelled") {
    // Cas à traiter à la main (remboursement / écart) : visible dans les logs, sans donnée personnelle.
    console.error(`[payment] ${result} order=${orderId} tx=${tx.id}`);
  }
  return result;
}
