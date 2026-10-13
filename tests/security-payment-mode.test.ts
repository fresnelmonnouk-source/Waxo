// Audit Raphaël C1 (2026-10-12) : une configuration FedaPay d'essai (sandbox) ne doit jamais encaisser en production.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
const insert = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc, from: () => ({ insert }) }) }));
const sendOrderEmail = vi.hoisted(() => vi.fn());
const sendShop = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email", () => ({ sendOrderEmail: (...a: unknown[]) => sendOrderEmail(...a) }));
vi.mock("@/lib/email/shop", () => ({ sendShopNewOrderEmail: (...a: unknown[]) => sendShop(...a) }));

import { isProductionRuntime, paymentModeBlocked, sandboxAllowed } from "@/lib/payment/mode";
import { getPaymentProvider } from "@/lib/payment";
import { onlinePaymentReady } from "@/lib/payment/ready";
import { settleApprovedTransaction } from "@/lib/payment/settle";
import { FedaPayProvider } from "@/lib/payment/fedapay";
import { fedapayConfig } from "@/lib/payment/config";
import type { FedapayTransaction } from "@/lib/payment/transaction";

const ORDER = "3f2b8c1e-5a47-4d9a-9b1e-7c2d4e6f8a10";
const tx: FedapayTransaction = { id: "777", status: "approved", amount: 7000, currency: "XOF", reference: "WX-10264", orderId: ORDER, orderNumber: "WX-10264" };

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: "paid", error: null });
  insert.mockReset();
  insert.mockResolvedValue({ error: null });
  sendOrderEmail.mockReset();
  sendOrderEmail.mockResolvedValue({ sent: true });
  sendShop.mockReset();
  sendShop.mockResolvedValue({ sent: true });
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("ALLOW_SANDBOX_PAYMENTS", "");
  vi.stubEnv("FEDAPAY_SECRET_KEY", "");
  vi.stubEnv("FEDAPAY_ENV", "");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("mode de paiement (pur)", () => {
  it("VERCEL_ENV fait foi : production oui, preview non ; hors Vercel, NODE_ENV=production = production", () => {
    expect(isProductionRuntime({ VERCEL_ENV: "production", NODE_ENV: "production" })).toBe(true);
    expect(isProductionRuntime({ VERCEL_ENV: "preview", NODE_ENV: "production" })).toBe(false);
    expect(isProductionRuntime({ VERCEL_ENV: "development", NODE_ENV: "production" })).toBe(false);
    expect(isProductionRuntime({ NODE_ENV: "production" })).toBe(true);
    expect(isProductionRuntime({ NODE_ENV: "development" })).toBe(false);
  });
  it("sandbox (ou mode inconnu) bloqué en production sauf ALLOW_SANDBOX_PAYMENTS=1 ; live jamais bloqué", () => {
    const prod = { VERCEL_ENV: "production" };
    expect(paymentModeBlocked("sandbox", prod)).toBe(true);
    expect(paymentModeBlocked(null, prod)).toBe(true);
    expect(paymentModeBlocked("live", prod)).toBe(false);
    expect(paymentModeBlocked("sandbox", { ...prod, ALLOW_SANDBOX_PAYMENTS: "1" })).toBe(false);
    expect(paymentModeBlocked("sandbox", { ...prod, ALLOW_SANDBOX_PAYMENTS: "true" })).toBe(true);
    expect(paymentModeBlocked("sandbox", { VERCEL_ENV: "preview" })).toBe(false);
    expect(sandboxAllowed({ ALLOW_SANDBOX_PAYMENTS: " 1 " })).toBe(true);
  });
});

describe("getPaymentProvider / onlinePaymentReady", () => {
  it("production + clé sk_sandbox_ → provider « unavailable » qui refuse tout paiement", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("FEDAPAY_SECRET_KEY", "sk_sandbox_abc");
    const p = await getPaymentProvider();
    expect(p.name).toBe("unavailable");
    await expect(p.createCheckout({} as never)).rejects.toThrow("payment_unavailable");
    expect(await onlinePaymentReady()).toBe(false);
  });
  it("production + FEDAPAY_ENV=sandbox forcé sur une clé live → refusé aussi", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("FEDAPAY_SECRET_KEY", "sk_live_abc");
    vi.stubEnv("FEDAPAY_ENV", "sandbox");
    expect((await getPaymentProvider()).name).toBe("unavailable");
  });
  it("production + clé live → FedaPay ; preview + sandbox → FedaPay ; dérogation explicite → FedaPay", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("FEDAPAY_SECRET_KEY", "sk_live_abc");
    expect((await getPaymentProvider()).name).toBe("fedapay");
    expect(await onlinePaymentReady()).toBe(true);
    vi.stubEnv("FEDAPAY_SECRET_KEY", "sk_sandbox_abc");
    vi.stubEnv("ALLOW_SANDBOX_PAYMENTS", "1");
    expect((await getPaymentProvider()).name).toBe("fedapay");
    vi.stubEnv("ALLOW_SANDBOX_PAYMENTS", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect((await getPaymentProvider()).name).toBe("fedapay");
  });
  it("aucune clé : prêt en développement (mock), jamais en production", async () => {
    expect(await onlinePaymentReady()).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    expect(await onlinePaymentReady()).toBe(false);
  });
});

describe("settleApprovedTransaction : garde du mode", () => {
  it("production + transaction relue avec une clé d'essai → « ignored », mark_paid JAMAIS appelé, aucun e-mail", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(await settleApprovedTransaction(tx, "transaction.approved:777", "sandbox")).toBe("ignored");
    expect(await settleApprovedTransaction(tx, "transaction.approved:777", null)).toBe("ignored");
    expect(rpc).not.toHaveBeenCalled();
    expect(sendOrderEmail).not.toHaveBeenCalled();
  });
  it("production + live → payée ; le mode est conservé dans payments.raw", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(await settleApprovedTransaction(tx, "transaction.approved:777", "live")).toBe("paid");
    expect(rpc).toHaveBeenCalledWith("mark_paid", expect.objectContaining({ p_order: ORDER, p_raw: expect.objectContaining({ mode: "live", id: "777" }) }));
    // E-mails (hors requête : attendus directement) : client « payé » + alerte boutique.
    expect(sendOrderEmail).toHaveBeenCalledWith(ORDER, "paid");
    expect(sendShop).toHaveBeenCalledWith(ORDER);
  });
  it("preview (recette) : le sandbox est accepté et tracé comme tel", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(await settleApprovedTransaction(tx, "return:777", "sandbox")).toBe("paid");
    expect(rpc.mock.calls[0][1].p_raw.mode).toBe("sandbox");
  });
  it("échec de mark_paid : lève toujours (le webhook répond 503 et FedaPay réessaie)", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    rpc.mockResolvedValue({ data: null, error: { code: "08006" } });
    await expect(settleApprovedTransaction(tx, "x", "live")).rejects.toThrow("mark_paid_failed");
  });
});

describe("trace « pending » : le mode est enregistré", () => {
  it("FedaPayProvider.createCheckout écrit payments.raw.mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://waxo.bj");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/transactions")
          ? new Response(JSON.stringify({ "v1/transaction": { id: 555, status: "pending", amount: 7000 } }))
          : new Response(JSON.stringify({ url: "https://process.fedapay.com/tok" })),
      ),
    );
    const cfg = fedapayConfig({ FEDAPAY_SECRET_KEY: "sk_sandbox_abc" })!;
    await new FedaPayProvider(cfg).createCheckout({
      orderId: ORDER,
      number: "WX-10264",
      total: 7000,
      method: "momo",
      customer: { name: "Afi", phone: "0197000000", email: null },
      payerPhone: null,
      lang: "fr",
    });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ raw: { id: "555", method: "momo", mode: "sandbox" } }));
  });
});
