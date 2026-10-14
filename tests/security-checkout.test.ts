// Audit 2026-10-12 sur POST /api/checkout : paiement en ligne indisponible (C1) refusé AVANT la commande, CAPTCHA
// Turnstile inerte sans clés (M1), remplacement d'une commande au paiement échoué (Mia 9), e-mails après la réponse (M7).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
const orderRow = vi.hoisted(() => ({ value: null as null | Record<string, unknown> }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc,
    from: () => {
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "update", "limit"]) chain[m] = () => chain;
      chain.maybeSingle = async () => ({ data: orderRow.value, error: null });
      chain.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
      return chain;
    },
  }),
}));
vi.mock("@/lib/supabase/env", () => ({ supabasePublicEnv: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createSessionClient: vi.fn() }));
const provider = vi.hoisted(() => ({ name: "test", createCheckout: vi.fn() }));
vi.mock("@/lib/payment", () => ({ getPaymentProvider: async () => provider }));
const sendOrderEmail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email", () => ({ sendOrderEmail: (...a: unknown[]) => sendOrderEmail(...a) }));
vi.mock("@/lib/email/shop", () => ({ sendShopNewOrderEmail: async () => ({ sent: true }) }));
vi.mock("@/lib/catalog", () => ({ getProductsByIds: async () => [] }));
vi.mock("@/lib/catalog/packs", () => ({ getPacks: async () => [], getAllPacks: async () => [], getPacksEnabled: async () => true }));

import { POST } from "@/app/api/checkout/route";
import { providerUsable } from "@/app/api/checkout/guard";
import { resetRateLimit } from "@/lib/checkout/rate-limit";
import { orderStatusToken } from "@/lib/payment/token";

const UUID = "3f2b8c1e-5a47-4d9a-9b1e-7c2d4e6f8a10";
const body = (over: Record<string, unknown> = {}) => ({
  items: [{ kind: "product", id: UUID, qty: 1 }],
  customer: { name: "Afi Houngbédji", phone: "01 97 00 00 00", address: "Fidjrossè, portail bleu" },
  zone: "cotonou",
  pay: "cod",
  lang: "fr",
  website: "",
  elapsed: 10_000,
  ...over,
});
let ip = 0;
const call = async (payload: unknown) => {
  const res = await POST(
    new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `9.9.9.${++ip}` },
      body: JSON.stringify(payload),
    }),
  );
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
};
const placed = { data: [{ order_id: "o1", order_number: "WX-10300", subtotal: 6000, shipping_fee: 1000, total: 7000 }], error: null };

beforeEach(() => {
  resetRateLimit();
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => (fn === "place_order" ? placed : { data: true, error: null }));
  orderRow.value = null;
  provider.name = "test";
  provider.createCheckout.mockReset();
  provider.createCheckout.mockResolvedValue({ redirectUrl: "https://process.fedapay.com/tok" });
  sendOrderEmail.mockReset();
  sendOrderEmail.mockResolvedValue({ sent: true });
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("C1 : paiement en ligne indisponible", () => {
  it("providerUsable : « unavailable » et le mock en production sont refusés", () => {
    expect(providerUsable("unavailable", "development")).toBe(false);
    expect(providerUsable("mock", "production")).toBe(false);
    expect(providerUsable("mock", "development")).toBe(true);
    expect(providerUsable("fedapay", "production")).toBe(true);
  });
  it("clé d'essai refusée en production → 503 online_unavailable, AUCUNE commande créée (stock intact)", async () => {
    provider.name = "unavailable";
    const r = await call(body({ pay: "momo", payerPhone: "01 96 00 00 00" }));
    expect(r.status).toBe(503);
    expect(r.json).toMatchObject({ ok: false, code: "online_unavailable" });
    expect(String(r.json.message)).toMatch(/livraison/);
    expect(rpc).not.toHaveBeenCalledWith("place_order", expect.anything());
  });
  it("le paiement à la livraison reste possible", async () => {
    provider.name = "unavailable";
    const r = await call(body());
    expect(r.json).toMatchObject({ ok: true, payment: { kind: "cod" } });
    expect(sendOrderEmail).toHaveBeenCalledWith("o1", "confirmation");
  });
});

describe("M1 : CAPTCHA Turnstile", () => {
  it("sans clés : inerte, aucune vérification, la commande passe", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect((await call(body())).json).toMatchObject({ ok: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("une seule des deux clés : toujours inerte (jamais de formulaire bloqué par une config à moitié posée)", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    expect((await call(body())).json).toMatchObject({ ok: true });
  });
  it("clés posées, jeton absent ou refusé → 403 captcha, aucune commande", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }))));
    expect(await call(body())).toMatchObject({ status: 403, json: { code: "captcha" } });
    expect(await call(body({ captcha: "faux" }))).toMatchObject({ status: 403, json: { code: "captcha" } });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("clés posées, jeton validé par Cloudflare → commande créée", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    const calls: [string, RequestInit][] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return new Response(JSON.stringify({ success: true }));
    });
    expect((await call(body({ captcha: "tok" }))).json).toMatchObject({ ok: true });
    expect(calls[0][0]).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(String(calls[0][1].body)).toContain("response=tok");
  });
});

describe("Mia 9 : remplacement de la commande au paiement échoué", () => {
  it("jeton du retour valide + commande en ligne non payée → cancel_order AVANT la nouvelle commande", async () => {
    vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", "whsec");
    orderRow.value = { id: "old-1", pay: "momo", paid: false, status: "nouvelle" };
    const k = orderStatusToken("WX-10299", { FEDAPAY_WEBHOOK_SECRET: "whsec" })!;
    await call(body({ replaces: { n: "WX-10299", k } }));
    const names = rpc.mock.calls.map((c) => c[0]);
    expect(names.indexOf("cancel_order")).toBeGreaterThanOrEqual(0);
    expect(names.indexOf("cancel_order")).toBeLessThan(names.indexOf("place_order"));
    expect(rpc).toHaveBeenCalledWith("cancel_order", { p_order: "old-1" });
  });
  it("jeton faux, commande payée ou déjà à la livraison → rien n'est annulé", async () => {
    vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", "whsec");
    const k = orderStatusToken("WX-10299", { FEDAPAY_WEBHOOK_SECRET: "whsec" })!;
    orderRow.value = { id: "old-1", pay: "momo", paid: false, status: "nouvelle" };
    await call(body({ replaces: { n: "WX-10299", k: "0".repeat(32) } }));
    orderRow.value = { id: "old-1", pay: "momo", paid: true, status: "nouvelle" };
    await call(body({ replaces: { n: "WX-10299", k } }));
    orderRow.value = { id: "old-1", pay: "cod", paid: false, status: "nouvelle" };
    await call(body({ replaces: { n: "WX-10299", k } }));
    expect(rpc).not.toHaveBeenCalledWith("cancel_order", expect.anything());
  });
});
