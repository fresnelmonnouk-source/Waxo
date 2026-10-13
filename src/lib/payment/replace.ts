import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadFedapayConfig, loadStatusTokenSource } from "./credentials";
import { fetchTransaction } from "./fedapay";
import { reportMoneyError } from "./observe";
import { settleApprovedTransaction } from "./settle";
import { verifyOrderStatusToken } from "./token";
import { isApproved } from "./transaction";

/**
 * Paiement en ligne échoué puis « Réessayer » / « Payer à la livraison » (audit Mia 9) : la nouvelle commande REMPLACE
 * l'ancienne, dont le stock est libéré tout de suite (sinon le dernier exemplaire resterait bloqué jusqu'à l'expiration).
 *
 * Garde-fous :
 *  - le jeton HMAC du retour de paiement (`k`) prouve que le client est bien celui de cette commande ;
 *  - seule une commande en ligne, non payée, encore « nouvelle » est annulée ;
 *  - les transactions FedaPay en attente sont relues avant : une transaction approuvée entre-temps est RÉGLÉE, jamais annulée.
 * Ne jette jamais : en cas de doute, rien n'est annulé (l'expiration fera le travail).
 */

const NUMBER = /^WX-\d{1,12}$/;
const TOKEN = /^[0-9a-f]{16,64}$/;

export type ReplaceRef = { number: string; token: string };

/** Lecture défensive de `replaces` dans le corps de la commande. */
export function parseReplaceRef(v: unknown): ReplaceRef | null {
  const r = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  const number = typeof r?.n === "string" ? r.n : "";
  const token = typeof r?.k === "string" ? r.k : "";
  return NUMBER.test(number) && TOKEN.test(token) ? { number, token } : null;
}

type AdminClient = ReturnType<typeof createAdminClient>;
type Row = { id: string; pay: string; paid: boolean; status: string };

export async function releaseReplacedOrder(admin: AdminClient, ref: ReplaceRef): Promise<"cancelled" | "skipped"> {
  try {
    if (!verifyOrderStatusToken(ref.number, ref.token, await loadStatusTokenSource())) return "skipped";
    const { data, error } = await admin.from("orders").select("id,pay,paid,status").eq("number", ref.number).maybeSingle();
    const order = data as Row | null;
    if (error || !order || order.paid || order.status !== "nouvelle" || order.pay === "cod") return "skipped";

    // Une transaction approuvée (webhook en retard) : on règle et on n'annule pas.
    const cfg = await loadFedapayConfig();
    if (cfg) {
      const { data: pendings } = await admin
        .from("payments")
        .select("provider_ref")
        .eq("order_id", order.id)
        .eq("provider", "fedapay")
        .eq("status", "pending")
        .limit(3);
      for (const p of (pendings ?? []) as { provider_ref: string | null }[]) {
        if (!p.provider_ref) continue;
        const tx = await fetchTransaction(p.provider_ref, cfg);
        if (tx && isApproved(tx) && tx.orderId === order.id) {
          await settleApprovedTransaction(tx, `replace:${tx.id}`, cfg.env);
          return "skipped";
        }
      }
    }

    const { data: done, error: cancelError } = await admin.rpc("cancel_order", { p_order: order.id });
    if (cancelError) return "skipped";
    return done === true ? "cancelled" : "skipped";
  } catch (e) {
    reportMoneyError("checkout-replace", e);
    return "skipped";
  }
}
