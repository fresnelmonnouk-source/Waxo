import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => ({ insert }) }) }));

import { FedaPayProvider, FedapayError } from "@/lib/payment/fedapay";
import { getPaymentProvider, MockPaymentProvider } from "@/lib/payment";
import { fedapayConfig } from "@/lib/payment/config";
import type { PayableOrder } from "@/lib/payment/types";

const order: PayableOrder = {
  orderId: "3f2b8c1e-5a47-4d9a-9b1e-7c2d4e6f8a10",
  number: "WX-10264",
  total: 7000,
  method: "momo",
  customer: { name: "Afi Houngbédji", phone: "0197000000", email: "afi@example.com" },
  payerPhone: "0196000000",
  lang: "fr",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  insert.mockReset();
  insert.mockResolvedValue({ error: null });
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://waxo.bj");
  vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", "whsec");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("FedaPayProvider", () => {
  const cfg = fedapayConfig({ FEDAPAY_SECRET_KEY: "sk_sandbox_abc" })!;

  it("crée la transaction avec le montant de la commande, puis renvoie l'URL de paiement", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        if (url.endsWith("/transactions")) return json({ "v1/transaction": { id: 555, status: "pending", amount: 7000 } });
        return json({ token: "tok", url: "https://process.fedapay.com/tok" });
      }),
    );
    const res = await new FedaPayProvider(cfg).createCheckout(order);
    expect(res).toEqual({ redirectUrl: "https://process.fedapay.com/tok" });

    expect(calls[0].url).toBe("https://sandbox-api.fedapay.com/v1/transactions");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer sk_sandbox_abc");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toMatchObject({
      amount: 7000,
      currency: { iso: "XOF" },
      merchant_reference: "WX-10264",
      custom_metadata: { order_id: order.orderId, order_number: "WX-10264" },
      customer: { firstname: "Afi", lastname: "Houngbédji", phone_number: { number: "+2290196000000", country: "bj" } },
    });
    expect(body.callback_url).toMatch(/^https:\/\/waxo\.bj\/fr\/commande\/merci\?n=WX-10264&k=[0-9a-f]{32}$/);
    expect(calls[1].url).toBe("https://sandbox-api.fedapay.com/v1/transactions/555/token");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ provider: "fedapay", provider_ref: "555", status: "pending", amount: 7000 }));
  });

  it("réessaie une fois sans coordonnées si FedaPay les refuse (422)", async () => {
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.endsWith("/transactions")) {
          n += 1;
          if (n === 1) return json({ message: "invalid phone" }, 422);
          expect(JSON.parse(String(init.body)).customer.phone_number).toBeUndefined();
          return json({ "v1/transaction": { id: 9, status: "pending", amount: 7000 } });
        }
        return json({ token: "t", url: "https://process.fedapay.com/t" });
      }),
    );
    await expect(new FedaPayProvider(cfg).createCheckout(order)).resolves.toEqual({ redirectUrl: "https://process.fedapay.com/t" });
    expect(n).toBe(2);
  });

  it("jette (sans clé dans le message) si l'API est indisponible ou renvoie une URL non https", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 500)));
    await expect(new FedaPayProvider(cfg).createCheckout(order)).rejects.toBeInstanceOf(FedapayError);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/transactions") ? json({ "v1/transaction": { id: 1, status: "pending", amount: 7000 } }) : json({ url: "http://evil.example/x" }),
      ),
    );
    await expect(new FedaPayProvider(cfg).createCheckout(order)).rejects.toThrow("fedapay_bad_token");
  });

  it("refuse de créer une transaction sans origine de site (retour de paiement impossible)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    await expect(new FedaPayProvider(cfg).createCheckout(order)).rejects.toThrow("site_url_missing");
  });
});

describe("choix du provider", () => {
  it("sans clé : mock explicite, jamais en production", async () => {
    vi.stubEnv("FEDAPAY_SECRET_KEY", "");
    const provider = await getPaymentProvider();
    expect(provider).toBeInstanceOf(MockPaymentProvider);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(provider.createCheckout(order)).resolves.toEqual({ pending: true });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();

    vi.stubEnv("NODE_ENV", "production");
    await expect(provider.createCheckout(order)).rejects.toThrow("payment_provider_not_configured");
  });

  it("avec clé : FedaPay", async () => {
    vi.stubEnv("FEDAPAY_SECRET_KEY", "sk_sandbox_abc");
    expect((await getPaymentProvider()).name).toBe("fedapay");
  });
});
