import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fxFromEurUsd, validEurUsd, type FxRates } from "./core";

/**
 * Rafraîchit fx_rates (table lue par la boutique) depuis le EUR/USD de la BCE. Appelé par le cron nocturne,
 * JAMAIS au rendu d'une page. Le FCFA étant arrimé à l'euro, un seul taux de marché suffit.
 * Source 1 : Frankfurter (BCE, sans clé) · source 2 : open.er-api.com (cotation USD→EUR) · garde-fou de plage.
 */

const FETCH_TIMEOUT_MS = 5000;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) throw new Error(`fx_http_${res.status}`);
  return res.json();
}

/** Nombre d'USD pour 1 EUR, ou null si aucune source ne répond avec une valeur plausible. */
export async function fetchEurUsd(): Promise<number | null> {
  try {
    const j = (await getJson("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD")) as { rates?: { USD?: unknown } };
    if (validEurUsd(j?.rates?.USD)) return j.rates.USD;
  } catch {
    /* repli sur la 2e source */
  }
  try {
    const j = (await getJson("https://open.er-api.com/v6/latest/EUR")) as { rates?: { USD?: unknown } };
    if (validEurUsd(j?.rates?.USD)) return j.rates.USD;
  } catch {
    /* aucune source */
  }
  return null;
}

export type FxRefreshResult = { ok: true; eurUsd: number; rates: FxRates } | { ok: false; code: "no_source" | "write_failed" };

export async function refreshFxRates(): Promise<FxRefreshResult> {
  const eurUsd = await fetchEurUsd();
  if (eurUsd === null) return { ok: false, code: "no_source" };
  const rates = fxFromEurUsd(eurUsd);
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin.from("fx_rates").upsert(
    [
      { currency: "EUR", per_xof: Number(rates.eur.toFixed(10)), updated_at: now },
      { currency: "USD", per_xof: Number(rates.usd.toFixed(10)), updated_at: now },
    ],
    { onConflict: "currency" },
  );
  if (error) return { ok: false, code: "write_failed" };
  return { ok: true, eurUsd, rates };
}
