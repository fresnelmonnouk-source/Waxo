import { fmtXof } from "@/lib/money";

// Devises d'affichage : le FCFA reste la seule vérité comptable (prix saisis, débit FedaPay, commandes).
// € et $ sont COSMÉTIQUES : on affiche « ≈ » et le paiement reste annoncé en FCFA.

export const CURRENCIES = ["XOF", "EUR", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const isCurrency = (v: unknown): v is Currency => typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);

/** Parité fixe officielle : 1 € = 655,957 FCFA. */
export const PEG_EUR_XOF = 655.957;

/** Marge de sécurité du dollar : le prix affiché est majoré, jamais minoré (le client ne doit pas être débité PLUS que vu). */
export const USD_SAFETY_MARGIN = 0.02;

/** Garde-fou : un EUR/USD hors de cette plage vient d'une source cassée → rejeté. */
export const EUR_USD_RANGE = { min: 0.8, max: 1.6 } as const;

/** Taux d'affichage : 1 F CFA = `eur` € / `usd` $ (marge déjà appliquée sur le dollar). */
export type FxRates = { eur: number; usd: number };

/** Dérive les deux taux d'affichage du seul EUR/USD de marché (l'euro est arrimé au FCFA). */
export function fxFromEurUsd(eurUsd: number): FxRates {
  return {
    eur: 1 / PEG_EUR_XOF,
    // 1 F = (eurUsd / 655,957) $ au marché ; ×(1 + marge) → le prix affiché en $ est plus haut que le réel.
    usd: (eurUsd / PEG_EUR_XOF) * (1 + USD_SAFETY_MARGIN),
  };
}

/**
 * Repli quand la base ne répond pas ou n'a jamais été remplie. Un taux périmé se trompe TOUJOURS dans un sens :
 * on choisit un EUR/USD volontairement haut (1,20) → dollar affiché plus cher que le réel.
 */
export const DEFAULT_FX: FxRates = fxFromEurUsd(1.2);

export function validEurUsd(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= EUR_USD_RANGE.min && v <= EUR_USD_RANGE.max;
}

/** Taux plausible (lu en base) : l'euro doit valoir le peg, le dollar rester dans la plage dérivée ; sinon repli. */
export function sanitizeFx(raw: { eur?: unknown; usd?: unknown } | null | undefined): FxRates {
  const eur = Number(raw?.eur);
  const usd = Number(raw?.usd);
  const okEur = Number.isFinite(eur) && Math.abs(eur * PEG_EUR_XOF - 1) < 0.001;
  const lo = fxFromEurUsd(EUR_USD_RANGE.min).usd;
  const hi = fxFromEurUsd(EUR_USD_RANGE.max).usd;
  const okUsd = Number.isFinite(usd) && usd >= lo && usd <= hi;
  return { eur: okEur ? eur : DEFAULT_FX.eur, usd: okUsd ? usd : DEFAULT_FX.usd };
}

/** Montant FCFA → montant dans la devise (entier pour le FCFA, 2 décimales pour € et $). */
export function convertXof(xof: number, currency: Currency, fx: FxRates): number {
  const n = Number.isFinite(xof) ? xof : 0;
  if (currency === "XOF") return Math.round(n);
  const raw = n * (currency === "EUR" ? fx.eur : fx.usd);
  return Math.round(raw * 100) / 100;
}

const NBSP = " ";
const NNBSP = " ";

function groupFr(n: number): string {
  return n
    .toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replace(/[\s  ]/g, NNBSP);
}

/**
 * Format d'affichage. FCFA : « 12 500 F » (identique à `fmtXof`). € / $ : préfixés de « ≈ » car indicatifs.
 * fr : « ≈ 19,05 € » / « ≈ 22,05 $ » · en : « ≈ €19.05 » / « ≈ $22.05 ».
 */
export function fmtMoney(xof: number, currency: Currency, fx: FxRates, locale: string): string {
  const n = Number.isFinite(xof) ? xof : 0;
  if (currency === "XOF") return fmtXof(n);
  const v = convertXof(n, currency, fx);
  const sym = currency === "EUR" ? "€" : "$";
  if (locale === "en") {
    return `≈${NBSP}${sym}${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `≈${NBSP}${groupFr(v)}${NBSP}${sym}`;
}
