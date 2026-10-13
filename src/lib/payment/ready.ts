import "server-only";
import { loadFedapayConfig } from "./credentials";
import { paymentModeBlocked } from "./mode";

/**
 * Le paiement en ligne peut-il être lancé ? Sert à /api/checkout/config et à la page /commande pour masquer
 * Mobile Money et carte quand la clé FedaPay est une clé d'essai refusée en production (audit C1), ou qu'aucun
 * prestataire n'est configuré en production. Ne lève jamais.
 */
export async function onlinePaymentReady(): Promise<boolean> {
  try {
    const cfg = await loadFedapayConfig();
    if (cfg) return !paymentModeBlocked(cfg.env);
    return process.env.NODE_ENV !== "production"; // mock : développement seulement
  } catch {
    return false;
  }
}
