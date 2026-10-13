// Catalogue public AVANT et APRÈS la migration 0024 : colonne `images` lue si elle existe ; absente (42703) → même lecture
// sans elle, photo unique `image_url`. Les listes ne portent que la couverture, la fiche toutes les photos.
import { beforeEach, describe, expect, it, vi } from "vitest";

const BUCKET = "https://btarkkjimnkmiaxzonzq.supabase.co/storage/v1/object/public/products";
const [A, B, C] = ["a", "b", "c"].map((n) => `${BUCKET}/2026/10/${n}.webp`);

type Mode = "with" | "missing" | "down";
let mode: Mode = "with";
const selects: string[] = [];

const ROW = {
  id: "5b4e688a-1bb0-4e16-aeb8-a933014cd3ac",
  category_id: "maison",
  price: 8900,
  compare_price: null,
  stock: 5,
  sold: 10,
  rating_seed: 0,
  rating_seed_count: 0,
  keyword: "lampe",
  bg: "#F3E3A6",
  image_url: B,
  created_at: "2026-10-01T00:00:00Z",
  product_translations: [{ locale: "fr", name: "Lampe LED", slug: "lampe-led", description: "Rechargeable." }],
};
const NO_PHOTO = { ...ROW, id: "463b673c-890e-4f78-a417-64d42558faf1", image_url: null, product_translations: [{ locale: "fr", name: "Gourde", slug: "gourde", description: "Inox." }] };

function productsResult(columns: string) {
  if (mode === "down") return { data: null, error: { code: "500", message: "boom" } };
  if (columns.includes("images")) {
    if (mode === "missing") return { data: null, error: { code: "42703", message: "column products.images does not exist" } };
    return { data: [{ ...ROW, images: [B, A, C] }, { ...NO_PHOTO, images: [] }], error: null };
  }
  return { data: [ROW, NO_PHOTO], error: null };
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
    Promise.resolve(table === "products" ? productsResult(columns) : { data: [], error: null }).then(ok, ko);
  return q;
};
vi.mock("@/lib/supabase/env", () => ({ supabasePublicEnv: () => ({ url: "https://x.supabase.co", key: "k" }) }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({ from: (t: string) => query(t) }) }));

import { getProductBySlug, getProducts, getRelatedProducts, resetImagesColumnProbe } from "@/lib/catalog";

beforeEach(() => {
  resetImagesColumnProbe();
  selects.length = 0;
});

describe("après 0024 (colonne images présente)", () => {
  it("fiche : toutes les photos dans l'ordre, imageUrl = couverture", async () => {
    mode = "with";
    const p = await getProductBySlug("fr", "lampe-led");
    expect(p?.images).toEqual([B, A, C]);
    expect(p?.imageUrl).toBe(B);
    expect(selects[0]).toContain(",images");
  });
  it("listes : couverture seule (charge utile des pages)", async () => {
    mode = "with";
    const list = await getProducts("fr");
    expect(list.find((p) => p.slug === "lampe-led")?.images).toEqual([B]);
    const fiche = await getProductBySlug("fr", "gourde");
    expect((await getRelatedProducts("fr", fiche!, 4)).every((p) => p.images.length <= 1)).toBe(true);
  });
  it("produit sans photo : images vide, imageUrl null (rendu fond coloré + mot)", async () => {
    mode = "with";
    const p = await getProductBySlug("fr", "gourde");
    expect(p?.images).toEqual([]);
    expect(p?.imageUrl).toBeNull();
  });
});

describe("avant 0024 (colonne images absente)", () => {
  it("repli sur image_url seule, sans erreur", async () => {
    mode = "missing";
    const p = await getProductBySlug("fr", "lampe-led");
    expect(p?.images).toEqual([B]);
    expect(p?.imageUrl).toBe(B);
    expect((await getProductBySlug("fr", "gourde"))?.images).toEqual([]);
    expect(selects.some((s) => !s.includes("images"))).toBe(true);
  });
  it("la colonne manquante n'est pas redemandée à chaque lecture (une seule requête ensuite)", async () => {
    mode = "missing";
    await getProducts("fr");
    const after = selects.length;
    await getProducts("fr");
    expect(selects.length - after).toBe(1);
    expect(selects[selects.length - 1]).not.toContain("images");
  });
  it("une autre erreur reste une erreur (pas de repli silencieux)", async () => {
    mode = "down";
    await expect(getProducts("fr")).rejects.toThrow("catalog_unavailable");
  });
});
