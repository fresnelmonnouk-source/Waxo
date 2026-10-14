// Server actions produits et migration 0025 (audit Victor V2, 2026-10-14) : rubriques écrites dans les traductions,
// livraison offerte écrite dans products ; 0025 absente → enregistrement sans ces champs s'ils sont vides, message clair
// sinon ; 0024 ET 0025 absentes → les deux replis s'enchaînent. Stock : jamais réécrit s'il n'a pas été modifié, et
// conflit si une vente l'a changé pendant l'édition (audit Tariq 🟠4).
import { beforeEach, describe, expect, it, vi } from "vitest";

type Write = { table: string; op: "insert" | "update"; values: Record<string, unknown>; filters: Record<string, unknown> };
const state = vi.hoisted(() => ({
  missing0024: false,
  missing0025: false,
  dbStock: 5,
  writes: [] as Write[],
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/admin/guard", () => ({ assertAdmin: async () => ({ id: "a", email: "a@b.c" }) }));
vi.mock("@/lib/admin/data/products", () => {
  const table = (name: string) => {
    let columns = "";
    let pending: { op: "insert" | "update"; values: Record<string, unknown> } | null = null;
    const filters: Record<string, unknown> = {};
    const b: Record<string, unknown> = {};
    const result = () => {
      if (pending) {
        const v = pending.values;
        if (name === "products" && state.missing0025 && "free_shipping" in v)
          return { data: null, error: { code: "PGRST204", message: "Could not find the 'free_shipping' column of 'products' in the schema cache" } };
        if (name === "products" && state.missing0024 && "images" in v)
          return { data: null, error: { code: "PGRST204", message: "Could not find the 'images' column of 'products' in the schema cache" } };
        if (name === "product_translations" && state.missing0025 && "color" in v)
          return { data: null, error: { code: "PGRST204", message: "Could not find the 'color' column of 'product_translations' in the schema cache" } };
        // Écriture conditionnelle du stock : aucune ligne si le stock en base a changé.
        if (name === "products" && pending.op === "update" && "stock" in filters && filters.stock !== state.dbStock) return { data: [], error: null };
        state.writes.push({ table: name, op: pending.op, values: v, filters: { ...filters } });
        const row = { id: "11111111-1111-4111-8111-111111111111" };
        return { data: pending.op === "update" ? [row] : row, error: null };
      }
      if (name === "products") {
        if (state.missing0024 && columns.includes("images")) return { data: null, error: { code: "42703", message: "column products.images does not exist" } };
        return { data: { id: "x", image_url: null, ...(state.missing0024 ? {} : { images: [] }), product_translations: [{ locale: "fr" }] }, error: null };
      }
      return { data: null, error: null };
    };
    b.eq = (k: string, v: unknown) => {
      filters[k] = v;
      return b;
    };
    for (const m of ["single", "maybeSingle", "like", "limit", "upsert", "delete"]) b[m] = () => b;
    b.select = (c: string) => {
      columns = c;
      return b;
    };
    b.insert = (values: Record<string, unknown>) => {
      pending = { op: "insert", values };
      return b;
    };
    b.update = (values: Record<string, unknown>) => {
      pending = { op: "update", values };
      return b;
    };
    b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(result()).then(ok, ko);
    return b;
  };
  return { adminDb: () => ({ from: table }), takenSlugs: async () => new Set<string>() };
});

import { createProduct, updateProduct } from "@/app/admin/(panel)/produits/actions";
import type { ProductFormValues } from "@/components/admin/products/types";
import { EMPTY_DETAILS } from "@/lib/catalog/details";

const ID = "5b4e688a-1bb0-4e16-aeb8-a933014cd3ac";
const form = (over: Partial<ProductFormValues> = {}): ProductFormValues => ({
  name: "Gourde isotherme",
  nameEn: "",
  categoryId: "cuisine",
  price: "5000",
  comparePrice: "",
  stock: "5",
  cost: "",
  description: "Garde au frais toute la journée.",
  descriptionEn: "",
  keyword: "",
  bg: "#F3E3A6",
  active: true,
  images: [],
  details: { ...EMPTY_DETAILS },
  detailsEn: { ...EMPTY_DETAILS },
  freeShipping: false,
  ...over,
});
const productWrite = () => state.writes.find((w) => w.table === "products")?.values;
const trWrite = (locale: string) => state.writes.find((w) => w.table === "product_translations" && (w.values.locale === locale || w.filters.locale === locale))?.values;

beforeEach(() => {
  state.missing0024 = false;
  state.missing0025 = false;
  state.dbStock = 5;
  state.writes.length = 0;
});

describe("création / modification avec 0025", () => {
  it("livraison offerte dans products, rubriques nettoyées dans la traduction FR", async () => {
    const r = await createProduct(form({ freeShipping: true, details: { ...EMPTY_DETAILS, uses: " Bureau \r\nSport " } }));
    expect(r.ok).toBe(true);
    expect(productWrite()?.free_shipping).toBe(true);
    expect(trWrite("fr")).toMatchObject({ uses: "Bureau\nSport", color: "" });
  });
  it("rubriques EN écrites avec le nom anglais", async () => {
    const r = await updateProduct(ID, form({ nameEn: "Insulated bottle", detailsEn: { ...EMPTY_DETAILS, color: "Black" }, stockAtOpen: "5" }));
    expect(r.ok).toBe(true);
    expect(trWrite("en")).toMatchObject({ name: "Insulated bottle", color: "Black" });
  });
});

describe("0025 absente", () => {
  it("formulaire sans les nouveaux champs : enregistré quand même, sans free_shipping ni rubriques", async () => {
    state.missing0025 = true;
    const r = await createProduct(form());
    expect(r.ok).toBe(true);
    expect(productWrite()).not.toHaveProperty("free_shipping");
    expect(trWrite("fr")).not.toHaveProperty("color");
  });
  it("case cochée ou rubrique remplie : refus avec message clair, rien d'écrit", async () => {
    state.missing0025 = true;
    const r = await createProduct(form({ freeShipping: true }));
    expect(r).toMatchObject({ ok: false, code: "invalid" });
    if (!r.ok) expect(r.message).toMatch(/0025/);
    expect(state.writes).toHaveLength(0);
  });
  it("0024 ET 0025 absentes : les deux replis s'enchaînent (une photo, sans les nouveaux champs)", async () => {
    state.missing0024 = true;
    state.missing0025 = true;
    const r = await createProduct(form());
    expect(r.ok).toBe(true);
    expect(productWrite()).not.toHaveProperty("images");
    expect(productWrite()).not.toHaveProperty("free_shipping");
  });
});

describe("stock pendant l'édition", () => {
  it("stock non modifié : pas réécrit (une vente pendant l'édition reste décomptée)", async () => {
    state.dbStock = 3; // 2 ventes depuis l'ouverture
    const r = await updateProduct(ID, form({ stock: "5", stockAtOpen: "5" }));
    expect(r.ok).toBe(true);
    expect(productWrite()).not.toHaveProperty("stock");
  });
  it("stock modifié et inchangé en base : écrit, conditionné à l'ancienne valeur", async () => {
    const r = await updateProduct(ID, form({ stock: "12", stockAtOpen: "5" }));
    expect(r.ok).toBe(true);
    expect(productWrite()?.stock).toBe(12);
    expect(state.writes[0].filters.stock).toBe(5);
  });
  it("stock modifié mais une vente l'a changé entre-temps : conflit, rien d'écrit", async () => {
    state.dbStock = 4;
    const r = await updateProduct(ID, form({ stock: "12", stockAtOpen: "5" }));
    expect(r).toMatchObject({ ok: false, code: "conflict" });
    expect(state.writes.filter((w) => w.table === "products")).toHaveLength(0);
  });
});
