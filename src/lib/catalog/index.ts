import "server-only";
import demo from "@/lib/demo/catalog.json";
import type { Locale } from "@/i18n/routing";
import { createPublicClient } from "@/lib/supabase/public";
import { DEFAULT_FX, sanitizeFx, type FxRates } from "@/lib/currency/core";
import { supabasePublicEnv } from "@/lib/supabase/env";
import type {
  Category,
  Product,
  ProductQuery,
  Review,
  ShopSettings,
} from "./types";

export * from "./types";

/**
 * Couche de lecture du catalogue public (serveur, sans cookies → pages statiques/ISR possibles).
 * Source : Supabase si configuré ET joignable ; sinon repli sur les données de démonstration
 * (src/lib/demo/catalog.json, généré depuis la maquette). Jamais d'exception vers les pages.
 */

export const DEFAULT_SETTINGS: ShopSettings = {
  brand: {
    shopName: "Wá xɔ",
    whatsapp: "+229 01 00 00 00 00",
    waNumber: "2290100000000",
    email: "contact@waxo.bj",
    hours: "Du lundi au samedi, de 8 h à 19 h",
  },
  shipping: { cotonou: 1000, autre: 2500, freeFrom: 15000, cutoff: 18, returnDays: 7 },
  pay: { momo: true, moov: true, celtiis: true, carte: true, cod: true },
  features: { packs: true },
};

const TIMEOUT_MS = 4000;
function withTimeout<T>(p: PromiseLike<T>): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("supabase_timeout")), TIMEOUT_MS)),
  ]);
}

function ratingOf(seed: number, seedCount: number, own: Review[]) {
  const count = seedCount + own.length;
  const sum = seed * seedCount + own.reduce((a, r) => a + r.rating, 0);
  return { average: count ? Math.round((sum / count) * 10) / 10 : 0, count };
}

// ───────────────────────── Démo (repli) ─────────────────────────
type DemoProduct = (typeof demo.products)[number];

function demoProduct(p: DemoProduct, locale: Locale): Product {
  const tr = p.fr; // pas de traduction EN en démo : repli FR
  void locale;
  return {
    id: p.id,
    slug: tr.slug,
    name: tr.name,
    description: tr.description,
    categoryId: p.categoryId,
    price: p.price,
    comparePrice: p.comparePrice,
    stock: p.stock,
    sold: p.sold,
    keyword: p.keyword,
    bg: p.bg,
    imageUrl: p.imageUrl,
    createdAt: p.createdAt,
    rating: ratingOf(p.ratingSeed, p.ratingSeedCount, []),
  };
}

// ───────────────────────── Tri / filtre communs ─────────────────────────
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

function applyQuery(list: Product[], query: ProductQuery): Product[] {
  let out = list;
  if (query.category) out = out.filter((p) => p.categoryId === query.category);
  if (query.q?.trim()) {
    const terms = norm(query.q).split(/\s+/).filter(Boolean);
    out = out.filter((p) => {
      const hay = norm(`${p.name} ${p.description} ${p.keyword}`);
      return terms.every((t) => hay.includes(t));
    });
  }
  const sort = query.sort ?? "popular";
  const by: Record<string, (a: Product, b: Product) => number> = {
    popular: (a, b) => b.sold - a.sold,
    new: (a, b) => b.createdAt.localeCompare(a.createdAt),
    "price-asc": (a, b) => a.price - b.price,
    "price-desc": (a, b) => b.price - a.price,
    rating: (a, b) => b.rating.average - a.rating.average || b.rating.count - a.rating.count,
  };
  out = [...out].sort(by[sort] ?? by.popular);
  return query.limit ? out.slice(0, query.limit) : out;
}

// ───────────────────────── API publique ─────────────────────────
export async function getCategories(locale: Locale): Promise<Category[]> {
  if (supabasePublicEnv()) {
    try {
      const { data, error } = await withTimeout(
        createPublicClient().from("categories").select("id,label_fr,label_en,bg,sort").order("sort"),
      );
      if (!error && data?.length) {
        return data.map((c) => ({ id: c.id, label: locale === "en" ? c.label_en : c.label_fr, bg: c.bg, sort: c.sort }));
      }
    } catch {
      /* repli démo */
    }
  }
  return demo.categories.map((c) => ({ id: c.id, label: locale === "en" ? (c.labelEn ?? c.labelFr) : c.labelFr, bg: c.bg, sort: c.sort }));
}

type DbProductRow = {
  id: string;
  category_id: string;
  price: number;
  compare_price: number | null;
  stock: number;
  sold: number;
  rating_seed: number;
  rating_seed_count: number;
  keyword: string;
  bg: string | null;
  image_url: string | null;
  created_at: string;
  product_translations: { locale: string; name: string; slug: string; description: string }[];
};

async function fetchDbProducts(locale: Locale): Promise<Product[] | null> {
  if (!supabasePublicEnv()) return null;
  try {
    const sb = createPublicClient();
    const [{ data: rows, error }, { data: revs }] = await withTimeout(
      Promise.all([
        sb
          .from("products")
          .select(
            "id,category_id,price,compare_price,stock,sold,rating_seed,rating_seed_count,keyword,bg,image_url,created_at,product_translations(locale,name,slug,description)",
          )
          .eq("active", true),
        sb.from("reviews").select("product_id,rating").eq("seed", false).eq("hidden", false),
      ]),
    );
    if (error || !rows?.length) return null;
    const own = new Map<string, Review[]>();
    (revs ?? []).forEach((r) => {
      const list = own.get(r.product_id) ?? [];
      list.push({ id: "", productId: r.product_id, author: "", rating: r.rating, body: "", verified: true, createdAt: "" });
      own.set(r.product_id, list);
    });
    return (rows as unknown as DbProductRow[]).map((p) => {
      const tr = p.product_translations.find((t) => t.locale === locale) ?? p.product_translations.find((t) => t.locale === "fr");
      return {
        id: p.id,
        slug: tr?.slug ?? p.id,
        name: tr?.name ?? "",
        description: tr?.description ?? "",
        categoryId: p.category_id,
        price: p.price,
        comparePrice: p.compare_price,
        stock: p.stock,
        sold: p.sold,
        keyword: p.keyword,
        bg: p.bg,
        imageUrl: p.image_url,
        createdAt: p.created_at,
        rating: ratingOf(Number(p.rating_seed), p.rating_seed_count, own.get(p.id) ?? []),
      };
    });
  } catch {
    return null;
  }
}

async function allProducts(locale: Locale): Promise<Product[]> {
  return (await fetchDbProducts(locale)) ?? demo.products.map((p) => demoProduct(p, locale));
}

export async function getProducts(locale: Locale, query: ProductQuery = {}): Promise<Product[]> {
  return applyQuery(await allProducts(locale), query);
}

export async function getProductBySlug(locale: Locale, slug: string): Promise<Product | null> {
  return (await allProducts(locale)).find((p) => p.slug === slug) ?? null;
}

export async function getProductsByIds(locale: Locale, ids: string[]): Promise<Product[]> {
  const set = new Set(ids);
  return (await allProducts(locale)).filter((p) => set.has(p.id));
}

/** Produits « Vous aimerez aussi » : même rayon d'abord, puis meilleures ventes. */
export async function getRelatedProducts(locale: Locale, product: Product, limit = 4): Promise<Product[]> {
  const list = (await allProducts(locale)).filter((p) => p.id !== product.id);
  const same = applyQuery(list.filter((p) => p.categoryId === product.categoryId), { sort: "popular" });
  const rest = applyQuery(list.filter((p) => p.categoryId !== product.categoryId), { sort: "popular" });
  return [...same, ...rest].slice(0, limit);
}

export async function getReviews(productId: string): Promise<Review[]> {
  if (supabasePublicEnv()) {
    try {
      const { data, error } = await withTimeout(
        createPublicClient()
          .from("reviews")
          .select("id,product_id,author,rating,body,verified,created_at")
          .eq("product_id", productId)
          .eq("hidden", false)
          .order("created_at", { ascending: false }),
      );
      if (!error && data) {
        return data.map((r) => ({
          id: r.id,
          productId: r.product_id,
          author: r.author,
          rating: r.rating,
          body: r.body,
          verified: r.verified,
          createdAt: r.created_at,
        }));
      }
    } catch {
      /* repli démo */
    }
  }
  return demo.reviews
    .filter((r) => r.productId === productId)
    .map((r) => ({ id: r.id, productId: r.productId, author: r.author, rating: r.rating, body: r.body, verified: r.verified, createdAt: r.createdAt }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getSettings(): Promise<ShopSettings> {
  if (supabasePublicEnv()) {
    try {
      const { data, error } = await withTimeout(
        createPublicClient().from("settings").select("key,value").eq("is_public", true),
      );
      if (!error && data?.length) {
        const byKey = Object.fromEntries(data.map((r) => [r.key, r.value]));
        return {
          brand: { ...DEFAULT_SETTINGS.brand, ...(byKey.brand ?? {}) },
          shipping: { ...DEFAULT_SETTINGS.shipping, ...(byKey.shipping ?? {}) },
          pay: { ...DEFAULT_SETTINGS.pay, ...(byKey.pay ?? {}) },
          // Seul `false` explicite désactive : une valeur absente ou illisible garde la fonctionnalité en ligne.
          features: { packs: (byKey.features as { packs?: unknown } | undefined)?.packs !== false },
        };
      }
    } catch {
      /* repli par défaut */
    }
  }
  return DEFAULT_SETTINGS;
}

/**
 * Taux d'affichage €/$ (table fx_rates, rafraîchie par le cron — jamais d'appel API au rendu). 1 XOF = per_xof devise.
 * Repli sur DEFAULT_FX (volontairement prudent) si la base est absente, vide ou incohérente.
 */
export async function getFxRates(): Promise<FxRates> {
  if (supabasePublicEnv()) {
    try {
      const { data, error } = await withTimeout(createPublicClient().from("fx_rates").select("currency,per_xof"));
      if (!error && data?.length) {
        const by = Object.fromEntries(data.map((r) => [r.currency, Number(r.per_xof)]));
        return sanitizeFx({ eur: by.EUR, usd: by.USD });
      }
    } catch {
      /* repli par défaut */
    }
  }
  return DEFAULT_FX;
}
