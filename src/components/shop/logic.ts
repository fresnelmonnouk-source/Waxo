import type { Product } from "@/lib/catalog/types";
import { discountPercent } from "@/lib/money";

/**
 * Logique pure de la boutique (tri, filtres, sélection, étiquettes, recherche).
 * Aucun accès navigateur ni serveur : testable seule, utilisable côté serveur et côté client.
 * Les règles reprennent le script de la maquette « Waxo Boutique » (renderVals, card, selection).
 */

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// ───────────────────────── Étiquettes et stock ─────────────────────────
export type TagKind = "soldout" | "promo" | "new" | "best";

const DAY_MS = 864e5;

/** Meilleures ventes : les 4 produits en stock les plus vendus (maquette : `bestIds`). */
export function bestSellerIds(products: Product[]): string[] {
  return products
    .filter((p) => p.stock > 0)
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 4)
    .map((p) => p.id);
}

/** Un produit est « nouveau » s'il a moins de 30 jours de plus que le plus récent du catalogue. */
export function newIds(products: Product[]): string[] {
  const times = products.map((p) => Date.parse(p.createdAt)).filter((t) => Number.isFinite(t));
  if (!times.length) return [];
  const cut = Math.max(...times) - 30 * DAY_MS;
  return products.filter((p) => Date.parse(p.createdAt) >= cut).map((p) => p.id);
}

export type TagContext = { newIds?: readonly string[]; bestIds?: readonly string[] };

/** Priorité de la maquette : épuisé, remise, nouveau, best-seller. */
export function productTag(p: Product, ctx: TagContext = {}): TagKind | null {
  if (p.stock <= 0) return "soldout";
  if (p.comparePrice && p.comparePrice > p.price) return "promo";
  if (ctx.newIds?.includes(p.id)) return "new";
  if (ctx.bestIds?.includes(p.id)) return "best";
  return null;
}

export type StockKind = "out" | "low" | "ok";
export const stockKind = (stock: number): StockKind => (stock <= 0 ? "out" : stock <= 5 ? "low" : "ok");

/** Couleur du texte de stock (maquette : stockColor). */
export const STOCK_COLOR: Record<StockKind, string> = { out: "#6B645A", low: "#C2410C", ok: "#1F6B4A" };

export const TAG_STYLE: Record<TagKind, { bg: string; color: string }> = {
  soldout: { bg: "#E2DCCF", color: "#4A443C" },
  promo: { bg: "#C2410C", color: "#FFFFFF" },
  new: { bg: "#FFC93C", color: "#141210" },
  best: { bg: "#141210", color: "#FFC93C" },
};

/** « -25 % » avec espace insécable avant le signe pourcent (comme la maquette, trait d'union simple). */
export function promoLabel(p: Product): string {
  return `-${discountPercent(p.comparePrice, p.price)} %`;
}

// ───────────────────────── Note affichée ─────────────────────────
export function fmtRating(avg: number, locale: string): string {
  const s = avg.toFixed(1);
  return locale === "fr" ? s.replace(".", ",") : s;
}

/** Note moyenne pondérée de toute la boutique (maquette : `tot`). */
export function storeRating(products: Product[]): { avg: number; count: number } {
  let n = 0;
  let sum = 0;
  for (const p of products) {
    n += p.rating.count;
    sum += p.rating.average * p.rating.count;
  }
  return { avg: n ? sum / n : 0, count: n };
}

// ───────────────────────── Accueil ─────────────────────────
/** Ordre stable « mélangé » de l'aperçu catalogue de l'accueil (même hachage que la maquette). */
export function mixOrder(products: Product[]): Product[] {
  const h = (id: string) => {
    let v = 7;
    for (const ch of id) v = (v * 31 + ch.charCodeAt(0)) % 9973;
    return v;
  };
  return [...products].sort((a, b) => h(a.id) - h(b.id));
}

/** Produits du héro : promos en stock d'abord, puis meilleures ventes sans remise ; 4 maximum. */
export function heroProducts(products: Product[], bestIds: readonly string[]): Product[] {
  const promos = products.filter((p) => p.comparePrice && p.comparePrice > p.price && p.stock > 0);
  const best = products.filter((p) => !(p.comparePrice && p.comparePrice > p.price) && bestIds.includes(p.id));
  return [...promos, ...best].slice(0, 4);
}

// ───────────────────────── Sélection « pour vous » ─────────────────────────
export const DEFAULT_SELECTION = ["support", "trousse", "diffuseur", "masque", "brosse", "cables"];

/**
 * Sélection de la maquette : sans historique → liste de départ ; avec historique (produits vus + panier)
 * → rayons pondérés (vu : 3/2/1 selon la récence, panier : 3), note moyenne en départage.
 * Exclut les produits épuisés et ceux déjà au panier.
 */
export function computeSelection(
  all: Product[],
  ctx: { viewed: readonly string[]; cartIds: readonly string[] },
): { ids: string[]; personal: boolean } {
  const byId = new Map(all.map((p) => [p.id, p]));
  const w: Record<string, number> = {};
  const bump = (id: string, n: number) => {
    const p = byId.get(id);
    if (p) w[p.categoryId] = (w[p.categoryId] ?? 0) + n;
  };
  ctx.viewed.forEach((id, i) => bump(id, 3 - Math.min(i, 2)));
  ctx.cartIds.forEach((id) => bump(id, 3));

  if (!Object.keys(w).length) {
    const base = DEFAULT_SELECTION.filter((id) => byId.get(id)?.stock);
    if (base.length) return { ids: base, personal: false };
    // Catalogue sans les produits de démonstration : meilleures notes en stock.
    const fallback = all
      .filter((p) => p.stock > 0)
      .sort((a, b) => b.rating.average - a.rating.average || b.sold - a.sold)
      .slice(0, 6)
      .map((p) => p.id);
    return { ids: fallback, personal: false };
  }
  const inCart = new Set(ctx.cartIds);
  const ids = all
    .filter((p) => p.stock > 0 && !inCart.has(p.id))
    .map((p) => ({ id: p.id, sc: (w[p.categoryId] ?? 0) * 10 + p.rating.average - (ctx.viewed.includes(p.id) ? 2 : 0) }))
    .sort((a, b) => b.sc - a.sc)
    .slice(0, 6)
    .map((o) => o.id);
  return { ids, personal: true };
}

// ───────────────────────── Recherche (suggestions de l'en-tête) ─────────────────────────
export type SearchEntry = {
  slug: string;
  name: string;
  price: number;
  bg: string | null;
  imageUrl: string | null;
  hay: string; // texte normalisé : nom + description + rayon + mot-clé
};

export function buildSearchEntry(p: Product, catLabel: string): SearchEntry {
  return {
    slug: p.slug,
    name: p.name,
    price: p.price,
    bg: p.bg,
    imageUrl: p.imageUrl,
    hay: norm(`${p.name} ${p.description} ${catLabel} ${p.keyword}`),
  };
}

export function matchesQuery(hay: string, q: string): boolean {
  const terms = norm(q.trim()).split(/\s+/).filter(Boolean);
  return terms.length > 0 && terms.every((t) => hay.includes(t));
}

/** Suggestions : au moins 2 caractères, ordre du tableau d'entrée (déjà trié par ventes côté serveur). */
export function searchSuggestions(entries: SearchEntry[], q: string): SearchEntry[] {
  if (norm(q.trim()).length < 2) return [];
  return entries.filter((e) => matchesQuery(e.hay, q));
}

// ───────────────────────── Catalogue : état dans l'URL ─────────────────────────
export const COLLECTIONS = ["ventes", "notes", "nouveautes", "promos", "selection"] as const;
export type CollectionId = (typeof COLLECTIONS)[number];
export const SORTS = ["ventes", "notes", "nouveautes", "asc", "desc"] as const;
export type CatalogSort = (typeof SORTS)[number];
export const BUDGETS = ["all", "lt3", "3to7", "gt7"] as const;
export type BudgetId = (typeof BUDGETS)[number];

export type CatalogFilters = { cat: string; col: CollectionId | null; sort: CatalogSort; q: string; budget: BudgetId };

export const DEFAULT_FILTERS: CatalogFilters = { cat: "all", col: null, sort: "ventes", q: "", budget: "all" };

const isIn = <T extends string>(list: readonly T[], v: string | null): v is T => v !== null && (list as readonly string[]).includes(v);

/** Tri implicite d'une collection (maquette : openCatalog). */
export const impliedSort = (col: CollectionId | null): CatalogSort => (col === "nouveautes" ? "nouveautes" : col === "notes" ? "notes" : "ventes");

export function parseFilters(get: (key: string) => string | null, validCats: readonly string[]): CatalogFilters {
  const cat = get("cat");
  const col = get("col");
  const sort = get("sort");
  const budget = get("budget");
  const colId = isIn(COLLECTIONS, col) ? col : null;
  return {
    cat: cat && validCats.includes(cat) ? cat : "all",
    col: colId,
    sort: isIn(SORTS, sort) ? sort : impliedSort(colId),
    q: (get("q") ?? "").slice(0, 100),
    budget: isIn(BUDGETS, budget) ? budget : "all",
  };
}

/** Chaîne de requête minimale (valeurs par défaut omises). Sans « ? ». */
export function filtersToQuery(f: CatalogFilters): string {
  const p = new URLSearchParams();
  if (f.cat !== "all") p.set("cat", f.cat);
  if (f.col) p.set("col", f.col);
  if (f.sort !== impliedSort(f.col)) p.set("sort", f.sort);
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.budget !== "all") p.set("budget", f.budget);
  return p.toString();
}

export const hasActiveFilters = (f: CatalogFilters) => f.cat !== "all" || f.budget !== "all" || !!f.col || !!f.q.trim();

export function inBudget(price: number, budget: BudgetId): boolean {
  if (budget === "lt3") return price < 3000;
  if (budget === "3to7") return price >= 3000 && price <= 7000;
  if (budget === "gt7") return price > 7000;
  return true;
}

export type CatalogContext = {
  catLabels: Record<string, string>;
  newIds: readonly string[];
  selectionIds: readonly string[];
};

const SORTERS: Record<CatalogSort, (a: Product, b: Product) => number> = {
  ventes: (a, b) => b.sold - a.sold,
  notes: (a, b) => b.rating.average - a.rating.average || b.rating.count - a.rating.count,
  nouveautes: (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  asc: (a, b) => a.price - b.price,
  desc: (a, b) => b.price - a.price,
};

export function filterCatalog(all: Product[], f: CatalogFilters, ctx: CatalogContext): Product[] {
  const q = f.q.trim();
  const list = all.filter(
    (p) =>
      (f.cat === "all" || p.categoryId === f.cat) &&
      (!q || matchesQuery(norm(`${p.name} ${p.description} ${ctx.catLabels[p.categoryId] ?? ""} ${p.keyword}`), q)) &&
      inBudget(p.price, f.budget) &&
      (f.col !== "promos" || !!(p.comparePrice && p.comparePrice > p.price)) &&
      (f.col !== "nouveautes" || ctx.newIds.includes(p.id)) &&
      (f.col !== "selection" || ctx.selectionIds.includes(p.id)),
  );
  return list.sort(SORTERS[f.sort] ?? SORTERS.ventes);
}

// ───────────────────────── Divers ─────────────────────────
/** URL d'image sûre pour un `background` CSS (encode guillemets, parenthèses, barre oblique inverse ; retire les retours à la ligne). */
export function cssUrl(url: string): string {
  const safe = url
    .replace(/[\n\r]/g, "")
    .replace(/["'()\\]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  return `url("${safe}")`;
}

/** Rayon enrichi pour la coque (libellé localisé, pastel, nombre de produits). */
export type ShellCategory = { id: string; label: string; bg: string; count: number };
