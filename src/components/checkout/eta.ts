// Estimations de livraison du tunnel et de la confirmation (direction docs/design/livraison-express-2026-10-11.md, section 6).
// Module PUR (pas de React, pas d'horloge implicite) : l'instant est toujours passé en argument, testé dans
// tests/checkout-express.test.ts. Heure de référence : Bénin (Africa/Porto-Novo), jamais le fuseau du téléphone.

import { deliveryState, otherCitiesWindow, safeCutoff } from "@/lib/delivery/promise";
import { beninHour, cotonouDelayDays } from "@/lib/email/delivery";

export const BENIN_TZ = "Africa/Porto-Novo";

export type Eta =
  /** Cotonou & Calavi, avant l'heure limite. */
  | { kind: "today" }
  /** Cotonou & Calavi, après l'heure limite. */
  | { kind: "tomorrow" }
  /** Cotonou & Calavi, après l'heure limite un samedi : livré demain, dimanche. */
  | { kind: "tomorrowSunday" }
  /** Paiement à la livraison, Cotonou & Calavi : le délai démarre à la confirmation WhatsApp. */
  | { kind: "codCotonou" }
  /** Paiement à la livraison, autres villes : 48 à 72 h après la confirmation WhatsApp. */
  | { kind: "codOther" }
  /** Autres villes : dates réelles J+2 à J+3. */
  | { kind: "range"; from: Date; to: Date };

type Zone = "cotonou" | "autre" | string;

function cotonouEta(at: number, cutoff: number): Eta {
  const c = safeCutoff(cutoff);
  if (cotonouDelayDays(beninHour(at), c) === 0) return { kind: "today" };
  return deliveryState(at, c) === "tomorrowSunday" ? { kind: "tomorrowSunday" } : { kind: "tomorrow" };
}

/** Ligne d'estimation du tunnel (étape livraison), selon la zone choisie et l'heure du Bénin à `now`. */
export function checkoutEta(now: number, zone: Zone, cutoff: number): Eta {
  if (zone === "cotonou") return cotonouEta(now, cutoff);
  const w = otherCitiesWindow(now);
  return { kind: "range", from: w.from, to: w.to };
}

/** Estimation de la page de confirmation, calculée à partir de l'heure de la commande (`placedAt`). */
export function confirmationEta(args: { zone: Zone; pay: string; placedAt: number | undefined; cutoff: number }): Eta {
  const cotonou = args.zone === "cotonou";
  if (args.pay === "cod") return cotonou ? { kind: "codCotonou" } : { kind: "codOther" };
  const at = typeof args.placedAt === "number" && Number.isFinite(args.placedAt) && args.placedAt > 0 ? args.placedAt : Date.now();
  return checkoutEta(at, cotonou ? "cotonou" : "autre", args.cutoff);
}

function parts(d: Date, locale: string) {
  const fmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    timeZone: BENIN_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const get = (type: string) => fmt.formatToParts(d).find((p) => p.type === type)?.value ?? "";
  return { weekday: get("weekday"), day: get("day"), month: get("month") };
}

/**
 * Bornes de la fenêtre « autres villes » prêtes à insérer dans « entre le {from} et le {to} » :
 * FR « mardi 14 » / « jeudi 16 octobre » (mois répété si les deux dates changent de mois, « 1er » pour le premier du mois),
 * EN « Tuesday 14 » / « Thursday 16 October ».
 */
export function formatRange(from: Date, to: Date, locale: string): { from: string; to: string } {
  const a = parts(from, locale);
  const b = parts(to, locale);
  const day = (d: string) => (locale !== "en" && d === "1" ? "1er" : d);
  const one = (p: typeof a, withMonth: boolean) => `${p.weekday} ${day(p.day)}${withMonth ? ` ${p.month}` : ""}`;
  return { from: one(a, a.month !== b.month), to: one(b, true) };
}
