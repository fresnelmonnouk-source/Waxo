// Audit 2026-10-12 : alerte équipe au changement des clés de paiement (F2), oracle « numéro pris » borné (F6),
// CAPTCHA de l'inscription (M1).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rows = vi.hoisted(() => new Map<string, { value: unknown; is_public: boolean }>());
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: (_c: string, key: string) => ({ maybeSingle: async () => ({ data: rows.has(key) ? { value: rows.get(key)!.value } : null, error: null }) }) }),
      upsert: async (row: { key: string; value: unknown; is_public: boolean }) => {
        rows.set(row.key, { value: row.value, is_public: row.is_public });
        return { error: null };
      },
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}));
const assertAdmin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin/guard", () => ({ assertAdmin: () => assertAdmin(), requireAdmin: () => assertAdmin() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const session = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSessionClient: () => session.create() }));
vi.mock("@/lib/supabase/env", () => ({ supabasePublicEnv: () => ({ url: "u", key: "k" }) }));
vi.mock("@/lib/payment/fedapay", () => ({ pingFedapay: vi.fn(), fetchTransaction: vi.fn() }));
const alert = vi.hoisted(() => ({ send: vi.fn(), emails: vi.fn() }));
vi.mock("@/lib/email/payment-alert", async (orig) => ({
  ...(await orig<typeof import("@/lib/email/payment-alert")>()),
  sendPaymentKeysAlert: (...a: unknown[]) => alert.send(...a),
  adminEmails: (...a: unknown[]) => alert.emails(...a),
}));
const userMod = vi.hoisted(() => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/auth/user", () => userMod);

import { paymentAlertLines } from "@/lib/email/payment-alert";

const KEY = "sk_sandbox_ABCDEFGH1234";
const HOOK = "wh_sandbox_ZYXWVUTS9876";

beforeEach(() => {
  rows.clear();
  alert.send.mockReset();
  alert.emails.mockReset();
  alert.emails.mockResolvedValue(["a@b.bj", "c@d.bj"]);
  assertAdmin.mockResolvedValue({ id: "admin-1", email: "a@b.bj" });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-for-tests-0123456789");
  vi.stubEnv("FEDAPAY_SECRET_KEY", "");
  vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("F2 : alerte équipe quand les clés de paiement changent", () => {
  const actions = () => {
    vi.resetModules();
    return import("@/app/admin/(panel)/reglages/actions");
  };
  it("enregistrement → alerte à tous les admins, avec l'auteur, le mode et les clés MASQUÉES uniquement", async () => {
    const a = await actions();
    expect(await a.saveFedapayAction({ secretKey: KEY, webhookSecret: HOOK })).toMatchObject({ ok: true });
    expect(alert.send).toHaveBeenCalledTimes(1);
    const [to, change] = alert.send.mock.calls[0];
    expect(to).toEqual(["a@b.bj", "c@d.bj"]);
    expect(change).toMatchObject({ actorEmail: "a@b.bj", mode: "sandbox", secretMasked: "sk_sandbox_••••1234", webhookMasked: "wh_sandbox_••••9876" });
    expect(change.what.join(" ")).toMatch(/nouvelle clé API FedaPay \(mode essai\)/);
    expect(JSON.stringify(alert.send.mock.calls)).not.toContain("ABCDEFGH");
  });
  it("effacement → alerte aussi ; action refusée → aucune alerte", async () => {
    const a = await actions();
    await a.saveFedapayAction({ secretKey: KEY });
    alert.send.mockReset();
    await a.clearFedapayAction("secret");
    expect(alert.send.mock.calls[0][1].what[0]).toMatch(/a effacé de l'espace admin la clé API FedaPay/);
    alert.send.mockReset();
    assertAdmin.mockResolvedValue(null);
    await a.saveFedapayAction({ secretKey: KEY });
    expect(alert.send).not.toHaveBeenCalled();
  });
  it("texte du message : horodatage Bénin, aucun secret en clair", () => {
    const { subject, lines } = paymentAlertLines({
      actorEmail: "a@b.bj",
      what: ["a enregistré une nouvelle clé API FedaPay (mode réel)"],
      secretMasked: "sk_live_••••abcd",
      webhookMasked: null,
      mode: "live",
      at: new Date("2026-10-12T10:00:00Z"),
    });
    expect(subject).toMatch(/clés de paiement/);
    expect(lines[0]).toMatch(/^a@b\.bj a enregistré .* 11:00 \(heure du Bénin\)\.$/);
    expect(lines[1]).toContain("sk_live_••••abcd");
    expect(lines[1]).toContain("Mode : réel");
  });
});

describe("F6 : conflit de numéro borné", () => {
  it("au-delà de 5 conflits par heure pour un compte → 429", async () => {
    vi.resetModules();
    const update = vi.fn(() => ({ eq: async () => ({ error: { code: "23505" } }) }));
    userMod.getSessionContext.mockResolvedValue({ sb: { from: () => ({ update }) }, userId: "u-f6", email: "x@y.bj" });
    const { PATCH } = await import("@/app/api/me/profile/route");
    const send = () =>
      PATCH(new Request("http://localhost/api/me/profile", { method: "PATCH", body: JSON.stringify({ firstName: "Afi", lastName: "Houngbédji", phone: "01 97 00 00 00", address: "Cotonou", news: false }) }));
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await send()).status);
    expect(statuses).toEqual([422, 422, 422, 422, 422, 429]);
  });
});

describe("M1 : CAPTCHA de l'inscription", () => {
  const valid = { firstName: "Afi", lastName: "Houngbédji", phone: "+229 01 97 00 00 00", email: "afi@exemple.bj", password: "motdepasse1", cgu: true, news: false, lang: "fr", website: "", t: Date.now() - 30_000 };
  it("clés posées, jeton absent → 403 captcha, aucun compte créé ; jeton valide → inscription", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    const signUp = vi.fn(async () => ({ data: { user: null, session: null }, error: null }));
    session.create.mockResolvedValue({ auth: { signUp } });
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ success: true })));
    vi.stubGlobal("fetch", fetchSpy);
    const { POST } = await import("@/app/api/auth/signup/route");
    const send = (b: unknown) => POST(new Request("http://localhost/api/auth/signup", { method: "POST", headers: { "x-forwarded-for": "7.7.7.7" }, body: JSON.stringify(b) }));
    const r1 = await send(valid);
    expect(r1.status).toBe(403);
    expect(await r1.json()).toMatchObject({ code: "captcha" });
    expect(signUp).not.toHaveBeenCalled();
    const r2 = await send({ ...valid, captcha: "tok" });
    expect(r2.status).toBe(200);
    expect(signUp).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
