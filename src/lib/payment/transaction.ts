// Lecture défensive d'une transaction FedaPay (webhook ou API). Pur : aucune entrée/sortie.

export type FedapayTransaction = {
  id: string;
  /** approved | pending | declined | canceled | refunded | transferred | expired… (minuscules). */
  status: string;
  amount: number;
  currency: string | null;
  /** merchant_reference : on y met le numéro de commande WX-… */
  reference: string | null;
  orderId: string | null;
  orderNumber: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER_NUMBER = /^WX-\d{1,12}$/;

const rec = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/**
 * Accepte l'entité nue, l'enveloppe d'API `{ "v1/transaction": {...} }` / `{ transaction: {...} }`.
 * Renvoie null si l'identifiant, le statut ou le montant sont inexploitables.
 */
export function parseTransaction(raw: unknown): FedapayTransaction | null {
  const top = rec(raw);
  if (!top) return null;
  const e = rec(top["v1/transaction"]) ?? rec(top.transaction) ?? top;

  const idRaw = e.id;
  const id = typeof idRaw === "number" && Number.isInteger(idRaw) ? String(idRaw) : typeof idRaw === "string" ? idRaw.trim() : "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;

  const status = typeof e.status === "string" ? e.status.trim().toLowerCase() : "";
  if (!status) return null;

  const amountRaw = e.amount;
  const amount = typeof amountRaw === "number" ? amountRaw : typeof amountRaw === "string" ? Number(amountRaw) : NaN;
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < 0) return null;

  const cur = rec(e.currency);
  const currency =
    typeof cur?.iso === "string" ? cur.iso.toUpperCase() : typeof e.currency === "string" ? e.currency.toUpperCase() : null;

  const reference = typeof e.merchant_reference === "string" ? e.merchant_reference.trim().slice(0, 64) : null;
  const meta = rec(e.custom_metadata);
  const metaOrderId = typeof meta?.order_id === "string" && UUID.test(meta.order_id) ? meta.order_id : null;
  const metaNumber = typeof meta?.order_number === "string" && ORDER_NUMBER.test(meta.order_number) ? meta.order_number : null;
  const orderNumber = metaNumber ?? (reference && ORDER_NUMBER.test(reference) ? reference : null);

  return { id, status, amount, currency, reference, orderId: metaOrderId, orderNumber };
}

export const isApproved = (tx: FedapayTransaction): boolean => tx.status === "approved" || tx.status === "transferred";

export const isFailed = (tx: FedapayTransaction): boolean =>
  tx.status === "declined" || tx.status === "canceled" || tx.status === "cancelled" || tx.status === "expired";

/** Sous-ensemble sans donnée personnelle, conservé dans payments.raw pour audit. */
export function auditSnapshot(tx: FedapayTransaction): Record<string, unknown> {
  return { id: tx.id, status: tx.status, amount: tx.amount, currency: tx.currency, reference: tx.reference };
}
