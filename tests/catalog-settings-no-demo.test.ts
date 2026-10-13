// Base branchée (décision D6, audit S7 / E1 du 2026-10-12) : réglages et rayons jamais remplacés par la démo ou par des
// coordonnées factices ; base en erreur = exception (l'ISR garde la page en cache), sauf pendant le build. Avis agrégés
// sans troncature, slugs par langue (redirection 308, hreflang), `lastmod` tolérant, sitemap.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown; error: unknown };
const tables = vi.hoisted(() => ({ handlers: new Map<string, (q: { range?: [number, number]; select?: string }) => Result>() }));
const query = (table: string) => {
  const state: { range?: [number, number]; select?: string } = {};
  const q: Record<string, unknown> = {};
  for (const m of ["eq", "gt", "order", "in", "limit", "maybeSingle"]) q[m] = () => q;
  q.select = (s: string) => ((state.select = s), q);
  q.range = (a: number, b: number) => ((state.range = [a, b]), q);
  q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
    Promise.resolve()
      .then(() => (tables.handlers.get(table) ?? (() => ({ data: [], error: null })))(state))
      .then(ok, ko);
  return q;
};
vi.mock("@/lib/supabase/env", () => ({ supabasePublicEnv: () => ({ url: "https://x.supabase.co", key: "k" }) }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({ from: (t: string) => query(t) }) }));

import {
  BLANK_SETTINGS,
  DEFAULT_SETTINGS,
  findProductSlug,
  getCategories,
  getProductSlugs,
  getProducts,
  getProductsUpdatedAt,
  getRealRating,
  getSettings,
  slugForLocale,
} from "@/lib/catalog";
import { findPackSlug } from "@/lib/catalog/packs";

const fail = () => ({ data: null, error: { code: "500" } });
const row = (id: string, tr: { locale: string; slug: string; name: string }[], seed = 0, seedCount = 0) => ({
  id,
  category_id: "cuisine",
  price: 2500,
  compare_price: null,
  stock: 3,
  sold: 0,
  rating_seed: seed,
  rating_seed_count: seedCount,
  keyword: "",
  bg: null,
  image_url: null,
  created_at: "2026-10-01T00:00:00Z",
  product_translations: tr.map((t) => ({ ...t, description: "" })),
});

beforeEach(() => {
  tables.handlers.clear();
  vi.unstubAllEnvs();
});

describe("réglages : jamais de coordonnées factices", () => {
  it("base en erreur → exception (pas de DEFAULT_SETTINGS)", async () => {
    tables.handlers.set("settings", fail);
    await expect(getSettings()).rejects.toThrow("settings_unavailable");
  });
  it("pendant le build → réglages neutres, coordonnées VIDES", async () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    tables.handlers.set("settings", fail);
    const s = await getSettings();
    expect(s).toEqual(BLANK_SETTINGS);
    expect(s.brand.waNumber).toBe("");
    expect(s.brand.email).toBe("");
  });
  it("base sans ligne de réglages → coordonnées vides, jamais celles de la démo", async () => {
    tables.handlers.set("settings", () => ({ data: [], error: null }));
    const s = await getSettings();
    expect(s.brand.whatsapp).toBe("");
    expect(s.brand.waNumber).not.toBe(DEFAULT_SETTINGS.brand.waNumber);
    expect(s.features.packs).toBe(true);
  });
  it("réglages de la base appliqués", async () => {
    tables.handlers.set("settings", () => ({
      data: [
        { key: "brand", value: { whatsapp: "+229 01 97 00 00 00", waNumber: "2290197000000", email: "bonjour@waxo.boutique" } },
        { key: "features", value: { packs: false } },
      ],
      error: null,
    }));
    const s = await getSettings();
    expect(s.brand).toMatchObject({ waNumber: "2290197000000", email: "bonjour@waxo.boutique", shopName: "Wá xɔ" });
    expect(s.features.packs).toBe(false);
  });
});

describe("rayons : jamais les rayons de démo", () => {
  it("base vide → aucun rayon", async () => {
    tables.handlers.set("categories", () => ({ data: [], error: null }));
    expect(await getCategories("fr")).toEqual([]);
  });
  it("base en erreur → exception ; pendant le build → liste vide", async () => {
    tables.handlers.set("categories", fail);
    await expect(getCategories("fr")).rejects.toThrow("categories_unavailable");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    expect(await getCategories("en")).toEqual([]);
  });
});

describe("avis : agrégat complet, sans note de départ dans les données structurées", () => {
  it("plus de 1 000 avis : toutes les pages sont lues (pas de troncature silencieuse)", async () => {
    const all = Array.from({ length: 2500 }, (_, i) => ({ id: `r${i}`, product_id: "p1", rating: i < 2000 ? 5 : 1 }));
    const ranges: [number, number][] = [];
    tables.handlers.set("reviews", ({ range }) => {
      ranges.push(range!);
      return { data: all.slice(range![0], range![1] + 1), error: null };
    });
    tables.handlers.set("products", () => ({ data: [row("p1", [{ locale: "fr", slug: "savon", name: "Savon" }], 3, 10)], error: null }));
    expect(await getRealRating("p1")).toEqual({ average: 4.2, count: 2500 });
    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    // La note affichée mélange note de départ et vrais avis ; la note des données structurées, jamais.
    const [p] = await getProducts("fr");
    expect(p.rating.count).toBe(2510);
  });
  it("aucun vrai avis → note vide (pas d'aggregateRating), même avec une note de départ", async () => {
    tables.handlers.set("products", () => ({ data: [row("p1", [{ locale: "fr", slug: "savon", name: "Savon" }], 4.8, 30)], error: null }));
    expect(await getRealRating("p1")).toEqual({ average: 0, count: 0 });
  });
});

describe("slugs par langue (308 et hreflang)", () => {
  beforeEach(() => {
    tables.handlers.set("products", () => ({
      data: [
        row("p1", [
          { locale: "fr", slug: "savon-noir", name: "Savon noir" },
          { locale: "en", slug: "black-soap", name: "Black soap" },
        ]),
        row("p2", [{ locale: "fr", slug: "gourde", name: "Gourde" }]),
      ],
      error: null,
    }));
  });
  it("slug FR demandé en anglais → slug EN ; slug EN demandé en français → slug FR", async () => {
    expect(await findProductSlug("en", "savon-noir")).toBe("black-soap");
    expect(await findProductSlug("fr", "black-soap")).toBe("savon-noir");
  });
  it("déjà le bon slug, ou slug inconnu → pas de redirection (jamais de boucle)", async () => {
    expect(await findProductSlug("en", "black-soap")).toBeNull();
    expect(await findProductSlug("en", "gourde")).toBeNull(); // sans texte EN : même slug, la page existe déjà
    expect(await findProductSlug("fr", "inconnu")).toBeNull();
  });
  it("sans texte anglais : pas de slug EN (pas d'alternate EN)", async () => {
    const slugs = await getProductSlugs();
    expect(slugs.get("p1")).toEqual({ fr: "savon-noir", en: "black-soap" });
    expect(slugs.get("p2")).toEqual({ fr: "gourde" });
  });
  it("slugForLocale : règle pure", () => {
    const map = new Map([["k", { fr: "pack-cuisine", en: "kitchen-pack" }]]);
    expect(slugForLocale(map, "en", "pack-cuisine")).toBe("kitchen-pack");
    expect(slugForLocale(map, "fr", "pack-cuisine")).toBeNull();
  });
  it("packs : même règle", async () => {
    tables.handlers.set("packs", () => ({
      data: [{ id: "k1", price: 8900, image_url: null, created_at: "", pack_translations: [{ locale: "fr", slug: "pack-cuisine", name: "P", description: "" }, { locale: "en", slug: "kitchen-pack", name: "P", description: "" }], pack_items: [] }],
      error: null,
    }));
    expect(await findPackSlug("fr", "kitchen-pack")).toBe("pack-cuisine");
  });
});

describe("lastmod : colonne updated_at tolérée absente", () => {
  it("colonne absente (0019 pas appliquée) → aucune date, sans erreur", async () => {
    tables.handlers.set("products", () => ({ data: null, error: { code: "42703", message: "column products.updated_at does not exist" } }));
    expect((await getProductsUpdatedAt()).size).toBe(0);
  });
  it("colonne présente → dates par produit", async () => {
    tables.handlers.set("products", () => ({ data: [{ id: "p1", updated_at: "2026-10-12T10:00:00Z" }, { id: "p2", updated_at: null }], error: null }));
    expect(Object.fromEntries(await getProductsUpdatedAt())).toEqual({ p1: "2026-10-12T10:00:00Z" });
  });
});
