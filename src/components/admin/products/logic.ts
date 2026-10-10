// Logique PURE du catalogue admin (produits + packs) : slugs, validation, marge, économie des packs.
// Partagée par les formulaires (messages d'erreur immédiats) ET par les server actions (revalidation serveur). Testée.
import { z } from "zod";
import type { PackFormValues, PackItem, PackProductRef, ProductFormValues } from "./types";

// ───────────────────────── Constantes ─────────────────────────
/** Couleurs de fond proposées (maquette : SWATCHES). */
export const SWATCHES = ["#F3E3A6", "#F2D9C4", "#F1DCD6", "#DCDDE8", "#EDE4CF", "#D7E3D2", "#D3E4E6", "#E2DAE8"] as const;

export const LOW_STOCK = 5; // « stock faible » = 5 unités ou moins (maquette)
export const MAX_PRICE = 10_000_000;
export const MAX_STOCK = 100_000;
export const MAX_PACK_ITEMS = 20;

// ───────────────────────── Texte / nombres ─────────────────────────
const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Slug d'URL depuis un nom : minuscules, sans accents, [a-z0-9-], ≤ 60 caractères. */
export function slugify(name: string): string {
  const s = stripAccents(name.toLowerCase())
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return s || "produit";
}

/** Premier slug libre : `base`, puis `base-2`, `base-3`… */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base.slice(0, 55)}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base.slice(0, 40)}-${Date.now().toString(36)}`;
}

/** Garde uniquement les chiffres (« 12 500 F » → « 12500 »). */
export const digitsOnly = (s: string) => s.replace(/\D/g, "");

/** Entier ≥ 0 depuis une saisie, ou null si vide / illisible. */
export function parseAmount(s: string): number | null {
  const d = digitsOnly(String(s ?? ""));
  if (d === "" || d.length > 12) return null;
  return Number.parseInt(d, 10);
}

export const isHexColor = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s);

/** Mot affiché sans photo : saisi, sinon premier mot du nom (maquette). */
export function defaultKeyword(name: string, keyword: string): string {
  const k = keyword.trim() || name.trim().split(/\s+/)[0] || "";
  return k.toLowerCase().slice(0, 40);
}

// ───────────────────────── Stock / marge ─────────────────────────
export type StockTone = "out" | "low" | "ok";
export const stockTone = (stock: number): StockTone => (stock <= 0 ? "out" : stock <= LOW_STOCK ? "low" : "ok");
export const STOCK_COLOR: Record<StockTone, string> = { out: "#9A3412", low: "#C2410C", ok: "#141210" };

/** Marge unitaire et taux (sur prix de vente). null si le prix d'achat n'est pas renseigné. */
export function marginOf(price: number, cost: number | null): { amount: number; pct: number } | null {
  if (cost === null || price <= 0) return null;
  const amount = price - cost;
  return { amount, pct: Math.round((amount / price) * 100) };
}

// ───────────────────────── Images ─────────────────────────
/** L'URL de photo doit pointer vers NOTRE bucket public `products` (jamais une URL arbitraire). */
export function isStorageImageUrl(url: string, supabaseUrl: string | undefined): boolean {
  if (!supabaseUrl || url.length > 500) return false;
  const prefix = `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/products/`;
  return url.startsWith(prefix) && !url.includes("..") && !/[\s"'<>]/.test(url);
}

// ───────────────────────── Validation produit ─────────────────────────
export const productFormSchema = z.object({
  name: z.string().max(300),
  nameEn: z.string().max(300),
  categoryId: z.string().min(1).max(40),
  price: z.string().max(30),
  comparePrice: z.string().max(30),
  stock: z.string().max(30),
  cost: z.string().max(30),
  description: z.string().max(5000),
  descriptionEn: z.string().max(5000),
  keyword: z.string().max(100),
  bg: z.string().max(20),
  active: z.boolean(),
  imageUrl: z.string().max(500).nullable(),
});

export type ProductInput = {
  name: string;
  nameEn: string | null;
  categoryId: string;
  price: number;
  comparePrice: number | null;
  stock: number;
  cost: number | null;
  description: string;
  descriptionEn: string;
  keyword: string;
  bg: string;
  active: boolean;
  imageUrl: string | null;
};

export type ProductFieldKey = "name" | "nameEn" | "categoryId" | "price" | "comparePrice" | "stock" | "cost" | "description" | "descriptionEn" | "bg";
export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: Partial<Record<string, string>> };

export function validateProductForm(f: ProductFormValues): ValidationResult<ProductInput> {
  const errors: Partial<Record<ProductFieldKey, string>> = {};
  const name = f.name.trim();
  const nameEn = f.nameEn.trim();
  const description = f.description.trim();
  const descriptionEn = f.descriptionEn.trim();

  const price = parseAmount(f.price);
  const comparePrice = f.comparePrice.trim() === "" ? null : parseAmount(f.comparePrice);
  const stock = parseAmount(f.stock);
  const cost = f.cost.trim() === "" ? null : parseAmount(f.cost);

  if (name.length < 3) errors.name = "Nom trop court.";
  else if (name.length > 120) errors.name = "Nom trop long (120 caractères maximum).";
  if (!f.categoryId) errors.categoryId = "Choisissez un rayon.";
  if (!price) errors.price = "Indiquez un prix.";
  else if (price > MAX_PRICE) errors.price = "Prix trop élevé.";
  if (f.comparePrice.trim() !== "" && (comparePrice === null || !price || comparePrice <= price)) errors.comparePrice = "Doit dépasser le prix.";
  if (stock === null) errors.stock = "Indiquez le stock.";
  else if (stock > MAX_STOCK) errors.stock = "Stock trop élevé.";
  if (f.cost.trim() !== "" && (cost === null || cost > MAX_PRICE)) errors.cost = "Prix d'achat invalide.";
  if (description.length < 10) errors.description = "Description trop courte (10 caractères minimum).";
  else if (description.length > 2000) errors.description = "Description trop longue (2 000 caractères maximum).";
  if (nameEn !== "" && nameEn.length < 3) errors.nameEn = "Nom anglais trop court.";
  if (nameEn.length > 120) errors.nameEn = "Nom trop long (120 caractères maximum).";
  if (nameEn === "" && descriptionEn !== "") errors.nameEn = "Ajoutez aussi le nom anglais.";
  if (descriptionEn.length > 2000) errors.descriptionEn = "Description trop longue (2 000 caractères maximum).";
  if (!isHexColor(f.bg)) errors.bg = "Couleur invalide.";

  if (Object.keys(errors).length || price === null || stock === null) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      nameEn: nameEn === "" ? null : nameEn,
      categoryId: f.categoryId,
      price,
      comparePrice,
      stock,
      cost,
      description,
      descriptionEn,
      keyword: defaultKeyword(name, f.keyword),
      bg: f.bg.toUpperCase(),
      active: f.active,
      imageUrl: f.imageUrl,
    },
  };
}

// ───────────────────────── Packs ─────────────────────────
export const packFormSchema = z.object({
  name: z.string().max(300),
  nameEn: z.string().max(300),
  description: z.string().max(5000),
  descriptionEn: z.string().max(5000),
  price: z.string().max(30),
  active: z.boolean(),
  imageUrl: z.string().max(500).nullable(),
  items: z.array(z.object({ productId: z.uuid(), qty: z.number().int().min(1).max(50) })).max(MAX_PACK_ITEMS),
});

export type PackInput = {
  name: string;
  nameEn: string | null;
  description: string;
  descriptionEn: string;
  price: number;
  active: boolean;
  imageUrl: string | null;
  items: PackItem[];
};

export function validatePackForm(f: PackFormValues): ValidationResult<PackInput> {
  const errors: Partial<Record<string, string>> = {};
  const name = f.name.trim();
  const nameEn = f.nameEn.trim();
  const description = f.description.trim();
  const descriptionEn = f.descriptionEn.trim();
  const price = parseAmount(f.price);

  if (name.length < 3) errors.name = "Nom trop court.";
  else if (name.length > 120) errors.name = "Nom trop long (120 caractères maximum).";
  if (!price) errors.price = "Indiquez un prix.";
  else if (price > MAX_PRICE) errors.price = "Prix trop élevé.";
  if (description.length < 10) errors.description = "Description trop courte (10 caractères minimum).";
  else if (description.length > 2000) errors.description = "Description trop longue (2 000 caractères maximum).";
  if (nameEn !== "" && nameEn.length < 3) errors.nameEn = "Nom anglais trop court.";
  if (nameEn === "" && descriptionEn !== "") errors.nameEn = "Ajoutez aussi le nom anglais.";
  if (descriptionEn.length > 2000) errors.descriptionEn = "Description trop longue (2 000 caractères maximum).";

  // Contenu : 1 à 20 produits DISTINCTS, quantité 1-50.
  const ids = new Set<string>();
  let dup = false;
  for (const it of f.items) {
    if (ids.has(it.productId)) dup = true;
    ids.add(it.productId);
  }
  if (f.items.length === 0) errors.items = "Ajoutez au moins un produit.";
  else if (f.items.length > MAX_PACK_ITEMS) errors.items = `${MAX_PACK_ITEMS} produits maximum.`;
  else if (dup) errors.items = "Un produit ne peut figurer qu'une fois (changez sa quantité).";
  else if (f.items.some((i) => !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 50)) errors.items = "Quantité entre 1 et 50.";

  if (Object.keys(errors).length || price === null) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      nameEn: nameEn === "" ? null : nameEn,
      description,
      descriptionEn,
      price,
      active: f.active,
      imageUrl: f.imageUrl,
      items: f.items.map((i) => ({ productId: i.productId, qty: i.qty })),
    },
  };
}

/** Économie du pack vs achat des produits séparément. `total` = somme prix × quantité. */
export function packSavings(
  items: readonly PackItem[],
  packPrice: number,
  products: ReadonlyMap<string, Pick<PackProductRef, "price">>,
): { total: number; saving: number; pct: number; missing: number } {
  let total = 0;
  let missing = 0;
  for (const it of items) {
    const p = products.get(it.productId);
    if (!p) missing += 1;
    else total += p.price * it.qty;
  }
  const saving = total - packPrice;
  const pct = total > 0 ? Math.round((saving / total) * 100) : 0;
  return { total, saving, pct, missing };
}

/** Nombre de packs vendables : min(stock / quantité) sur le contenu (0 si un produit manque). */
export function packStock(items: readonly PackItem[], products: ReadonlyMap<string, Pick<PackProductRef, "stock">>): number {
  if (items.length === 0) return 0;
  let min = Number.POSITIVE_INFINITY;
  for (const it of items) {
    const p = products.get(it.productId);
    if (!p) return 0;
    min = Math.min(min, Math.floor(p.stock / it.qty));
  }
  return Number.isFinite(min) ? min : 0;
}
