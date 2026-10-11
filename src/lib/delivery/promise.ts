// Promesse de livraison « selon l'heure » (décision du 2026-10-11, direction Vincent docs/design/livraison-express-2026-10-11.md).
// Règle RÉELLE : Cotonou & Calavi = le jour même pour une commande avant l'heure limite (20 h), sinon le lendemain, 7 j/7 ;
// autres villes = 48 à 72 h. Heure de référence : Bénin (UTC+1 fixe). Module PUR (client + serveur), testé.

const WAT_OFFSET_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Heure limite par défaut si le réglage manque (l'admin la règle dans Réglages → Livraison). */
export const DEFAULT_CUTOFF = 20;

export type DeliveryState =
  /** Avant l'heure limite : livré aujourd'hui (Cotonou & Calavi). */
  | "today"
  /** Après l'heure limite : livré demain. */
  | "tomorrow"
  /** Après l'heure limite un samedi : livré demain, dimanche. */
  | "tomorrowSunday"
  /** Rendu serveur / avant hydratation : phrase vraie à toute heure. */
  | "neutral";

function benin(ms: number): { day: number; hour: number; weekday: number } {
  const shifted = ms + WAT_OFFSET_MS;
  const day = Math.floor(shifted / DAY_MS);
  return { day, hour: Math.floor((shifted % DAY_MS) / 3_600_000), weekday: (((day + 4) % 7) + 7) % 7 }; // 0 = dimanche
}

/** État de la promesse à l'instant `now` (heure du Bénin). */
export function deliveryState(now: number, cutoff = DEFAULT_CUTOFF): Exclude<DeliveryState, "neutral"> {
  const b = benin(now);
  if (b.hour < cutoff) return "today";
  return b.weekday === 6 ? "tomorrowSunday" : "tomorrow";
}

/** Heure limite valide (1-23), sinon la valeur par défaut. */
export function safeCutoff(v: unknown): number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 23 ? v : DEFAULT_CUTOFF;
}

/** Fenêtre « autres villes » : du J+2 au J+3 (heure du Bénin), en dates calendaires UTC midi pour un affichage stable. */
export function otherCitiesWindow(now: number): { from: Date; to: Date } {
  const d = benin(now).day;
  return { from: new Date((d + 2) * DAY_MS + 12 * 3_600_000), to: new Date((d + 3) * DAY_MS + 12 * 3_600_000) };
}
