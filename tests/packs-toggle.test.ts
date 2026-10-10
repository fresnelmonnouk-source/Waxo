import { beforeEach, describe, expect, it, vi } from "vitest";

// Bouton « Afficher le menu Packs » (Admin → Packs) : réglage public settings.features.packs.
const packsEnabled = vi.hoisted(() => ({ value: true }));
const settingsRows = vi.hoisted(() => new Map<string, unknown>());
const assertAdmin = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/catalog/packs", () => ({
  getPacksEnabled: async () => packsEnabled.value,
  getPacks: async () => [{ id: "pk-1", slug: "pack-cuisine", stock: 4 }],
}));
vi.mock("@/lib/catalog", () => ({
  getSettings: async () => ({
    brand: {},
    shipping: { cotonou: 1000, autre: 2500, freeFrom: 15000, cutoff: 18, returnDays: 7 },
    pay: { cod: true },
    features: { packs: packsEnabled.value },
  }),
  getProducts: async () => [{ id: "p-1", slug: "a", name: "A", price: 5000, stock: 3, bg: null, imageUrl: null }],
}));
vi.mock("@/lib/admin/guard", () => ({ assertAdmin: () => assertAdmin(), requireAdmin: () => assertAdmin() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/env", () => ({ supabasePublicEnv: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createSessionClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc,
    from: () => ({
      select: () => ({ eq: (_c: string, key: string) => ({ maybeSingle: async () => ({ data: settingsRows.has(key) ? { value: settingsRows.get(key) } : null, error: null }) }) }),
      upsert: async (row: { key: string; value: unknown; is_public: boolean }) => {
        settingsRows.set(row.key, { ...(row.value as object), __public: row.is_public });
        return { error: null };
      },
    }),
  }),
}));
vi.mock("@/lib/payment", () => ({ getPaymentProvider: async () => ({ name: "test", createCheckout: vi.fn() }) }));
vi.mock("@/lib/email", () => ({ sendOrderEmail: vi.fn() }));

import { buildSitemap } from "@/lib/seo/sitemap-build";

const UUID = "3f2b8c1e-5a47-4d9a-9b1e-7c2d4e6f8a10";

beforeEach(() => {
  packsEnabled.value = true;
  settingsRows.clear();
  assertAdmin.mockReset();
  rpc.mockReset();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-for-tests-0123456789");
});

describe("sitemap", () => {
  const BASE = "https://exemple.test";
  const packs = [{ id: "k1", slugs: { fr: "pack-cuisine", en: "kitchen-pack" } }];
  it("packs activés : page /packs et fiches présentes", () => {
    const urls = buildSitemap([], BASE, packs).map((e) => e.url);
    expect(urls).toContain(`${BASE}/fr/packs`);
    expect(urls).toContain(`${BASE}/fr/packs/pack-cuisine`);
  });
  it("packs désactivés : plus aucune URL /packs, le reste est inchangé", () => {
    const off = buildSitemap([], BASE, packs, { packsEnabled: false }).map((e) => e.url);
    expect(off.some((u) => u.includes("/packs"))).toBe(false);
    expect(off).toContain(`${BASE}/fr/catalogue`);
  });
});

describe("GET /api/checkout/config", () => {
  const get = async (ids: string) => {
    const { GET } = await import("@/app/api/checkout/config/route");
    return (await GET(new Request(`http://localhost/api/checkout/config?lang=fr&ids=${ids}`))).json() as Promise<Record<string, unknown>>;
  };
  it("packs activés : stock du pack renvoyé, packsEnabled = true", async () => {
    expect(await get("pk-1,p-1")).toMatchObject({ ok: true, packsEnabled: true, stock: { "pk-1": 4, "p-1": 3 } });
  });
  it("packs désactivés : packsEnabled = false et aucun stock de pack (le navigateur retire ces lignes)", async () => {
    packsEnabled.value = false;
    const r = await get("pk-1,p-1");
    expect(r).toMatchObject({ ok: true, packsEnabled: false });
    expect((r.stock as Record<string, number>)["pk-1"]).toBeUndefined();
    expect((r.stock as Record<string, number>)["p-1"]).toBe(3);
  });
});

describe("POST /api/checkout avec packs désactivés", () => {
  const body = (items: unknown[]) => ({
    items,
    customer: { name: "Afi Houngbédji", phone: "01 97 00 00 00", address: "Fidjrossè, portail bleu" },
    zone: "cotonou",
    pay: "cod",
    lang: "fr",
    website: "",
    t: Date.now() - 10_000,
  });
  const send = async (items: unknown[], ip: string) => {
    const { POST } = await import("@/app/api/checkout/route");
    const res = await POST(new Request("http://localhost/api/checkout", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body(items)) }));
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  };
  it("un pack dans le panier est refusé (cart_invalid), aucune commande créée", async () => {
    packsEnabled.value = false;
    const r = await send([{ kind: "pack", id: UUID, qty: 1 }], "5.5.5.1");
    expect(r.json).toMatchObject({ ok: false, code: "cart_invalid" });
    expect(rpc.mock.calls.some((c) => c[0] === "place_order")).toBe(false);
  });
  it("un panier de produits seuls n'est pas concerné par le réglage", async () => {
    packsEnabled.value = false;
    rpc.mockImplementation(async (name: string) => (name === "rate_hit" ? { data: true, error: null } : { data: [{ order_id: "o-1", order_number: "WX-10263", subtotal: 5000, shipping_fee: 1000, total: 6000 }], error: null }));
    const r = await send([{ kind: "product", id: UUID, qty: 1 }], "5.5.5.2");
    expect(r.status).toBe(200);
    expect(rpc.mock.calls.filter((c) => c[0] === "place_order")).toHaveLength(1);
  });
});

describe("action admin setPacksMenuEnabled", () => {
  const act = async () => {
    vi.resetModules();
    return import("@/app/admin/(panel)/packs/actions");
  };
  it("refusée sans session admin, rien d'écrit", async () => {
    assertAdmin.mockResolvedValue(null);
    expect(await (await act()).setPacksMenuEnabled(false)).toMatchObject({ ok: false, code: "unauthorized" });
    expect(settingsRows.size).toBe(0);
  });
  it("écrit un réglage PUBLIC et conserve les autres clés de la ligne", async () => {
    assertAdmin.mockResolvedValue({ id: "a", email: "a@b.bj" });
    settingsRows.set("features", { autre: 1 });
    const a = await act();
    expect(await a.setPacksMenuEnabled(false)).toEqual({ ok: true });
    expect(settingsRows.get("features")).toMatchObject({ packs: false, autre: 1, __public: true });
    expect(await a.setPacksMenuEnabled(true)).toEqual({ ok: true });
    expect(settingsRows.get("features")).toMatchObject({ packs: true, autre: 1 });
  });
  it("argument invalide refusé", async () => {
    assertAdmin.mockResolvedValue({ id: "a", email: "a@b.bj" });
    const a = await act();
    expect(await a.setPacksMenuEnabled("non" as unknown as boolean)).toMatchObject({ ok: false, code: "invalid" });
    expect(settingsRows.size).toBe(0);
  });
});
