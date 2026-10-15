// Catalogue public selon les migrations appliquées (0024 photos, 0025 rubriques + livraison offerte), dans N'IMPORTE quel
// ordre : une colonne absente (42703) fait passer à la lecture suivante, sans perdre ce qui existe. Cas réel du 2026-10-14 :
// 0025 appliquée en production AVANT 0024 → rubriques et livraison offerte doivent quand même être lues. Les rubriques sont
// lues à part (getProductDetails, fiche seulement) : jamais dans la lecture du catalogue entier (audit Tariq 🟠3).
// Même chose pour la lecture ADMIN (ADMIN_TIERS, audit Victor V2) ; une erreur qui n'est PAS une colonne absente ne doit
// jamais faire passer au palier suivant (audit Tariq 🟡10) : boutique → exception, admin → source « error ».
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const BUCKET = "https://btarkkjimnkmiaxzonzq.supabase.co/storage/v1/object/public/products";
const [A, B] = ["a", "b"].map((n) => `${BUCKET}/2026/10/${n}.webp`);

let applied = { m0024: true, m0025: true };
/** Erreur forcée sur la lecture des produits, autre qu'une colonne absente (délai dépassé, droits…). */
let failWith: { code: string; message: string } | null = null;
const selects: string[] = [];

const TR = { locale: "fr", name: "Gourde", slug: "gourde", description: "Inox." };
const DETAILS = { color: "Noir mat", materials: "", specs: "Contenance : 750 ml", highlights: "", uses: "", care: "" };

function productsResult(columns: string) {
  if (failWith) return { data: null, error: failWith };
  const missing = (!applied.m0024 && /\bimages\b/.test(columns)) || (!applied.m0025 && /free_shipping/.test(columns));
  if (missing) return { data: null, error: { code: "42703", message: "column does not exist" } };
  return {
    data: [
      {
        id: "5b4e688a-1bb0-4e16-aeb8-a933014cd3ac",
        category_id: "cuisine",
        price: 5000,
        compare_price: null,
        stock: 5,
        sold: 1,
        rating_seed: 0,
        rating_seed_count: 0,
        keyword: "gourde",
        bg: "#F3E3A6",
        image_url: A,
        created_at: "2026-10-01T00:00:00Z",
        ...(columns.includes("images") ? { images: [A, B] } : {}),
        ...(columns.includes("free_shipping") ? { free_shipping: true } : {}),
        // Lecture admin : rubriques demandées dans la traduction (palier 0025).
        product_translations: [columns.includes("color") ? { ...TR, ...DETAILS } : TR],
      },
    ],
    error: null,
  };
}

function translationsResult(columns: string) {
  if (!applied.m0025) return { data: null, error: { code: "42703", message: "column product_translations.color does not exist" } };
  expect(columns).toContain("color");
  return { data: [{ locale: "fr", ...DETAILS }, { locale: "en", ...DETAILS, color: "Matte black", specs: "" }], error: null };
}

const query = (table: string) => {
  let columns = "";
  const q: Record<string, unknown> = {};
  for (const m of ["eq", "gt", "order", "in", "limit", "range", "maybeSingle"]) q[m] = () => q;
  q.select = (c: string) => {
    columns = c;
    if (table === "products") selects.push(c);
    return q;
  };
  q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
    Promise.resolve(
      table === "products"
        ? productsResult(columns)
        : table === "product_translations"
          ? translationsResult(columns)
          : { data: [], error: null },
    ).then(ok, ko);
  return q;
};
vi.mock("@/lib/supabase/env", () => ({ supabasePublicEnv: () => ({ url: "https://x.supabase.co", key: "k" }) }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({ from: (t: string) => query(t) }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (t: string) => query(t) }) }));

import { getProductBySlug, getProductDetails, getProducts, resetImagesColumnProbe } from "@/lib/catalog";
import { getAdminProducts } from "@/lib/admin/data/products";

beforeEach(() => {
  resetImagesColumnProbe();
  selects.length = 0;
  failWith = null;
});

describe("lecture du catalogue selon les migrations appliquées", () => {
  it("0024 + 0025 : photos, rubriques et livraison offerte, en une seule requête", async () => {
    applied = { m0024: true, m0025: true };
    const p = await getProductBySlug("fr", "gourde");
    expect(p?.images).toEqual([A, B]);
    expect(p?.freeShipping).toBe(true);
    expect(selects).toHaveLength(1);
    expect(selects[0]).not.toMatch(/color|specs|care/); // rubriques jamais dans la lecture du catalogue
    expect((await getProductDetails(p!.id, "fr")).color).toBe("Noir mat");
  });
  it("rubriques : langue demandée, repli FR rubrique par rubrique", async () => {
    applied = { m0024: true, m0025: true };
    const en = await getProductDetails("5b4e688a-1bb0-4e16-aeb8-a933014cd3ac", "en");
    expect(en.color).toBe("Matte black");
    expect(en.specs).toBe("Contenance : 750 ml");
  });
  it("listes : livraison offerte présente (estimation du panier)", async () => {
    applied = { m0024: true, m0025: true };
    expect((await getProducts("fr"))[0].freeShipping).toBe(true);
  });
  it("0025 sans 0024 (production au 2026-10-14) : rubriques et livraison offerte lues, photo unique", async () => {
    applied = { m0024: false, m0025: true };
    const p = await getProductBySlug("fr", "gourde");
    expect(p?.freeShipping).toBe(true);
    expect((await getProductDetails(p!.id, "fr")).specs).toBe("Contenance : 750 ml");
    expect(p?.images).toEqual([A]);
  });
  it("0024 sans 0025 : photos lues, pas de livraison offerte ni de rubrique", async () => {
    applied = { m0024: true, m0025: false };
    const p = await getProductBySlug("fr", "gourde");
    expect(p?.images).toEqual([A, B]);
    expect(p?.freeShipping).toBe(false);
    expect((await getProductDetails(p!.id, "fr")).color).toBe(""); // colonnes absentes : rubriques vides, fiche intacte
  });
  it("aucune des deux : lecture d'origine", async () => {
    applied = { m0024: false, m0025: false };
    const p = await getProductBySlug("fr", "gourde");
    expect(p?.images).toEqual([A]);
    expect(p?.freeShipping).toBe(false);
  });
});

describe("palier 0 en erreur qui n'est PAS une colonne absente (Tariq 🟡10)", () => {
  it("boutique : exception catalog_unavailable, aucun palier de repli essayé", async () => {
    applied = { m0024: true, m0025: true };
    failWith = { code: "57014", message: "canceling statement due to statement timeout" };
    await expect(getProducts("fr")).rejects.toThrow("catalog_unavailable");
    expect(selects).toHaveLength(1);
  });
});

describe("lecture ADMIN des produits selon les migrations appliquées (ADMIN_TIERS, Victor V2)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-for-tests-0123456789");
  });
  afterEach(() => vi.unstubAllEnvs());

  const cases = [
    { m0024: true, m0025: true, imagesColumn: true, detailsColumns: true, reads: 1 },
    { m0024: false, m0025: true, imagesColumn: false, detailsColumns: true, reads: 2 }, // production au 2026-10-14
    { m0024: true, m0025: false, imagesColumn: true, detailsColumns: false, reads: 3 },
    { m0024: false, m0025: false, imagesColumn: false, detailsColumns: false, reads: 4 },
  ];
  for (const c of cases) {
    it(`0024 ${c.m0024 ? "oui" : "non"} / 0025 ${c.m0025 ? "oui" : "non"} → imagesColumn=${c.imagesColumn}, detailsColumns=${c.detailsColumns}`, async () => {
      applied = { m0024: c.m0024, m0025: c.m0025 };
      const d = await getAdminProducts();
      expect(d.source).toBe("db");
      expect({ imagesColumn: d.imagesColumn, detailsColumns: d.detailsColumns }).toEqual({ imagesColumn: c.imagesColumn, detailsColumns: c.detailsColumns });
      expect(selects).toHaveLength(c.reads);
      const p = d.products[0];
      expect(p.images).toEqual(c.m0024 ? [A, B] : [A]);
      expect(p.freeShipping).toBe(c.m0025);
      expect(p.details.fr.color).toBe(c.m0025 ? "Noir mat" : "");
    });
  }
  it("erreur qui n'est pas une colonne absente : source « error », aucun palier de repli", async () => {
    applied = { m0024: true, m0025: true };
    failWith = { code: "42501", message: "permission denied for table products" };
    const d = await getAdminProducts();
    expect(d.source).toBe("error");
    expect(d.products).toEqual([]);
    expect(selects).toHaveLength(1);
  });
});
