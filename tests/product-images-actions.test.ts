// Server actions produits et photos multiples (0024) : écriture `images` + `image_url` (couverture), URL hors bucket
// refusée, et repli AVANT la migration (colonne absente → photo unique seulement, plusieurs photos refusées avec un message).
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  missingColumn: false,
  current: { id: "", image_url: null as string | null, images: [] as string[], product_translations: [{ locale: "fr" }] },
  writes: [] as { op: "insert" | "update"; values: Record<string, unknown> }[],
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/admin/guard", () => ({ assertAdmin: async () => ({ id: "a", email: "a@b.c" }) }));
vi.mock("@/lib/admin/data/products", () => {
  const missing = { code: "PGRST204", message: "Could not find the 'images' column of 'products' in the schema cache" };
  const table = (name: string) => {
    let columns = "";
    let pending: { op: "insert" | "update"; values: Record<string, unknown> } | null = null;
    const b: Record<string, unknown> = {};
    const result = () => {
      if (name !== "products") return { data: null, error: null };
      if (pending) {
        if (state.missingColumn && "images" in pending.values) return { data: null, error: missing };
        state.writes.push(pending);
        // Comme PostgREST : insert().single() → un objet ; update().select() → la liste des lignes modifiées.
        const row = { id: "11111111-1111-4111-8111-111111111111" };
        return { data: pending.op === "update" ? [row] : row, error: null };
      }
      if (state.missingColumn && columns.includes("images")) return { data: null, error: { code: "42703", message: "column products.images does not exist" } };
      const { images, ...legacy } = state.current;
      return { data: state.missingColumn ? legacy : { ...legacy, images }, error: null };
    };
    for (const m of ["eq", "single", "maybeSingle", "like", "limit", "upsert", "delete"]) b[m] = () => b;
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

const SB = "https://btarkkjimnkmiaxzonzq.supabase.co";
const u = (n: string) => `${SB}/storage/v1/object/public/products/2026/10/${n}.webp`;
const ID = "5b4e688a-1bb0-4e16-aeb8-a933014cd3ac";
const form = (images: string[]): ProductFormValues => ({
  name: "Lampe LED rechargeable",
  nameEn: "",
  categoryId: "maison",
  price: "8900",
  comparePrice: "",
  stock: "5",
  cost: "",
  description: "Jusqu'à 10 h d'autonomie, 3 intensités.",
  descriptionEn: "",
  keyword: "",
  bg: "#F3E3A6",
  active: true,
  images,
  details: { color: "", materials: "", specs: "", highlights: "", uses: "", care: "" },
  detailsEn: { color: "", materials: "", specs: "", highlights: "", uses: "", care: "" },
  freeShipping: false,
});
const productWrite = () => state.writes.find((w) => "category_id" in w.values)?.values;

beforeEach(() => {
  state.missingColumn = false;
  state.current = { id: ID, image_url: null, images: [], product_translations: [{ locale: "fr" }] };
  state.writes = [];
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SB);
});

describe("après 0024", () => {
  it("création : images dans l'ordre + image_url = première photo", async () => {
    const res = await createProduct(form([u("b"), u("a"), u("c")]));
    expect(res.ok).toBe(true);
    expect(productWrite()).toMatchObject({ images: [u("b"), u("a"), u("c")], image_url: u("b") });
  });
  it("modification : réordonner change la couverture ; sans photo → image_url null", async () => {
    state.current = { ...state.current, image_url: u("a"), images: [u("a"), u("b")] };
    expect((await updateProduct(ID, form([u("b"), u("a")]))).ok).toBe(true);
    expect(productWrite()).toMatchObject({ images: [u("b"), u("a")], image_url: u("b") });
    state.writes = [];
    expect((await updateProduct(ID, form([]))).ok).toBe(true);
    expect(productWrite()).toMatchObject({ images: [], image_url: null });
  });
  it("URL hors de notre bucket refusée (jamais une URL arbitraire), aucune écriture", async () => {
    const res = await updateProduct(ID, form([u("a"), "https://evil.example/storage/v1/object/public/products/x.webp"]));
    expect(res).toMatchObject({ ok: false, code: "invalid", fields: { images: "Photo invalide." } });
    expect(productWrite()).toBeUndefined();
  });
  it("9 photos refusées par la validation", async () => {
    const res = await createProduct(form(Array.from({ length: 9 }, (_, i) => u(`p${i}`))));
    expect(res).toMatchObject({ ok: false, fields: { images: "8 photos au maximum." } });
  });
});

describe("avant 0024 (colonne images absente)", () => {
  it("une photo : enregistrée dans image_url seule", async () => {
    state.missingColumn = true;
    expect((await createProduct(form([u("a")]))).ok).toBe(true);
    const w = productWrite();
    expect(w).toMatchObject({ image_url: u("a") });
    expect(w).not.toHaveProperty("images");
    state.writes = [];
    expect((await updateProduct(ID, form([u("b")]))).ok).toBe(true);
    expect(productWrite()).toEqual(expect.objectContaining({ image_url: u("b") }));
    expect(productWrite()).not.toHaveProperty("images");
  });
  it("plusieurs photos : refus explicite (migration 0024 à appliquer), rien de perdu en silence", async () => {
    state.missingColumn = true;
    const res = await updateProduct(ID, form([u("a"), u("b")]));
    expect(res).toMatchObject({ ok: false, code: "invalid" });
    expect(!res.ok && res.message).toContain("migration 0024");
    expect(productWrite()).toBeUndefined();
    const created = await createProduct(form([u("a"), u("b")]));
    expect(!created.ok && created.message).toContain("migration 0024");
  });
});
