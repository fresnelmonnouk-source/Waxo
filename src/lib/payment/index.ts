import "server-only";
import { loadFedapayConfig } from "./credentials";
import { FedaPayProvider } from "./fedapay";
import type { CheckoutResult, PayableOrder, PaymentProvider } from "./types";

export type { CheckoutResult, PayableOrder, PaymentProvider } from "./types";

/**
 * Provider de développement : ne débite rien, ne contacte personne ; la commande reste « en attente de paiement ».
 * Explicite : avertit dans les logs, et REFUSE de tourner en production (le client croirait payer).
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  async createCheckout(order: PayableOrder): Promise<CheckoutResult> {
    if (process.env.NODE_ENV === "production") {
      throw new Error("payment_provider_not_configured");
    }
    console.warn(`[payment] MOCK : aucun paiement lancé pour ${order.number} (aucune clé FedaPay configurée).`);
    return { pending: true };
  }
}

let mock: PaymentProvider | null = null;

/** FedaPay si une clé est configurée (espace admin ou FEDAPAY_SECRET_KEY) ; sinon le mock (dev/test uniquement — voir MockPaymentProvider). */
export async function getPaymentProvider(): Promise<PaymentProvider> {
  const cfg = await loadFedapayConfig();
  if (cfg) return new FedaPayProvider(cfg);
  if (!mock) mock = new MockPaymentProvider();
  return mock;
}
