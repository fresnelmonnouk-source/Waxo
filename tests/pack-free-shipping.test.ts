// Livraison offerte PAR PACK (0026, décision du 2026-10-14) côté code : lecture boutique et admin des packs avec ou sans la
// colonne `packs.free_shipping` (0026 pas encore appliquée en production au déploiement → case considérée décochée),
// écriture admin (sans 0026 : case décochée enregistrée sans la colonne, case cochée refusée sans rien écrire), et
// `/api/checkout/config` : `free` contient les packs actifs cochés, MASQUÉS COMPRIS (décision V8 « a »).
import { beforeEach, describe, expect, it, vi } from "vitest";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
/** Pack coché, moins cher que ses produits (affiché). */
const PK_ON = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
/** Pack coché mais PAS moins cher que ses produits : masqué par hasRealSaving, toujours commandable. */
const PK_HIDDEN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
/** Pack non coché (affiché) dont tous les produits seraient cochés. */
const PK_OFF = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

type DbErr = { code: string; message: string } | null;
type Write = { table: string; op: "insert" | "update"; values: Record<string, unknown>; filters: Record<string, unknown> };
const state = vi.hoisted(() => ({
  missing0026: false,
  /** Erreur forcée sur la lecture des packs (autre qu'une colonne absente). */
  packsError: null as { code: string; message: string } | null,
  packSelects: [] as string[],
  writes: [] as Write[],
}));

const packRow = (id: string, price: number, free: boolean, slug: string, withFree: boolean) => ({
  id,
  price,
  image_url: null,
  active: true,
  created_at: "2026-10-01T00:00:00Z",
  ...(withFree ? { free_shipping: free } : {}),
  pack_translations: [{ locale: "fr", name: `Pack ${slug}`, slug, description: "Deux produits réunis." }],
  pack_items: [
    { product_id: P1, qty: 1 },
    { product_id: P2, qty: 1 },
  ],
});

/** Faux client Supabase (lecture boutique ET service_role admin) : une table = un constructeur de requête « thenable ». */
function table(name: string) {
  let columns = "";
  let op: "select" | "insert" | "update" = "select";
  let values: Record<string, unknown> = {};
  const filters: Record<string, unknown> = {};
  const b: Record<string, unknown> = {};
  const result = (): { data: unknown; error: DbErr } => {
    if (op !== "select") {
      if (name === "packs" && state.missing0026 && "free_shipping" in values)
        return { data: null, error: { code: "PGRST204", message: "Could not find the 'free_shipping' column of 'packs' in the schema cache" } };
      state.writes.push({ table: name, op, values, filters: { ...filters } });
      return { data: op === "insert" ? { id: PK_ON } : null, error: null };
    }
    if (name === "packs") {
      state.packSelects.push(columns);
      if (state.packsError) return { data: null, error: state.packsError };
      if ("id" in filters) {
        // Lecture de l'état courant avant une modification (updatePack).
        return { data: { id: filters.id, image_url: null, pack_translations: [{ locale: "fr" }], pack_items: [{ product_id: P1 }, { product_id: P2 }] }, error: null };
      }
      const withFree = /\bfree_shipping\b/.test(columns);
      if (state.missing0026 && withFree) return { data: null, error: { code: "42703", message: "column packs.free_shipping does not exist" } };
      return {
        data: [
          packRow(PK_ON, 4000, true, "pack-on", withFree),
          packRow(PK_HIDDEN, 6000, true, "pack-hidden", withFree),
          packRow(PK_OFF, 4500, false, "pack-off", withFree),
        ],
        error: null,
      };
    }
    if (name === "products") return { data: [{ id: P1 }, { id: P2 }], error: null };
    return { data: null, error: null };
  };
  for (const m of ["order", "range", "in", "like", "limit", "single", "maybeSingle", "upsert", "delete"]) b[m] = () => b;
  b.eq = (k: string, v: unknown) => {
    filters[k] = v;
    return b;
  };
  b.select = (c: string) => {
    if (op === "select") columns = c;
    return b;
  };
  b.insert = (v: Record<string, unknown>) => {
    op = "insert";
    values = v;
    return b;
  };
  b.update = (v: Record<string, unknown>) => {
    op = "update";
    values = v;
    return b;
  };
  b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(result()).then(ok, ko);
  return b;
}

const product = (id: string, price: number) => ({ id, slug: id.slice(0, 4), name: `Produit ${price}`, price, stock: 9, keyword: "x", bg: null, imageUrl: null, freeShipping: false });

vi.mock("@/lib/supabase/env", () => ({ supabasePublicEnv: () => ({ url: "https://x.supabase.co", key: "k" }) }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({ from: (t: string) => table(t) }) }));
vi.mock("@/lib/catalog", () => ({
  getProducts: async () => [product(P1, 3000), product(P2, 2000)],
  getSettings: async () => ({ shipping: { cotonou: 1000, autre: 2500, freeFrom: 15000, cutoff: 20, returnDays: 7 }, pay: { cod: true }, features: {} }),
  isBuildPhase: () => false,
  slugForLocale: () => null,
}));
vi.mock("@/lib/payment/ready", () => ({ onlinePaymentReady: async () => false }));
vi.mock("@/lib/admin/guard", () => ({ assertAdmin: async () => ({ id: "a", email: "a@b.c" }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/admin/data/products", () => ({
  ADMIN_LIST_LIMIT: 200,
  adminDb: () => ({ from: (t: string) => table(t) }),
  withTimeout: <T,>(p: PromiseLike<T>) => Promise.resolve(p),
  takenSlugs: async () => new Set<string>(),
}));

import { getAllPacks, getPacks, resetPackColumnProbe } from "@/lib/catalog/packs";
import { getAdminPacks } from "@/lib/admin/data/packs";
import { createPack, updatePack } from "@/app/admin/(panel)/packs/actions";
import { GET as getConfig } from "@/app/api/checkout/config/route";
import type { PackFormValues } from "@/components/admin/products/types";

beforeEach(() => {
  state.missing0026 = false;
  state.packsError = null;
  state.packSelects.length = 0;
  state.writes.length = 0;
  resetPackColumnProbe();
});

describe("lecture boutique des packs (0026)", () => {
  it("0026 appliquée : case du pack lue, une seule requête", async () => {
    const all = await getAllPacks("fr");
    expect(Object.fromEntries(all.map((k) => [k.id, k.freeShipping]))).toEqual({ [PK_ON]: true, [PK_HIDDEN]: true, [PK_OFF]: false });
    expect(state.packSelects).toHaveLength(1);
    expect(state.packSelects[0]).toMatch(/free_shipping/);
  });
  it("getPacks masque le pack sans économie, getAllPacks le garde (V8)", async () => {
    expect((await getPacks("fr")).map((k) => k.id)).toEqual([PK_ON, PK_OFF]);
    expect((await getAllPacks("fr")).map((k) => k.id)).toEqual([PK_ON, PK_HIDDEN, PK_OFF]);
  });
  it("0026 absente : relecture sans la colonne, tous les packs décochés (frais affichés), puis plus de nouvel essai", async () => {
    state.missing0026 = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const all = await getAllPacks("fr");
    expect(all).toHaveLength(3);
    expect(all.every((k) => k.freeShipping === false)).toBe(true);
    expect(state.packSelects).toHaveLength(2);
    expect(warn).toHaveBeenCalledTimes(1);
    await getAllPacks("fr");
    expect(state.packSelects).toHaveLength(3); // mémorisé : directement la lecture de repli
    warn.mockRestore();
  });
  it("erreur autre qu'une colonne absente : exception, aucun repli", async () => {
    state.packsError = { code: "57014", message: "canceling statement due to statement timeout" };
    await expect(getAllPacks("fr")).rejects.toThrow("packs_unavailable");
    expect(state.packSelects).toHaveLength(1);
  });
});

describe("GET /api/checkout/config — packs « livraison offerte »", () => {
  const get = async (ids: string[]) =>
    (await (await getConfig(new Request(`http://localhost/api/checkout/config?lang=fr&ids=${ids.join(",")}`))).json()) as {
      ok: boolean;
      free: string[];
      stock: Record<string, number>;
    };
  it("free = packs actifs cochés du panier, masqués compris ; pack non coché et produits non cochés absents", async () => {
    const r = await get([PK_ON, PK_HIDDEN, PK_OFF, P1]);
    expect(r.ok).toBe(true);
    expect([...r.free].sort()).toEqual([PK_ON, PK_HIDDEN].sort());
    // Le reste ne change pas : le pack masqué n'a ni stock ni prix renvoyés (comme avant).
    expect(r.stock[PK_ON]).toBeDefined();
    expect(r.stock[PK_HIDDEN]).toBeUndefined();
  });
  it("0026 absente : aucun pack dans free (le site affiche les frais, choix prudent)", async () => {
    state.missing0026 = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await get([PK_ON, PK_HIDDEN])).free).toEqual([]);
    warn.mockRestore();
  });
});

describe("admin — lecture des packs", () => {
  it("0026 appliquée : case lue, colonne signalée présente", async () => {
    const d = await getAdminPacks();
    expect(d.source).toBe("db");
    expect(d.freeShippingColumn).toBe(true);
    expect(d.packs.find((k) => k.id === PK_ON)?.freeShipping).toBe(true);
    expect(d.packs.find((k) => k.id === PK_OFF)?.freeShipping).toBe(false);
  });
  it("0026 absente : liste lue quand même, cases décochées, colonne signalée absente", async () => {
    state.missing0026 = true;
    const d = await getAdminPacks();
    expect(d.source).toBe("db");
    expect(d.freeShippingColumn).toBe(false);
    expect(d.packs).toHaveLength(3);
    expect(d.packs.every((k) => k.freeShipping === false)).toBe(true);
  });
  it("erreur autre qu'une colonne absente : source « error » (pas de fausse liste)", async () => {
    state.packsError = { code: "57014", message: "timeout" };
    expect((await getAdminPacks()).source).toBe("error");
  });
});

describe("admin — écriture d'un pack", () => {
  const form = (over: Partial<PackFormValues> = {}): PackFormValues => ({
    name: "Pack Maison",
    nameEn: "",
    description: "Les indispensables de la maison.",
    descriptionEn: "",
    price: "4000",
    active: true,
    imageUrl: null,
    items: [
      { productId: P1, qty: 1 },
      { productId: P2, qty: 1 },
    ],
    freeShipping: false,
    ...over,
  });
  const packWrites = () => state.writes.filter((w) => w.table === "packs");

  it("0026 appliquée : la case est écrite (création et modification)", async () => {
    expect(await createPack(form({ freeShipping: true }))).toEqual({ ok: true, id: PK_ON });
    expect(packWrites()[0].values).toMatchObject({ price: 4000, free_shipping: true });
    expect(await updatePack(PK_ON, form({ freeShipping: false }))).toEqual({ ok: true });
    expect(packWrites()[1]).toMatchObject({ op: "update", values: { free_shipping: false }, filters: { id: PK_ON } });
  });
  it("0026 absente + case décochée : enregistré sans la colonne", async () => {
    state.missing0026 = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await createPack(form())).toEqual({ ok: true, id: PK_ON });
    expect(packWrites()).toHaveLength(1);
    expect(packWrites()[0].values).not.toHaveProperty("free_shipping");
    expect(await updatePack(PK_ON, form())).toEqual({ ok: true });
    expect(packWrites()[1].values).not.toHaveProperty("free_shipping");
    warn.mockRestore();
  });
  it("0026 absente + case cochée : refus clair « Exécutez d'abord le SQL 0026 », rien d'écrit", async () => {
    state.missing0026 = true;
    const created = await createPack(form({ freeShipping: true }));
    expect(created).toMatchObject({ ok: false, code: "invalid" });
    expect(created.ok ? "" : created.message).toMatch(/Exécutez d'abord le SQL 0026/);
    const updated = await updatePack(PK_ON, form({ freeShipping: true }));
    expect(updated).toMatchObject({ ok: false, code: "invalid", fields: { freeShipping: expect.stringMatching(/0026/) } });
    expect(state.writes).toEqual([]); // ni pack, ni traduction, ni contenu
  });
});
