"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { assertAdmin } from "@/lib/admin/guard";
import { sendOrderEmail } from "@/lib/email";
import { DB_ERROR, UNAVAILABLE, adminDb, withTimeout } from "@/lib/orders/db";
import { STATUS_META, planTransition } from "@/lib/orders/status";
import type { ActionResult, OrderEmailEvent, OrderStatus, PayMethod } from "@/lib/orders/types";
import {
  assignCourierSchema,
  codVerifiedSchema,
  firstIssue,
  orderIdSchema,
  setStatusSchema,
} from "@/lib/orders/validation";

// Server actions du back-office « commandes ». Chacune : assertAdmin() d'abord, entrée validée par Zod,
// écriture via service_role, jamais d'erreur SQL brute côté client.

const FORBIDDEN = { ok: false as const, code: "forbidden", message: "Session expirée ou accès refusé : reconnectez-vous." };
const NOT_FOUND = { ok: false as const, code: "not_found", message: "Commande introuvable." };
const CHANGED = {
  ok: false as const,
  code: "conflict",
  message: "Cette commande vient d'être modifiée ailleurs. Rechargez la page puis réessayez.",
};

type OrderRow = {
  id: string;
  number: string;
  status: OrderStatus;
  pay: PayMethod;
  paid: boolean;
  courier_id: string | null;
};
const ROW_COLS = "id,number,status,pay,paid,courier_id";

function refresh() {
  revalidatePath("/admin/commandes");
  revalidatePath("/admin/livraisons");
  revalidatePath("/admin/clients");
  revalidatePath("/admin");
}

/** E-mail client NON bloquant : un échec d'envoi ne remet jamais en cause le changement de statut. */
function notify(orderId: string, kind: OrderEmailEvent) {
  const send = async () => {
    try {
      await sendOrderEmail(orderId, kind);
    } catch {
      /* l'envoi ne doit jamais faire échouer l'action */
    }
  };
  try {
    after(send);
  } catch {
    void send();
  }
}

async function loadRow(orderId: string): Promise<OrderRow | null> {
  const db = adminDb();
  if (!db) return null;
  const { data, error } = await withTimeout(db.from("orders").select(ROW_COLS).eq("id", orderId).maybeSingle());
  if (error || !data) return null;
  return data as unknown as OrderRow;
}

/**
 * Change le statut d'une commande dans le flux nouvelle → préparation → livraison → livrée, ou l'annule
 * (fonction SQL `cancel_order` : restitue le stock). Transitions invalides refusées ici, côté serveur.
 */
export async function setOrderStatusAction(
  input: unknown,
): Promise<ActionResult<{ status: OrderStatus; message: string; warning?: string }>> {
  if (!(await assertAdmin())) return FORBIDDEN;
  const parsed = setStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", message: firstIssue(parsed.error) };
  const { orderId, to, courierId } = parsed.data;
  const db = adminDb();
  if (!db) return UNAVAILABLE;

  try {
    const row = await loadRow(orderId);
    if (!row) return NOT_FOUND;
    const plan = planTransition(
      { status: row.status, pay: row.pay, paid: row.paid, courierId: row.courier_id },
      to,
      { courierId: courierId ?? undefined },
    );
    if (!plan.ok) return plan;

    if (plan.cancel) {
      const { data, error } = await withTimeout(db.rpc("cancel_order", { p_order: orderId }));
      if (error) return DB_ERROR;
      if (data !== true) return { ok: false, code: "not_cancellable", message: "Annulation impossible : la commande est déjà livrée ou annulée." };
    } else {
      const chosen = typeof plan.patch.courier_id === "string" ? plan.patch.courier_id : null;
      if (chosen) {
        const { data: courier } = await withTimeout(
          db.from("couriers").select("id,active").eq("id", chosen).maybeSingle(),
        );
        if (!courier || courier.active !== true) {
          return { ok: false, code: "courier_inactive", message: "Ce livreur est introuvable ou en pause." };
        }
      }
      // Garde optimiste : on n'écrit que si le statut n'a pas bougé depuis la lecture.
      const { data, error } = await withTimeout(
        db.from("orders").update(plan.patch).eq("id", orderId).eq("status", row.status).select("id"),
      );
      if (error) return DB_ERROR;
      if (!data || data.length === 0) return CHANGED;
    }

    if (plan.email) notify(orderId, plan.email);
    refresh();
    return {
      ok: true,
      status: to,
      message: `${row.number} : ${STATUS_META[to].label}${plan.cancel ? ", articles remis en stock" : ""}`,
      ...(plan.cancel && row.paid
        ? { warning: "Cette commande était déjà payée : pensez à rembourser le client." }
        : {}),
    };
  } catch {
    return DB_ERROR;
  }
}

/** Assigne (ou retire) le livreur d'une commande non terminée. */
export async function assignCourierAction(input: unknown): Promise<ActionResult<{ message: string }>> {
  if (!(await assertAdmin())) return FORBIDDEN;
  const parsed = assignCourierSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", message: firstIssue(parsed.error) };
  const { orderId, courierId } = parsed.data;
  const db = adminDb();
  if (!db) return UNAVAILABLE;
  try {
    const row = await loadRow(orderId);
    if (!row) return NOT_FOUND;
    if (row.status === "livree" || row.status === "annulee") {
      return { ok: false, code: "closed", message: "Cette commande est terminée : le livreur ne peut plus changer." };
    }
    if (row.status === "livraison" && !courierId) {
      return { ok: false, code: "courier_required", message: "Une commande en livraison doit avoir un livreur." };
    }
    if (courierId) {
      const { data: courier } = await withTimeout(db.from("couriers").select("id,active").eq("id", courierId).maybeSingle());
      if (!courier || courier.active !== true) {
        return { ok: false, code: "courier_inactive", message: "Ce livreur est introuvable ou en pause." };
      }
    }
    const { data, error } = await withTimeout(
      db.from("orders").update({ courier_id: courierId }).eq("id", orderId).eq("status", row.status).select("id"),
    );
    if (error) return DB_ERROR;
    if (!data || data.length === 0) return CHANGED;
    refresh();
    return { ok: true, message: courierId ? `${row.number} : livreur assigné` : `${row.number} : livreur retiré` };
  } catch {
    return DB_ERROR;
  }
}

/** Marque une commande payée (ex. Mobile Money vérifié à la main). Idempotent. */
export async function markPaidAction(input: unknown): Promise<ActionResult<{ message: string }>> {
  if (!(await assertAdmin())) return FORBIDDEN;
  const parsed = orderIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", message: firstIssue(parsed.error) };
  const db = adminDb();
  if (!db) return UNAVAILABLE;
  try {
    const row = await loadRow(parsed.data.orderId);
    if (!row) return NOT_FOUND;
    if (row.status === "annulee") return { ok: false, code: "cancelled", message: "Commande annulée : elle ne peut pas être marquée payée." };
    if (row.paid) return { ok: true, message: `${row.number} : déjà payée` };
    const { data, error } = await withTimeout(
      db
        .from("orders")
        .update({ paid: true, paid_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("paid", false)
        .neq("status", "annulee")
        .select("id"),
    );
    if (error) return DB_ERROR;
    if (!data || data.length === 0) return CHANGED;
    refresh();
    return { ok: true, message: `${row.number} : marquée payée` };
  } catch {
    return DB_ERROR;
  }
}

/** « Encaissement vérifié » : l'argent du paiement à la livraison a bien été remis par le livreur. */
export async function setCodVerifiedAction(input: unknown): Promise<ActionResult<{ message: string }>> {
  if (!(await assertAdmin())) return FORBIDDEN;
  const parsed = codVerifiedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", message: firstIssue(parsed.error) };
  const db = adminDb();
  if (!db) return UNAVAILABLE;
  try {
    const row = await loadRow(parsed.data.orderId);
    if (!row) return NOT_FOUND;
    if (row.pay !== "cod") return { ok: false, code: "not_cod", message: "Cette commande n'est pas en paiement à la livraison." };
    if (!row.paid) return { ok: false, code: "unpaid", message: "Marquez d'abord la commande payée (argent encaissé)." };
    const { error } = await withTimeout(
      db.from("orders").update({ cod_verified: parsed.data.verified }).eq("id", row.id),
    );
    if (error) return DB_ERROR;
    refresh();
    return { ok: true, message: parsed.data.verified ? `${row.number} : encaissement vérifié` : `${row.number} : vérification retirée` };
  } catch {
    return DB_ERROR;
  }
}
