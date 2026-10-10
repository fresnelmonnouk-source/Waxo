import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FX,
  PEG_EUR_XOF,
  convertXof,
  fmtMoney,
  fxFromEurUsd,
  isCurrency,
  sanitizeFx,
  validEurUsd,
} from "@/lib/currency/core";

const upsert = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => ({ upsert }) }) }));

describe("taux d'affichage", () => {
  it("l'euro suit exactement le peg 655,957", () => {
    expect(fxFromEurUsd(1.12).eur * PEG_EUR_XOF).toBeCloseTo(1, 10);
    expect(convertXof(655957, "EUR", fxFromEurUsd(1.12))).toBe(1000);
  });

  it("le dollar est MAJORÉ de 2 % (jamais minoré) : le client n'est pas débité plus que vu", () => {
    const market = 1.12 / PEG_EUR_XOF; // $ par F au marché
    const fx = fxFromEurUsd(1.12);
    expect(fx.usd).toBeCloseTo(market * 1.02, 12);
    // 100 000 F : prix affiché ≥ valeur réelle au marché
    expect(convertXof(100000, "USD", fx)).toBeGreaterThanOrEqual(Math.round(100000 * market * 100) / 100);
  });

  it("le repli par défaut est prudent : dollar affiché plus cher qu'au cours courant (≈1,12)", () => {
    expect(convertXof(100000, "USD", DEFAULT_FX)).toBeGreaterThan(convertXof(100000, "USD", fxFromEurUsd(1.12)));
  });

  it("garde-fou de plage sur le EUR/USD de la source", () => {
    expect(validEurUsd(1.12)).toBe(true);
    for (const bad of [0, -1, 0.5, 3, 600, Number.NaN, Number.POSITIVE_INFINITY, "1.1", null, undefined]) expect(validEurUsd(bad)).toBe(false);
  });

  it("sanitizeFx rejette une donnée corrompue et garde le repli", () => {
    const good = fxFromEurUsd(1.1);
    expect(sanitizeFx(good)).toEqual(good);
    expect(sanitizeFx({ eur: 0.0015, usd: good.usd })).toEqual({ eur: DEFAULT_FX.eur, usd: good.usd }); // euro ≠ peg
    expect(sanitizeFx({ eur: good.eur, usd: 5 })).toEqual({ eur: good.eur, usd: DEFAULT_FX.usd });
    expect(sanitizeFx({ eur: good.eur, usd: -1 }).usd).toBe(DEFAULT_FX.usd);
    expect(sanitizeFx(null)).toEqual(DEFAULT_FX);
    expect(sanitizeFx({ eur: "abc", usd: undefined })).toEqual(DEFAULT_FX);
  });

  it("isCurrency", () => {
    expect(isCurrency("EUR")).toBe(true);
    expect(isCurrency("GBP")).toBe(false);
    expect(isCurrency(undefined)).toBe(false);
  });
});

describe("fmtMoney", () => {
  const fx = fxFromEurUsd(1.1);
  const norm = (s: string) => s.replace(/[\u00A0\u202F]/g, " ");

  it("FCFA : identique à fmtXof, sans « ≈ »", () => {
    expect(norm(fmtMoney(12500, "XOF", fx, "fr"))).toBe("12 500 F");
    expect(fmtMoney(12500, "XOF", fx, "en")).toBe(fmtMoney(12500, "XOF", fx, "fr"));
  });

  it("€ et $ sont toujours marqués indicatifs", () => {
    expect(norm(fmtMoney(655957, "EUR", fx, "fr"))).toBe("≈ 1 000,00 €");
    expect(fmtMoney(655957, "EUR", fx, "en")).toContain("≈");
    expect(fmtMoney(1000, "USD", fx, "fr")).toMatch(/^≈\u00A0\d+,\d{2}\u00A0\$$/);
    expect(norm(fmtMoney(655957, "EUR", fx, "en"))).toBe("≈ €1,000.00");
    expect(fmtMoney(1000, "USD", fx, "en")).toMatch(/^≈\u00A0\$\d+\.\d{2}$/);
  });

  it("jamais de NaN ni de montant négatif surprenant", () => {
    expect(fmtMoney(Number.NaN, "USD", fx, "en")).toBe("≈\u00A0$0.00");
    expect(fmtMoney(Number.POSITIVE_INFINITY, "EUR", fx, "fr")).toContain("0,00");
  });

  it("prix à l'unité et petits montants gardent 2 décimales", () => {
    expect(norm(fmtMoney(1000, "EUR", fx, "fr"))).toBe("≈ 1,52 €");
    expect(fmtMoney(0, "USD", fx, "en")).toBe("≈\u00A0$0.00");
  });
});

describe("refreshFxRates", () => {
  beforeEach(() => {
    upsert.mockReset();
    upsert.mockResolvedValue({ error: null });
  });
  afterEach(() => vi.unstubAllGlobals());

  const jsonRes = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body });

  it("écrit EUR (peg) et USD (marge) depuis la BCE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes({ rates: { USD: 1.12 } })));
    const { refreshFxRates } = await import("@/lib/currency/refresh");
    const r = await refreshFxRates();
    expect(r.ok).toBe(true);
    const rows = upsert.mock.calls[0][0] as { currency: string; per_xof: number }[];
    expect(rows.map((x) => x.currency)).toEqual(["EUR", "USD"]);
    expect(rows[0].per_xof * PEG_EUR_XOF).toBeCloseTo(1, 6);
    expect(rows[1].per_xof).toBeCloseTo((1.12 / PEG_EUR_XOF) * 1.02, 8);
  });

  it("bascule sur la 2e source si la 1re tombe", async () => {
    const f = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(jsonRes({ rates: { USD: 1.1 } }));
    vi.stubGlobal("fetch", f);
    const { refreshFxRates } = await import("@/lib/currency/refresh");
    expect((await refreshFxRates()).ok).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("source absurde ou aucune source : ne touche PAS la base", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes({ rates: { USD: 600 } })));
    const { refreshFxRates } = await import("@/lib/currency/refresh");
    expect(await refreshFxRates()).toEqual({ ok: false, code: "no_source" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("échec d'écriture signalé", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes({ rates: { USD: 1.12 } })));
    upsert.mockResolvedValue({ error: { message: "rls" } });
    const { refreshFxRates } = await import("@/lib/currency/refresh");
    expect(await refreshFxRates()).toEqual({ ok: false, code: "write_failed" });
  });
});
