// Garde-fous purs de POST /api/checkout (hors schéma Zod partagé) : délai anti-robot tolérant à l'horloge du client,
// plafonds de quantité, clé d'idempotence. Aucun accès réseau/base : testable seul.

export const MIN_SUBMIT_DELAY_MS = 2500;
/** Quantité maximale d'un même article, et nombre total d'unités par commande passée en ligne (anti-vidage de stock). */
export const MAX_QTY_PER_LINE = 10;
export const MAX_UNITS_PER_ORDER = 20;

export type TimingVerdict = "ok" | "bot" | "too_fast";

/**
 * Honeypot + délai minimal. L'horloge du téléphone n'est JAMAIS comparée à celle du serveur pour rejeter :
 *  - `elapsed` (ms écoulées depuis l'affichage, mesurées côté client sur UNE seule horloge) est prioritaire ;
 *  - à défaut, `t` (Date.now() client) : seul un envoi manifestement trop rapide (0 ≤ now − t < délai) est refusé ;
 *    une horloge en avance ou en retard ne peut pas être jugée, on laisse passer (le vrai frein est ailleurs).
 */
export function submitTiming(
  input: { website?: unknown; t?: unknown; elapsed?: unknown },
  now: number = Date.now(),
): TimingVerdict {
  if (typeof input.website === "string" && input.website.trim() !== "") return "bot";
  if (typeof input.elapsed === "number" && Number.isFinite(input.elapsed)) {
    return input.elapsed < MIN_SUBMIT_DELAY_MS ? "too_fast" : "ok";
  }
  if (typeof input.t === "number" && Number.isFinite(input.t)) {
    const delta = now - input.t;
    return delta >= 0 && delta < MIN_SUBMIT_DELAY_MS ? "too_fast" : "ok";
  }
  return "bot";
}

export type CartItem = { kind: "product" | "pack"; id: string; qty: number };

/** Quantités cumulées par article (un même id répété compte ensemble) ; true si les plafonds sont respectés. */
export function withinQuantityCaps(items: readonly CartItem[]): boolean {
  const perKey = new Map<string, number>();
  let units = 0;
  for (const it of items) {
    const key = `${it.kind}:${it.id.toLowerCase()}`;
    const next = (perKey.get(key) ?? 0) + it.qty;
    if (next > MAX_QTY_PER_LINE) return false;
    perKey.set(key, next);
    units += it.qty;
  }
  return units <= MAX_UNITS_PER_ORDER;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Clé d'idempotence fournie par le navigateur (UUID) ; null si absente ou invalide. */
export function parseIdemKey(v: unknown): string | null {
  return typeof v === "string" && UUID.test(v) ? v.toLowerCase() : null;
}

/** Codes des garde-fous de POST /api/checkout (hors erreurs de commande de lib/checkout/errors.ts). */
export type GuardCode = "too_fast" | "quantity_limit" | "captcha" | "online_unavailable";

export const GUARD_STATUS: Record<GuardCode, number> = { too_fast: 400, quantity_limit: 422, captcha: 403, online_unavailable: 503 };

/**
 * Le prestataire renvoyé par getPaymentProvider peut-il lancer un paiement ? Non pour le provider « unavailable »
 * (clé d'essai refusée en production, audit C1) et pour le mock en production. Vérifié AVANT de créer la commande.
 */
export function providerUsable(name: string, nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  if (name === "unavailable") return false;
  if (name === "mock" && nodeEnv === "production") return false;
  return true;
}

export const GUARD_MESSAGES = {
  fr: {
    captcha: "La vérification anti-robot n'a pas abouti. Cochez à nouveau la case puis validez.",
    online_unavailable:
      "Le paiement en ligne est momentanément indisponible. Choisissez le paiement à la livraison ou écrivez-nous sur WhatsApp. Aucune commande n'a été créée.",
    too_fast: "Un instant, nous vérifions votre envoi. Réessayez dans quelques secondes.",
    quantity_limit:
      "Pour que chacun puisse commander, une commande est limitée à 10 exemplaires par article et 20 articles au total. Pour une commande plus importante, écrivez-nous sur WhatsApp.",
  },
  en: {
    captcha: "The anti-robot check did not go through. Tick the box again, then confirm.",
    online_unavailable:
      "Online payment is temporarily unavailable. Choose cash on delivery or message us on WhatsApp. No order was created.",
    too_fast: "One moment, we are checking your submission. Please try again in a few seconds.",
    quantity_limit:
      "So that everyone can order, an order is limited to 10 units per item and 20 items in total. For a larger order, message us on WhatsApp.",
  },
} as const;
