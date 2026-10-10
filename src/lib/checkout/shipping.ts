// Calculs de livraison et moyens de paiement (purs). Le serveur (fonction SQL place_order) reste l'autorité :
// ces fonctions servent à AFFICHER une estimation et reproduisent exactement sa règle.

export const ZONES = ["cotonou", "autre"] as const;
export const PAY_METHODS = ["momo", "moov", "celtiis", "carte", "cod"] as const;
export type Zone = (typeof ZONES)[number];
export type PayMethod = (typeof PAY_METHODS)[number];

export type ShippingConfig = { cotonou: number; autre: number; freeFrom: number; cutoff: number; returnDays: number };
export type PayConfig = Record<PayMethod, boolean>;

/** Valeurs de repli (mêmes que DEFAULT_SETTINGS du catalogue, qui est « server-only »). */
export const DEFAULT_SHIPPING: ShippingConfig = { cotonou: 1000, autre: 2500, freeFrom: 15000, cutoff: 18, returnDays: 7 };
export const DEFAULT_PAY: PayConfig = { momo: true, moov: true, celtiis: true, carte: true, cod: true };

/** Mobile Money : demande un numéro à valider sur le téléphone. */
export const isMobileMoney = (m: PayMethod): boolean => m === "momo" || m === "moov" || m === "celtiis";

/**
 * Frais de livraison — règle de place_order (et de la maquette) : franco SEULEMENT à Cotonou & Calavi dès `freeFrom` ; ailleurs, tarif de la zone.
 * `freeFrom` ≤ 0 désactive le franco.
 */
export function shippingFee(subtotal: number, zone: Zone, cfg: ShippingConfig): number {
  if (zone === "cotonou") return cfg.freeFrom > 0 && subtotal >= cfg.freeFrom ? 0 : cfg.cotonou;
  return cfg.autre;
}

/** Montant restant avant la livraison offerte (0 si franco atteint ou désactivé). */
/** Le franco existe-t-il ? (`freeFrom` ≤ 0 le désactive : ne pas afficher « livraison offerte dès 0 F » — QA-6). */
export const freeShippingEnabled = (cfg: Pick<ShippingConfig, "freeFrom">): boolean => cfg.freeFrom > 0;

export function freeShippingRemaining(subtotal: number, cfg: ShippingConfig): number {
  if (cfg.freeFrom <= 0) return 0;
  return Math.max(0, cfg.freeFrom - subtotal);
}

/** Pourcentage (0-100, entier) de la barre de progression vers le franco. */
export function freeShippingPercent(subtotal: number, cfg: ShippingConfig): number {
  return Math.min(100, Math.round((subtotal / Math.max(1, cfg.freeFrom)) * 100));
}

/** Moyens de paiement actifs, dans l'ordre d'affichage de la maquette. */
export function enabledPayMethods(pay: Partial<PayConfig> | null | undefined): PayMethod[] {
  return PAY_METHODS.filter((m) => !pay || pay[m] !== false);
}

export function clampQty(qty: number, stock: number | null): number {
  const max = stock === null ? 99 : Math.max(0, Math.min(99, stock));
  return Math.max(0, Math.min(Math.floor(qty) || 0, max));
}
