import type { EmailLocale } from "./copy";

/**
 * Expression « Livraison prévue : … » calculée côté SERVEUR (jamais l'horloge du client), en heure du Bénin (UTC+1, sans
 * changement d'heure). Règles de la boutique (décision du 2026-10-11) : Cotonou & Calavi = LE JOUR MÊME pour une commande
 * avant l'heure limite, sinon le lendemain, 7 j/7 (dimanche compris) ; autres villes = 48 à 72 h. Paiement à la
 * livraison : le délai court à partir de la confirmation WhatsApp → « dès la confirmation » tant qu'elle n'a pas eu lieu.
 * ≤ 25 caractères (contrainte du gabarit).
 */

const WAT_OFFSET_H = 1;
const DAY_MS = 86_400_000;

const WORDS: Record<EmailLocale, { today: string; tomorrow: string; h48: string; h4872: string; onConfirm: string }> = {
  fr: { today: "aujourd'hui", tomorrow: "demain", h48: "sous 48 h", h4872: "sous 48 à 72 h", onConfirm: "dès la confirmation" },
  en: { today: "today", tomorrow: "tomorrow", h48: "within 48 hours", h4872: "within 48 to 72 hours", onConfirm: "once confirmed" },
};

/** Jour calendaire local (nombre de jours depuis l'époque) et heure locale d'un instant UTC. */
function local(ms: number): { day: number; hour: number } {
  const shifted = ms + WAT_OFFSET_H * 3_600_000;
  return { day: Math.floor(shifted / DAY_MS), hour: Math.floor((shifted % DAY_MS) / 3_600_000) };
}

/** Heure du Bénin (0-23) d'un instant : pour les écrans qui ne doivent pas dépendre du fuseau du téléphone. */
export function beninHour(ms: number): number {
  return local(ms).hour;
}

/** Délai en jours pour Cotonou & Calavi : 0 = le jour même (avant l'heure limite), 1 = le lendemain. */
export function cotonouDelayDays(hour: number, cutoff: number): 0 | 1 {
  return hour < cutoff ? 0 : 1;
}

export function deliveryExpression(args: {
  zone: "cotonou" | "autre" | string;
  createdAt: string | number | Date;
  now?: number;
  cutoff: number;
  locale: EmailLocale;
  /** Paiement à la livraison pas encore confirmé sur WhatsApp : le délai n'a pas commencé. */
  awaitingConfirmation?: boolean;
}): string {
  const w = WORDS[args.locale];
  const cotonou = args.zone === "cotonou";
  if (cotonou && args.awaitingConfirmation) return w.onConfirm;
  const created = new Date(args.createdAt).getTime();
  const now = args.now ?? Date.now();
  if (!Number.isFinite(created)) return cotonou ? w.today : w.h4872;
  const c = local(created);
  const today = local(now).day;
  const target = c.day + (cotonou ? cotonouDelayDays(c.hour, args.cutoff) : 3);
  const diff = target - today;
  if (diff <= 0) return w.today;
  if (diff === 1) return w.tomorrow;
  return cotonou ? w.h48 : w.h4872;
}
