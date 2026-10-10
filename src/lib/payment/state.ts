import { isApproved, isFailed, type FedapayTransaction } from "./transaction";

/** État de paiement montré au client sur la page de retour. Pur. */
export type PaymentState = "paid" | "pending" | "failed" | "unknown";

export type OrderPaymentView = { paid: boolean; status: string };

/**
 * @param order  ligne de commande (base)
 * @param tx     transaction relue chez FedaPay (null si indisponible)
 */
export function paymentStateFor(order: OrderPaymentView | null, tx: FedapayTransaction | null): PaymentState {
  if (!order) return "unknown";
  if (order.paid) return "paid";
  if (order.status === "annulee") return "failed";
  if (tx && isFailed(tx)) return "failed";
  if (tx && isApproved(tx)) return "pending"; // approuvée mais pas encore enregistrée : le webhook/mark_paid arrive
  return "pending";
}

/** La transaction appartient-elle bien à cette commande, pour ce montant ? (refuse un `id` d'une autre commande) */
export function transactionMatchesOrder(
  tx: FedapayTransaction,
  order: { id: string; number: string; total: number },
): boolean {
  const sameOrder = tx.orderId ? tx.orderId === order.id : tx.orderNumber === order.number;
  return sameOrder && tx.amount === order.total && (tx.currency === null || tx.currency === "XOF");
}
