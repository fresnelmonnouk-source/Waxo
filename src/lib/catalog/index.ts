import "server-only";
import { cache } from "react";
import demo from "@/lib/demo/catalog.json";
import type { Locale } from "@/i18n/routing";
import { createPublicClient } from "@/lib/supabase/public";
import { DEFAULT_FX, sanitizeFx, type FxRates } from "@/lib/currency/core";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { getLiveCampaigns } from "@/lib/campaigns/data";
import { applyCampaigns } from "@/lib/campaigns/logic";
import { productImages } from "@/lib/media/product-images";
import { isMissingColumn } from "@/lib/supabase/missing-column";
import { DETAIL_KEYS, EMPTY_DETAILS, detailsFrom, mergeDetails, type ProductDetails } from "./details";
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
 * Sans Supabase (développement) : données de démonstration (src/lib/demo/catalog.json, générées depuis la maquette).
 * Supabase branché : base vide = boutique vide ; base lente ou en erreur = EXCEPTION (la page ISR garde sa version en
 * cache, décision D6 du 2026-10-12), jamais de démo ni de coordonnées factices. Seule exception : pendant le BUILD
 * (prérendu parallèle, base parfois lente), repli neutre pour ne pas faire échouer le déploiement ; l'ISR régénère ensuite.
 */

/** Réglages de DÉMONSTRATION (développement sans Supabase, tests). Jamais servis en production. */
export const DEFAULT_SETTINGS: ShopSettings = {
  brand: {
    shopName: "Wá xɔ",
    whatsapp: "+229 01 00 00 00 00",
    waNumber: "2290100000000",
    email: "contact@waxo.bj",
    hours: "7 j/7, de 8 h à 20 h",
  },
  shipping: { cotonou: 1000, autre: 2500, freeFrom: 15000, cutoff: 20, returnDays: 7 },
  pay: { momo: true, moov: true, celtiis: true, carte: true, cod: true },
  features: { packs: true },
};

/**
 * Base branchée : point de départ des réglages lus en base, et repli du build. Coordonnées VIDES (jamais le numéro de
 * démonstration) : les composants masquent un lien WhatsApp, un téléphone ou un e-mail vide.
 */
export const BLANK_SETTINGS: ShopSettings = {
  ...DEFAULT_SETTINGS,
  brand: { shopName: "Wá xɔ", whatsapp: "", waNumber: "", email: "", hours: DEFAULT_SETTINGS.brand.hours },
};

/** Prérendu du build en cours (même règle partout : liste vide ou réglages neutres plutôt qu'un build en échec). */
export const isBuildPhase = () => process.env.NEXT_PHASE === "phase-production-build";

const TIMEOUT_MS = 4000;
function withTimeout<T>(p: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error("supabase_timeout")), TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** Somme et nombre de VRAIS avis d'un produit (`seed = false`, `hidden = false`). */
export type RatingSum = { sum: number; count: number };

/** Note affichée : avis de départ (`rating_seed`) + vrais avis. Ne sert JAMAIS aux données structurées (voir `getRealRating`). */
function ratingOf(seed: number, seedCount: number, own: RatingSum | undefined) {
  const count = seedCount + (own?.count ?? 0);
  const sum = seed * seedCount + (own?.sum ?? 0);
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
    images: productImages(null, p.imageUrl),
    createdAt: p.createdAt,
    rating: ratingOf(p.ratingSeed, p.ratingSeedCount, undefined),
    freeShipping: false,
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
/** Rayons. Base branchée : ceux de la base (vide = aucun rayon), jamais les rayons de démo (S7). `cache` : une lecture par rendu. */
export const getCategories = cache(async (locale: Locale): Promise<Category[]> => {
  if (!supabasePublicEnv()) {
    return demo.categories.map((c) => ({ id: c.id, label: locale === "en" ? (c.labelEn ?? c.labelFr) : c.labelFr, bg: c.bg, sort: c.sort }));
  }
  try {
    const { data, error } = await withTimeout(
      createPublicClient().from("categories").select("id,label_fr,label_en,bg,sort").order("sort"),
    );
    if (error) throw new Error("categories_unavailable");
    return (data ?? []).map((c) => ({ id: c.id, label: locale === "en" ? c.label_en : c.label_fr, bg: c.bg, sort: c.sort }));
  } catch (e) {
    if (isBuildPhase()) return [];
    throw e;
  }
});

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
  /** Absente tant que la migration 0024 n'est pas appliquée. */
  images?: string[] | null;
  /** Absente tant que la migration 0025 n'est pas appliquée. */
  free_shipping?: boolean | null;
  created_at: string;
  product_translations: { locale: string; name: string; slug: string; description: string }[];
};

/** Lecture brute du catalogue, commune aux deux langues : produits actifs + agrégat des vrais avis. */
type CatalogRows = { rows: DbProductRow[]; ratings: Map<string, RatingSum> };

/** Avis lus par pages : PostgREST plafonne une réponse (1 000 lignes par défaut), une seule requête tronquerait en silence. */
export const REVIEWS_PAGE = 1000;
const REVIEWS_MAX_PAGES = 50;

/** Agrégat des vrais avis publiés, par produit. Avis illisibles : carte vide (notes de départ seules, comportement d'origine). */
export async function readRealRatings(sb: ReturnType<typeof createPublicClient>): Promise<Map<string, RatingSum>> {
  const out = new Map<string, RatingSum>();
  try {
    for (let page = 0; page < REVIEWS_MAX_PAGES; page++) {
      const from = page * REVIEWS_PAGE;
      const { data, error } = await withTimeout(
        sb
          .from("reviews")
          .select("id,product_id,rating")
          .eq("seed", false)
          .eq("hidden", false)
          .order("id")
          .range(from, from + REVIEWS_PAGE - 1),
      );
      if (error) throw new Error("reviews_unavailable");
      for (const r of (data ?? []) as { product_id: string; rating: number }[]) {
        const cur = out.get(r.product_id) ?? { sum: 0, count: 0 };
        cur.sum += Number(r.rating) || 0;
        cur.count += 1;
        out.set(r.product_id, cur);
      }
      if (!data || data.length < REVIEWS_PAGE) break;
    }
    return out;
  } catch {
    return new Map();
  }
}

/**
 * Produits de la base. `null` UNIQUEMENT sans Supabase (développement) → catalogue de démo.
 * Base branchée : base vide = boutique vide (jamais de produits fictifs en production, constat du 2026-10-12 après la
 * purge) ; base injoignable = exception (une page ISR garde alors sa version en cache au lieu d'afficher la démo).
 * Pendant le BUILD (prérendu parallèle, base parfois lente) : liste vide plutôt qu'un build en échec ; la page est
 * régénérée par l'ISR quelques minutes après le déploiement.
 * `cache` : une seule lecture par rendu, quelle que soit la langue (E1 : 3 à 6 lectures complètes auparavant).
 */
const BASE_COLUMNS = "id,category_id,price,compare_price,stock,sold,rating_seed,rating_seed_count,keyword,bg,image_url,created_at";
const TR_COLUMNS = "locale,name,slug,description";
const PRODUCT_COLUMNS = `${BASE_COLUMNS},product_translations(${TR_COLUMNS})`;

/**
 * Lectures possibles, de la plus complète à la plus ancienne : 0024 (photos) et 0025 (livraison offerte), dans n'importe quel
 * ordre d'application, puis le socle. Une colonne absente fait passer à la suivante : la boutique reste en ligne.
 * Les rubriques de la fiche (0025) ne sont PAS lues ici : seulement par getProductDetails, sur la fiche (audit Tariq 🟠3).
 */
const COLUMN_TIERS = [
  `${PRODUCT_COLUMNS},images,free_shipping`,
  `${PRODUCT_COLUMNS},free_shipping`, // 0025 sans 0024 (production au 2026-10-14)
  `${PRODUCT_COLUMNS},images`,
  PRODUCT_COLUMNS,
] as const;

/** Lecture complète constatée impossible : on ne la retente pas avant ce délai (évite 2 à 3 requêtes par lecture). */
const COLUMNS_RECHECK_MS = 10 * 60_000;
let tier = 0;
let tierUntil = 0;

/** Produits actifs, avec les colonnes des migrations appliquées. Toute erreur autre qu'une colonne absente reste une erreur. */
async function readProductRows(sb: ReturnType<typeof createPublicClient>): Promise<DbProductRow[]> {
  const read = (columns: string) => withTimeout(sb.from("products").select(columns).eq("active", true));
  if (Date.now() >= tierUntil) tier = 0;
  for (let i = tier; i < COLUMN_TIERS.length; i++) {
    const { data, error } = await read(COLUMN_TIERS[i]);
    if (!error) {
      if (i !== tier) {
        tier = i;
        tierUntil = Date.now() + COLUMNS_RECHECK_MS;
        // Visible dans les journaux Vercel : une migration manque (ou une colonne a été mal nommée dans le code).
        console.warn(`[catalogue] colonnes absentes : lecture de repli n° ${i} (migrations 0024/0025 à vérifier)`);
      }
      return (data ?? []) as unknown as DbProductRow[];
    }
    if (!isMissingColumn(error)) throw new Error("catalog_unavailable");
  }
  throw new Error("catalog_unavailable");
}

/** Tests uniquement : oublie les colonnes constatées absentes. */
export function resetImagesColumnProbe() {
  tier = 0;
  tierUntil = 0;
}

const readCatalog = cache(async (): Promise<CatalogRows | null> => {
  if (!supabasePublicEnv()) return null;
  try {
    const sb = createPublicClient();
    const [rows, ratings] = await Promise.all([readProductRows(sb), readRealRatings(sb)]);
    return { rows, ratings };
  } catch (e) {
    if (isBuildPhase()) return { rows: [], ratings: new Map() };
    throw e;
  }
});

function dbProduct(p: DbProductRow, locale: Locale, ratings: Map<string, RatingSum>): Product {
  const tr = p.product_translations.find((t) => t.locale === locale) ?? p.product_translations.find((t) => t.locale === "fr");
  const images = productImages(p.images, p.image_url);
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
    imageUrl: images[0] ?? null,
    images,
    createdAt: p.created_at,
    rating: ratingOf(Number(p.rating_seed), p.rating_seed_count, ratings.get(p.id)),
    freeShipping: p.free_shipping === true,
  };
}

const allProducts = cache(async (locale: Locale): Promise<Product[]> => {
  const [db, campaigns] = await Promise.all([readCatalog(), getLiveCampaigns()]);
  if (!db) return demo.products.map((p) => demoProduct(p, locale));
  const list = db.rows.map((p) => dbProduct(p, locale, db.ratings));
  // Campagnes en cours : prix de campagne + prix barré = prix normal (même règle que place_order, migration 0015).
  return applyCampaigns(list, campaigns, Date.now(), locale === "en" ? "en" : "fr");
});

/**
 * Produit d'une LISTE (accueil, catalogue, favoris, « Vous aimerez aussi ») : couverture seule dans `images`.
 * Les listes sont sérialisées vers des composants client : 200 produits × 8 URL alourdiraient chaque page pour rien,
 * les cartes n'affichant que la photo principale. La fiche (`getProductBySlug`) garde toutes les photos.
 */
const listItem = (p: Product): Product => (p.images.length > 1 ? { ...p, images: p.images.slice(0, 1) } : p);

export async function getProducts(locale: Locale, query: ProductQuery = {}): Promise<Product[]> {
  return applyQuery(await allProducts(locale), query).map(listItem);
}

/**
 * Rubriques facultatives d'UNE fiche (0025), dans la langue demandée avec repli FR rubrique par rubrique. Lues à part pour
 * ne pas alourdir les listes ni l'API du panier. Non critique : colonnes absentes ou base en erreur → rubriques vides (la
 * fiche reste affichée, sans bloc « Détails »).
 */
export const getProductDetails = cache(async (productId: string, locale: Locale): Promise<ProductDetails> => {
  if (!supabasePublicEnv()) return { ...EMPTY_DETAILS };
  try {
    const { data, error } = await withTimeout(
      createPublicClient().from("product_translations").select(`locale,${DETAIL_KEYS.join(",")}`).eq("product_id", productId),
    );
    if (error) {
      if (!isMissingColumn(error)) console.warn("[catalogue] rubriques illisibles", error.code ?? "");
      return { ...EMPTY_DETAILS };
    }
    const rows = (data ?? []) as unknown as ({ locale: string } & Partial<Record<keyof ProductDetails, string>>)[];
    return mergeDetails(detailsFrom(rows.find((r) => r.locale === locale)), detailsFrom(rows.find((r) => r.locale === "fr")));
  } catch {
    return { ...EMPTY_DETAILS };
  }
});

/** Fiche produit : TOUTES les photos (galerie, JSON-LD). */
export async function getProductBySlug(locale: Locale, slug: string): Promise<Product | null> {
  return (await allProducts(locale)).find((p) => p.slug === slug) ?? null;
}

export async function getProductsByIds(locale: Locale, ids: string[]): Promise<Product[]> {
  const set = new Set(ids);
  return (await allProducts(locale)).filter((p) => set.has(p.id)).map(listItem);
}

/** Produits « Vous aimerez aussi » : même rayon d'abord, puis meilleures ventes. */
export async function getRelatedProducts(locale: Locale, product: Product, limit = 4): Promise<Product[]> {
  const list = (await allProducts(locale)).filter((p) => p.id !== product.id);
  const same = applyQuery(list.filter((p) => p.categoryId === product.categoryId), { sort: "popular" });
  const rest = applyQuery(list.filter((p) => p.categoryId !== product.categoryId), { sort: "popular" });
  return [...same, ...rest].slice(0, limit).map(listItem);
}

/** Slugs d'une fiche par langue. `en` absent = pas de texte anglais (S8 : pas d'alternate EN, canonique FR). */
export type LocaleSlugs = { fr: string; en?: string };

/** Slugs FR/EN de chaque produit actif (sitemap, hreflang, redirection au changement de langue). */
export const getProductSlugs = cache(async (): Promise<Map<string, LocaleSlugs>> => {
  const db = await readCatalog();
  if (!db) return new Map(demo.products.map((p) => [p.id, { fr: p.fr.slug }]));
  return new Map(
    db.rows.map((p): [string, LocaleSlugs] => {
      const fr = p.product_translations.find((t) => t.locale === "fr");
      const en = p.product_translations.find((t) => t.locale === "en" && t.slug);
      return [p.id, { fr: fr?.slug || en?.slug || p.id, ...(en ? { en: en.slug } : {}) }];
    }),
  );
});

/**
 * Slug à utiliser dans `locale` quand `slug` est celui d'une AUTRE langue (S2 : sélecteur de langue, panier, ancien lien).
 * `null` si le slug est inconnu ou déjà le bon (jamais de boucle de redirection).
 */
export function slugForLocale(map: Map<string, LocaleSlugs>, locale: Locale, slug: string): string | null {
  for (const s of map.values()) {
    if (s.fr !== slug && s.en !== slug) continue;
    const target = locale === "en" ? (s.en ?? s.fr) : s.fr;
    return target === slug ? null : target;
  }
  return null;
}

export async function findProductSlug(locale: Locale, slug: string): Promise<string | null> {
  return slugForLocale(await getProductSlugs(), locale, slug);
}

/**
 * Note issue des SEULS vrais avis publiés (jamais `rating_seed`) : la seule utilisable dans les données structurées
 * (règle Helena B1). Démo ou aucun avis : `{ average: 0, count: 0 }`, donc pas d'`aggregateRating`.
 */
export async function getRealRating(productId: string): Promise<{ average: number; count: number }> {
  const db = await readCatalog();
  const r = db?.ratings.get(productId);
  if (!r || r.count === 0) return { average: 0, count: 0 };
  return { average: Math.round((r.sum / r.count) * 10) / 10, count: r.count };
}

/**
 * Date de dernière modification des produits actifs (sitemap `lastmod`, colonne `updated_at` de la migration 0019).
 * Lecture séparée et TOLÉRANTE : colonne absente (0019 pas encore appliquée) ou base lente = pas de `lastmod`, rien d'autre.
 */
export async function getProductsUpdatedAt(): Promise<Map<string, string>> {
  if (!supabasePublicEnv()) return new Map();
  try {
    const { data, error } = await withTimeout(createPublicClient().from("products").select("id,updated_at").eq("active", true));
    if (error || !data) return new Map();
    return new Map(
      (data as { id: string; updated_at?: string | null }[]).flatMap((r): [string, string][] => (r.updated_at ? [[r.id, r.updated_at]] : [])),
    );
  } catch {
    return new Map();
  }
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
      /* base injoignable : aucun avis plutôt que des avis fictifs */
    }
    return [];
  }
  return demo.reviews
    .filter((r) => r.productId === productId)
    .map((r) => ({ id: r.id, productId: r.productId, author: r.author, rating: r.rating, body: r.body, verified: r.verified, createdAt: r.createdAt }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Réglages publics lus en base → réglages de la boutique. Départ `BLANK_SETTINGS` : jamais les coordonnées de démo. */
export function settingsFromRows(rows: { key: string; value: unknown }[]): ShopSettings {
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, Record<string, unknown> | undefined>;
  return {
    brand: { ...BLANK_SETTINGS.brand, ...(byKey.brand ?? {}) },
    shipping: { ...BLANK_SETTINGS.shipping, ...(byKey.shipping ?? {}) },
    pay: { ...BLANK_SETTINGS.pay, ...(byKey.pay ?? {}) },
    // Seul `false` explicite désactive : une valeur absente ou illisible garde la fonctionnalité en ligne.
    features: { packs: byKey.features?.packs !== false },
  };
}

/**
 * Réglages publics (S7, décision D6). Sans Supabase : démo. Base branchée : lecture de la base ; lente ou en erreur =
 * exception (la page ISR garde sa version en cache), sauf pendant le build (réglages neutres, sans coordonnées).
 * `cache` : une lecture par rendu (layout, coque et page la demandent chacun).
 */
export const getSettings = cache(async (): Promise<ShopSettings> => {
  if (!supabasePublicEnv()) return DEFAULT_SETTINGS;
  try {
    const { data, error } = await withTimeout(
      createPublicClient().from("settings").select("key,value").eq("is_public", true),
    );
    if (error) throw new Error("settings_unavailable");
    return settingsFromRows(data ?? []);
  } catch (e) {
    if (isBuildPhase()) return BLANK_SETTINGS;
    throw e;
  }
});

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
