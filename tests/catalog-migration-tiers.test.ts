// Catalogue public selon les migrations appliquées (0024 photos, 0025 rubriques + livraison offerte), dans N'IMPORTE quel
// ordre : une colonne absente (42703) fait passer à la lecture suivante, sans perdre ce qui existe. Cas réel du 2026-10-14 :
// 0025 appliquée en production AVANT 0024 → rubriques et livraison offerte doivent quand même être lues. Les rubriques sont
// lues à part (getProductDetails, fiche seulement) : jamais dans la lecture du catalogue entier (audit Tariq 🟠3).
import { beforeEach, describe, expect, it, vi } from "vitest";

const BUCKET = "https://btarkkjimnkmiaxzonzq.supabase.co/storage/v1/object/public/products";
const [A, B] = ["a", "b"].map((n) => `${BUCKET}/2026/10/${n}.webp`);

let applied = { m0024: true, m0025: true };
const selects: string[] = [];

const TR = { locale: "fr", name: "Gourde", slug: "gourde", description: "Inox." };
const DETAILS = { color: "Noir mat", materials: "", specs: "Contenance : 750 ml", highlights: "", uses: "", care: "" };

function productsResult(columns: string) {
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
        product_translations: [TR],
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

import { getProductBySlug, getProductDetails, getProducts, resetImagesColumnProbe } from "@/lib/catalog";

beforeEach(() => {
  resetImagesColumnProbe();
  selects.length = 0;
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
