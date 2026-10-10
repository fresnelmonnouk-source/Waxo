import { beforeEach, describe, expect, it, vi } from "vitest";

// Le secret du webhook saisi dans l'espace admin (chiffré en base) est celui qui fait foi ; l'environnement n'est qu'un repli.
const rows = vi.hoisted(() => new Map<string, unknown>());
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: (_c: string, key: string) => ({ maybeSingle: async () => ({ data: rows.has(key) ? { value: rows.get(key) } : null, error: null }) }) }),
      upsert: async (row: { key: string; value: unknown }) => {
        rows.set(row.key, row.value);
        return { error: null };
      },
    }),
  }),
}));
const settle = vi.hoisted(() => vi.fn());
vi.mock("@/lib/payment/settle", () => ({ settleApprovedTransaction: (...a: unknown[]) => settle(...a) }));
vi.mock("@/lib/payment/fedapay", () => ({ fetchTransaction: vi.fn(), pingFedapay: vi.fn() }));

import { invalidateCredentialsCache, saveFedapaySecrets } from "@/lib/payment/credentials";
import { signFedapayPayload } from "@/lib/payment/signature";

const ADMIN_HOOK = "wh_sandbox_ADMINSECRET1";
const ENV_HOOK = "wh_sandbox_ENVSECRET0001";
const body = JSON.stringify({
  name: "transaction.approved",
  entity: { id: 4242, status: "approved", amount: 7500, currency: { iso: "XOF" }, merchant_reference: "WX-10001", custom_metadata: { order_number: "WX-10001" } },
});
const post = async (secret: string) => {
  const { POST } = await import("@/app/api/webhooks/fedapay/route");
  const t = Math.floor(Date.now() / 1000);
  return POST(new Request("http://localhost/api/webhooks/fedapay", { method: "POST", body, headers: { "x-fedapay-signature": signFedapayPayload(body, secret, t) } }));
};

beforeEach(async () => {
  rows.clear();
  settle.mockReset();
  settle.mockResolvedValue("paid");
  invalidateCredentialsCache();
  vi.unstubAllEnvs();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-for-tests-0123456789");
  vi.stubEnv("FEDAPAY_SECRET_KEY", "");
  vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", ENV_HOOK);
});

describe("webhook FedaPay avec secret saisi en admin", () => {
  it("accepte une signature faite avec le secret de l'admin", async () => {
    await saveFedapaySecrets({ webhookSecret: ADMIN_HOOK });
    expect((await post(ADMIN_HOOK)).status).toBe(200);
    expect(settle).toHaveBeenCalledTimes(1);
  });
  it("le secret de l'admin prime : une signature faite avec l'ancien secret d'environnement est refusée", async () => {
    await saveFedapaySecrets({ webhookSecret: ADMIN_HOOK });
    expect((await post(ENV_HOOK)).status).toBe(401);
    expect(settle).not.toHaveBeenCalled();
  });
  it("sans secret saisi en admin : repli sur l'environnement", async () => {
    expect((await post(ENV_HOOK)).status).toBe(200);
  });
  it("après effacement du secret admin : retour à l'environnement", async () => {
    await saveFedapaySecrets({ webhookSecret: ADMIN_HOOK });
    await saveFedapaySecrets({ webhookSecret: null });
    expect((await post(ENV_HOOK)).status).toBe(200);
    expect((await post(ADMIN_HOOK)).status).toBe(401);
  });
});
