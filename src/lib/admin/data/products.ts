import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import demo from "@/lib/demo/catalog.json";
import demoAdmin from "@/lib/demo/admin.json";
import { createAdminClient } from "@/lib/supabase/admin";
import { productImages } from "@/lib/media/product-images";
import { isMissingColumn } from "@/lib/supabase/missing-column";
import { DETAIL_KEYS, EMPTY_DETAILS, detailsFrom, type ProductDetails } from "@/lib/catalog/details";
import type { AdminCategory, AdminProduct, ProductsData } from "@/components/admin/products/types";

// Lecture admin du catalogue (produits + traductions + prix d'achat). Service_role : voit AUSSI les produits masqués.
// Sans Supabase configuré → repli sur src/lib/demo/*.json ; Supabase configuré mais illisible → source « error » (pas de fausses données).

export const ADMIN_LIST_LIMIT = 200;
const TIMEOUT_MS = 6000;

export function withTimeout<T>(p: PromiseLike<T>, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("supabase_timeout")), ms)),
  ]);
}

/** Client service_role, ou null si Supabase n'est pas branché (mode démo). */
export function adminDb(): SupabaseClient | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

/** Rubriques (color, materials…) absentes tant que la migration 0025 n'est pas appliquée. */
type TrRow = { locale: string; name: string; slug: string; description: string } & Partial<Record<keyof ProductDetails, string>>;
type ProductRow = {
  id: string;
  category_id: string;
  price: number;
  compare_price: number | null;
  stock: number;
  sold: number;
  rating_seed: number | string;
  rating_seed_count: number;
  keyword: string;
  bg: string | null;
  image_url: string | null;
  /** Absente tant que la migration 0024 n'est pas appliquée. */
  images?: string[] | null;
  /** Absente tant que la migration 0025 n'est pas appliquée. */
  free_shipping?: boolean | null;
  active: boolean;
  created_at: string;
  product_translations: TrRow[] | null;
  product_costs: { cost: number } | { cost: number }[] | null;
};

const ratingOf = (seed: number, seedCount: number, own: number[]) => {
  const count = seedCount + own.length;
  const sum = seed * seedCount + own.reduce((a, b) => a + b, 0);
  return { average: count ? Math.round((sum / count) * 10) / 10 : 0, count };
};

function fromRow(row: ProductRow, own: number[]): AdminProduct {
  const tr = row.product_translations ?? [];
  const fr = tr.find((t) => t.locale === "fr");
  const en = tr.find((t) => t.locale === "en");
  const costRow = Array.isArray(row.product_costs) ? row.product_costs[0] : row.product_costs;
  const images = productImages(row.images, row.image_url);
  return {
    id: row.id,
    categoryId: row.category_id,
    price: row.price,
    comparePrice: row.compare_price,
    stock: row.stock,
    sold: row.sold,
    keyword: row.keyword,
    bg: row.bg,
    imageUrl: images[0] ?? null,
    images,
    active: row.active,
    createdAt: row.created_at,
    cost: costRow ? costRow.cost : null,
    fr: fr ? { name: fr.name, slug: fr.slug, description: fr.description } : { name: "(sans nom)", slug: "", description: "" },
    en: en ? { name: en.name, slug: en.slug, description: en.description } : null,
    details: { fr: detailsFrom(fr), en: detailsFrom(en) },
    freeShipping: row.free_shipping === true,
    rating: ratingOf(Number(row.rating_seed), row.rating_seed_count, own),
  };
}

function demoCategories(): AdminCategory[] {
  return demo.categories.map((c) => ({ id: c.id, label: c.labelFr, bg: c.bg, sort: c.sort }));
}

function demoProducts(): AdminProduct[] {
  const costs = (demoAdmin as unknown as { cost: Record<string, number> }).cost ?? {};
  return demo.products.map((p) => ({
    id: p.id,
    categoryId: p.categoryId,
    price: p.price,
    comparePrice: p.comparePrice,
    stock: p.stock,
    sold: p.sold,
    keyword: p.keyword,
    bg: p.bg,
    imageUrl: p.imageUrl,
    images: productImages(null, p.imageUrl),
    active: true,
    createdAt: p.createdAt,
    cost: typeof costs[p.id] === "number" ? costs[p.id] : null,
    fr: { name: p.fr.name, slug: p.fr.slug, description: p.fr.description },
    en: null,
    details: { fr: { ...EMPTY_DETAILS }, en: { ...EMPTY_DETAILS } },
    freeShipping: false,
    rating: ratingOf(p.ratingSeed, p.ratingSeedCount, []),
  }));
}

/** Notes des avis propres (hors graines, non masqués), pagination par 200. */
async function fetchOwnRatings(sb: SupabaseClient): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  for (let page = 0; page < 10; page++) {
    const { data, error } = await withTimeout(
      sb
        .from("reviews")
        .select("product_id,rating")
        .eq("seed", false)
        .eq("hidden", false)
        .order("created_at", { ascending: false })
        .range(page * ADMIN_LIST_LIMIT, (page + 1) * ADMIN_LIST_LIMIT - 1),
    );
    if (error) throw error;
    for (const r of data ?? []) {
      const list = out.get(r.product_id) ?? [];
      list.push(r.rating);
      out.set(r.product_id, list);
    }
    if (!data || data.length < ADMIN_LIST_LIMIT) break;
  }
  return out;
}

const ADMIN_BASE_COLUMNS = "id,category_id,price,compare_price,stock,sold,rating_seed,rating_seed_count,keyword,bg,image_url,active,created_at,product_costs(cost)";
const ADMIN_TR_COLUMNS = "locale,name,slug,description";

/** Lectures possibles, de la plus complète à la plus ancienne : 0025 (rubriques + livraison offerte) → 0024 (photos) → socle. */
const ADMIN_TIERS = [
  { columns: `${ADMIN_BASE_COLUMNS},images,free_shipping,product_translations(${ADMIN_TR_COLUMNS},${DETAIL_KEYS.join(",")})`, imagesColumn: true, detailsColumns: true },
  // 0025 appliquée sans 0024 (constaté en production le 2026-10-14).
  { columns: `${ADMIN_BASE_COLUMNS},free_shipping,product_translations(${ADMIN_TR_COLUMNS},${DETAIL_KEYS.join(",")})`, imagesColumn: false, detailsColumns: true },
  { columns: `${ADMIN_BASE_COLUMNS},images,product_translations(${ADMIN_TR_COLUMNS})`, imagesColumn: true, detailsColumns: false },
  { columns: `${ADMIN_BASE_COLUMNS},product_translations(${ADMIN_TR_COLUMNS})`, imagesColumn: false, detailsColumns: false },
] as const;

/** Produits, avec les colonnes des migrations appliquées (une colonne absente fait passer à la lecture suivante). */
async function readAdminRows(sb: SupabaseClient): Promise<{ rows: ProductRow[]; imagesColumn: boolean; detailsColumns: boolean }> {
  const read = (columns: string) =>
    withTimeout(sb.from("products").select(columns).order("created_at", { ascending: false }).range(0, ADMIN_LIST_LIMIT - 1));
  let last: unknown = null;
  for (const tier of ADMIN_TIERS) {
    const { data, error } = await read(tier.columns);
    if (!error) return { rows: (data ?? []) as unknown as ProductRow[], imagesColumn: tier.imagesColumn, detailsColumns: tier.detailsColumns };
    if (!isMissingColumn(error)) throw error;
    last = error;
  }
  throw last;
}

export async function getAdminProducts(): Promise<ProductsData> {
  const sb = adminDb();
  if (!sb) return { source: "demo", products: demoProducts(), categories: demoCategories(), truncated: false, imagesColumn: true, detailsColumns: true };
  try {
    const [{ rows, imagesColumn, detailsColumns }, cats, ratings] = await Promise.all([
      readAdminRows(sb),
      withTimeout(sb.from("categories").select("id,label_fr,bg,sort").order("sort")),
      fetchOwnRatings(sb),
    ]);
    const categories: AdminCategory[] = cats.error || !cats.data?.length
      ? demoCategories()
      : cats.data.map((c) => ({ id: c.id, label: c.label_fr, bg: c.bg, sort: c.sort }));
    return {
      source: "db",
      products: rows.map((r) => fromRow(r, ratings.get(r.id) ?? [])),
      categories,
      truncated: rows.length >= ADMIN_LIST_LIMIT,
      imagesColumn,
      detailsColumns,
    };
  } catch {
    return { source: "error", products: [], categories: demoCategories(), truncated: false, imagesColumn: true, detailsColumns: true };
  }
}

/** Slugs déjà pris pour une langue qui commencent par `base` (pour générer un slug libre). */
export async function takenSlugs(
  sb: SupabaseClient,
  table: "product_translations" | "pack_translations",
  locale: "fr" | "en",
  base: string,
): Promise<Set<string>> {
  // `base` ne contient que [a-z0-9-] (slugify) : aucun caractère spécial pour like.
  const { data } = await withTimeout(
    sb.from(table).select("slug").eq("locale", locale).like("slug", `${base.replace(/[%_]/g, "")}%`).limit(ADMIN_LIST_LIMIT),
  );
  return new Set((data ?? []).map((r: { slug: string }) => r.slug));
}
