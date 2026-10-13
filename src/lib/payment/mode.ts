// Garde « mode essai » (audit Raphaël C1) : en production, une configuration FedaPay sandbox ne doit JAMAIS encaisser
// (les numéros de test publics « paient » sans argent réel). Pur : testable sans réseau ni base.

import type { FedapayEnv } from "./config";

type Env = Record<string, string | undefined>;

/**
 * Sommes-nous en production ?
 *  - sur Vercel, VERCEL_ENV fait foi : « production » seulement (les previews de branche restent des essais) ;
 *  - hors Vercel (VERCEL_ENV absent), NODE_ENV=production est traité comme la production : en cas de doute, on ferme.
 */
export function isProductionRuntime(source: Env = process.env): boolean {
  const vercel = source.VERCEL_ENV?.trim().toLowerCase();
  if (vercel) return vercel === "production";
  return source.NODE_ENV === "production";
}

/** Dérogation explicite (ex. recette en prod avant le passage aux clés live) : ALLOW_SANDBOX_PAYMENTS=1. */
export function sandboxAllowed(source: Env = process.env): boolean {
  return source.ALLOW_SANDBOX_PAYMENTS?.trim() === "1";
}

/**
 * Un paiement dans ce mode doit-il être refusé ? Mode inconnu (aucune clé pour relire la transaction) = traité comme
 * un essai : en production, seul un mode « live » établi peut marquer une commande payée.
 */
export function paymentModeBlocked(mode: FedapayEnv | null | undefined, source: Env = process.env): boolean {
  if (mode === "live") return false;
  return isProductionRuntime(source) && !sandboxAllowed(source);
}
