import type { PayMethod } from "@/lib/checkout/shipping";

/**
 * Abstraction du paiement en ligne (carte, MTN MoMo, Moov Money, Celtiis Cash).
 * Le paiement à la livraison (`cod`) ne passe PAS par ici : la commande est confirmée directement.
 */

export type PayableOrder = {
  orderId: string;
  /** Numéro public « WX-… ». */
  number: string;
  /** Total OFFICIEL (renvoyé par place_order), en XOF entier. */
  total: number;
  method: Exclude<PayMethod, "cod">;
  customer: { name: string; phone: string; email: string | null };
  /** Numéro Mobile Money à débiter (momo/moov/celtiis), au format national normalisé. */
  payerPhone: string | null;
  lang: "fr" | "en";
};

export type CheckoutResult =
  /** Le client doit être redirigé vers la page de paiement sécurisée du prestataire. */
  | { redirectUrl: string }
  /** Paiement lancé sans redirection (ex. validation sur le téléphone) : la confirmation arrivera par webhook. */
  | { pending: true };

export interface PaymentProvider {
  readonly name: string;
  createCheckout(order: PayableOrder): Promise<CheckoutResult>;
}
