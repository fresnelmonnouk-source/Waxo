import { beforeEach, describe, expect, it, vi } from "vitest";

// Faux « settings » en mémoire (Supabase admin simulé) pour tester stockage chiffré, priorité admin > env et actions.
const rows = vi.hoisted(() => new Map<string, { value: unknown; is_public: boolean }>());
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table !== "settings") throw new Error("table inattendue " + table);
      return {
        select: () => ({
          eq: (_c: string, key: string) => ({ maybeSingle: async () => ({ data: rows.has(key) ? { value: rows.get(key)!.value } : null, error: null }) }),
        }),
        upsert: async (row: { key: string; value: unknown; is_public: boolean }) => {
          rows.set(row.key, { value: row.value, is_public: row.is_public });
          return { error: null };
        },
      };
    },
  }),
}));
const assertAdmin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin/guard", () => ({ assertAdmin: () => assertAdmin(), requireAdmin: () => assertAdmin() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSessionClient: vi.fn() }));
const ping = vi.hoisted(() => vi.fn());
vi.mock("@/lib/payment/fedapay", () => ({ pingFedapay: (...a: unknown[]) => ping(...a), fetchTransaction: vi.fn() }));

import { decryptSecret, encryptSecret } from "@/lib/payment/secret-box";
import { fedapayStatus, invalidateCredentialsCache, loadFedapayConfig, loadWebhookSecret, maskSecret, saveFedapaySecrets } from "@/lib/payment/credentials";

const KEY = "sk_sandbox_ABCDEFGH1234";
const HOOK = "wh_sandbox_ZYXWVUTS9876";
const SERVICE = "service-role-key-for-tests-0123456789";

beforeEach(() => {
  rows.clear();
  invalidateCredentialsCache();
  assertAdmin.mockReset();
  ping.mockReset();
  vi.unstubAllEnvs();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE);
  vi.stubEnv("SETTINGS_ENCRYPTION_KEY", "");
  vi.stubEnv("FEDAPAY_SECRET_KEY", "");
  vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", "");
  vi.stubEnv("FEDAPAY_ENV", "");
});

describe("secret-box (AES-256-GCM)", () => {
  it("chiffre puis déchiffre ; deux chiffrements du même texte diffèrent (IV aléatoire)", () => {
    const a = encryptSecret(KEY)!;
    const b = encryptSecret(KEY)!;
    expect(a).not.toBe(b);
    expect(a).not.toContain(KEY);
    expect(decryptSecret(a)).toBe(KEY);
  });
  it("texte altéré, format inconnu ou autre clé de chiffrement → null (jamais d'exception)", () => {
    const blob = encryptSecret(KEY)!;
    const parts = blob.split(".");
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("AA") ? "BB" : "AA");
    expect(decryptSecret(parts.join("."))).toBeNull();
    expect(decryptSecret("n importe quoi")).toBeNull();
    expect(decryptSecret(undefined)).toBeNull();
    vi.stubEnv("SETTINGS_ENCRYPTION_KEY", "une-autre-cle-de-chiffrement-123");
    expect(decryptSecret(blob)).toBeNull();
  });
  it("sans clé de chiffrement disponible : impossible de chiffrer", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(encryptSecret(KEY)).toBeNull();
  });
});

describe("credentials FedaPay : stockage et priorité", () => {
  it("enregistre CHIFFRÉ et non public ; relit en clair côté serveur", async () => {
    expect(await saveFedapaySecrets({ secretKey: KEY, webhookSecret: HOOK })).toEqual({ ok: true });
    const stored = rows.get("payments")!;
    expect(stored.is_public).toBe(false);
    expect(JSON.stringify(stored.value)).not.toContain(KEY);
    expect(JSON.stringify(stored.value)).not.toContain(HOOK);
    const cfg = await loadFedapayConfig();
    expect(cfg).toMatchObject({ secretKey: KEY, webhookSecret: HOOK, env: "sandbox", apiBase: "https://sandbox-api.fedapay.com/v1" });
    expect(await loadWebhookSecret()).toBe(HOOK);
  });
  it("priorité : l'espace admin l'emporte sur l'environnement, secret par secret", async () => {
    vi.stubEnv("FEDAPAY_SECRET_KEY", "sk_sandbox_ENVKEY0000");
    vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", "wh_sandbox_ENVHOOK000");
    expect((await loadFedapayConfig())?.secretKey).toBe("sk_sandbox_ENVKEY0000");
    await saveFedapaySecrets({ webhookSecret: HOOK }); // seul le secret webhook est saisi en admin
    invalidateCredentialsCache();
    const cfg = await loadFedapayConfig();
    expect(cfg?.secretKey).toBe("sk_sandbox_ENVKEY0000");
    expect(cfg?.webhookSecret).toBe(HOOK);
    expect(await fedapayStatus()).toMatchObject({ secretSource: "env", webhookSource: "admin", mode: "sandbox" });
  });
  it("clé sk_live_ → mode réel ; FEDAPAY_ENV ne force pas une clé saisie en admin", async () => {
    vi.stubEnv("FEDAPAY_ENV", "sandbox");
    await saveFedapaySecrets({ secretKey: "sk_live_REALKEY12345" });
    expect((await loadFedapayConfig())?.env).toBe("live");
  });
  it("undefined = inchangé, null = effacé ; le reste de la ligne est conservé", async () => {
    await saveFedapaySecrets({ secretKey: KEY, webhookSecret: HOOK });
    await saveFedapaySecrets({ secretKey: "sk_sandbox_NEWKEY999999" });
    invalidateCredentialsCache();
    expect(await loadWebhookSecret()).toBe(HOOK);
    await saveFedapaySecrets({ webhookSecret: null });
    invalidateCredentialsCache();
    expect(await loadWebhookSecret()).toBeNull();
    expect((await loadFedapayConfig())?.secretKey).toBe("sk_sandbox_NEWKEY999999");
  });
  it("clé de chiffrement changée → les secrets enregistrés sont ignorés, repli sur l'environnement", async () => {
    await saveFedapaySecrets({ secretKey: KEY });
    vi.stubEnv("SETTINGS_ENCRYPTION_KEY", "cle-differente-de-celle-d-origine");
    vi.stubEnv("FEDAPAY_SECRET_KEY", "sk_sandbox_ENVKEY0000");
    invalidateCredentialsCache();
    expect((await loadFedapayConfig())?.secretKey).toBe("sk_sandbox_ENVKEY0000");
  });
  it("sans base : refus propre ; sans clé de chiffrement : refus propre ; rien n'est écrit", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(await saveFedapaySecrets({ secretKey: KEY })).toEqual({ ok: false, code: "unavailable" });
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "courte"); // < 16 caractères : pas de clé de chiffrement dérivable
    expect(await saveFedapaySecrets({ secretKey: KEY })).toEqual({ ok: false, code: "no_encryption" });
    expect(rows.size).toBe(0);
  });
  it("le masque ne révèle que le préfixe de type et 4 caractères", () => {
    expect(maskSecret(KEY)).toBe("sk_sandbox_••••1234");
    expect(maskSecret(null)).toBeNull();
    expect(maskSecret(KEY)).not.toContain("ABCDEFGH");
  });
});

describe("actions admin FedaPay", () => {
  // Module neuf à chaque test : le limiteur de débit des actions (15 / 10 min) repart de zéro.
  const actions = () => {
    vi.resetModules();
    return import("@/app/admin/(panel)/reglages/actions");
  };
  beforeEach(() => assertAdmin.mockResolvedValue({ id: "admin-1", email: "a@b.bj" }));

  it("refusées sans session admin", async () => {
    assertAdmin.mockResolvedValue(null);
    const a = await actions();
    for (const r of [await a.saveFedapayAction({ secretKey: KEY }), await a.clearFedapayAction("all"), await a.testFedapayAction()]) {
      expect(r).toMatchObject({ ok: false, code: "unauthorized" });
    }
    expect(rows.size).toBe(0);
  });
  it("enregistre, ne renvoie JAMAIS le secret en clair", async () => {
    const a = await actions();
    const r = await a.saveFedapayAction({ secretKey: KEY, webhookSecret: HOOK });
    expect(r).toMatchObject({ ok: true, status: { secretSource: "admin", webhookSource: "admin", mode: "sandbox" } });
    expect(JSON.stringify(r)).not.toContain("ABCDEFGH1234");
    expect(JSON.stringify(r)).not.toContain("ZYXWVUTS9876");
  });
  it("format invalide, champs inconnus, rien de saisi → refusés sans écriture", async () => {
    const a = await actions();
    expect(await a.saveFedapayAction({ secretKey: "pk_sandbox_publique1234" })).toMatchObject({ ok: false, fieldErrors: { secretKey: expect.any(String) } });
    expect(await a.saveFedapayAction({ webhookSecret: "sk_sandbox_AAAAAAAAAA" })).toMatchObject({ ok: false, fieldErrors: { webhookSecret: expect.any(String) } });
    expect(await a.saveFedapayAction({ secretKey: KEY, role: "admin" })).toMatchObject({ ok: false, code: "invalid" });
    expect(await a.saveFedapayAction({ secretKey: "", webhookSecret: "" })).toMatchObject({ ok: false, code: "invalid" });
    expect(rows.size).toBe(0);
  });
  it("clé et secret de webhook de modes différents → refusés (aucun paiement ne serait confirmé)", async () => {
    const a = await actions();
    expect(await a.saveFedapayAction({ secretKey: KEY, webhookSecret: "wh_live_REALHOOK12345", confirmLive: true })).toMatchObject({ ok: false, code: "invalid" });
    expect(rows.size).toBe(0);
    await a.saveFedapayAction({ secretKey: KEY });
    expect(await a.saveFedapayAction({ webhookSecret: "wh_live_REALHOOK12345", confirmLive: true })).toMatchObject({ ok: false, code: "invalid" });
  });
  it("une clé RÉELLE exige la confirmation explicite", async () => {
    const a = await actions();
    expect(await a.saveFedapayAction({ secretKey: "sk_live_REALKEY12345" })).toMatchObject({ ok: false, fieldErrors: { confirmLive: expect.any(String) } });
    expect(rows.size).toBe(0);
    expect(await a.saveFedapayAction({ secretKey: "sk_live_REALKEY12345", confirmLive: true })).toMatchObject({ ok: true, status: { mode: "live" } });
  });
  it("clearFedapayAction efface ; mauvais argument refusé", async () => {
    const a = await actions();
    await a.saveFedapayAction({ secretKey: KEY, webhookSecret: HOOK });
    expect(await a.clearFedapayAction("autre chose")).toMatchObject({ ok: false, code: "invalid" });
    expect(await a.clearFedapayAction("all")).toMatchObject({ ok: true, status: { secretSource: "none", webhookSource: "none", mode: null } });
  });
  it("testFedapayAction : aucune clé → invalid ; ok / refusée / injoignable → résultats distincts", async () => {
    const a = await actions();
    expect(await a.testFedapayAction()).toMatchObject({ ok: false, code: "invalid" });
    await a.saveFedapayAction({ secretKey: KEY });
    ping.mockResolvedValueOnce("ok").mockResolvedValueOnce("unauthorized").mockResolvedValueOnce("unreachable");
    expect(await a.testFedapayAction()).toEqual({ ok: true, mode: "sandbox" });
    expect(await a.testFedapayAction()).toMatchObject({ ok: false, code: "invalid" });
    expect(await a.testFedapayAction()).toMatchObject({ ok: false, code: "error" });
  });
  it("sans chiffrement serveur : message clair, rien d'écrit", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "courte");
    const a = await actions();
    const r = await a.saveFedapayAction({ secretKey: KEY });
    expect(r).toMatchObject({ ok: false, code: "error" });
    expect(rows.size).toBe(0);
  });
});
