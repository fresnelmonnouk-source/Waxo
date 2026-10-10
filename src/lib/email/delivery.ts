import type { EmailLocale } from "./copy";

/**
 * Expression « Livraison prévue : … » calculée côté SERVEUR (jamais l'horloge du client), en heure du Bénin (UTC+1, sans
 * changement d'heure). Règles de la boutique : Cotonou & Calavi = lendemain pour une commande avant l'heure limite, sinon
 * ~48 h ; autres villes = 48 à 72 h ; pas de livraison le dimanche. ≤ 25 caractères (contrainte du gabarit).
 */

const WAT_OFFSET_H = 1;
const DAY_MS = 86_400_000;

const WORDS: Record<EmailLocale, { today: string; tomorrow: string; h48: string; h4872: string }> = {
  fr: { today: "aujourd'hui", tomorrow: "demain", h48: "sous 48 h", h4872: "sous 48 à 72 h" },
  en: { today: "today", tomorrow: "tomorrow", h48: "within 48 hours", h4872: "within 48 to 72 hours" },
};

/** Jour calendaire local (nombre de jours depuis l'époque) et heure locale d'un instant UTC. */
function local(ms: number): { day: number; hour: number } {
  const shifted = ms + WAT_OFFSET_H * 3_600_000;
  return { day: Math.floor(shifted / DAY_MS), hour: Math.floor((shifted % DAY_MS) / 3_600_000) };
}

/** 0 = dimanche (le 1er janvier 1970 était un jeudi). */
const weekday = (day: number): number => (((day + 4) % 7) + 7) % 7;

function skipSunday(day: number): number {
  return weekday(day) === 0 ? day + 1 : day;
}

export function deliveryExpression(args: {
  zone: "cotonou" | "autre" | string;
  createdAt: string | number | Date;
  now?: number;
  cutoff: number;
  locale: EmailLocale;
}): string {
  const w = WORDS[args.locale];
  const created = new Date(args.createdAt).getTime();
  const now = args.now ?? Date.now();
  if (!Number.isFinite(created)) return args.zone === "cotonou" ? w.tomorrow : w.h4872;

  const c = local(created);
  const today = local(now).day;
  const cotonou = args.zone === "cotonou";
  const target = skipSunday(c.day + (cotonou ? (c.hour < args.cutoff ? 1 : 2) : 3));
  const diff = target - today;

  if (diff <= 0) return w.today;
  if (diff === 1) return w.tomorrow;
  return cotonou ? w.h48 : w.h4872;
}
