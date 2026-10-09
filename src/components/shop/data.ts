import "server-only";
import { cache } from "react";
import type { Locale } from "@/i18n/routing";
import { DEFAULT_SETTINGS, getCategories, getProducts, getSettings } from "@/lib/catalog";
import { bestSellerIds, buildSearchEntry, newIds } from "./logic";

export { DEFAULT_SETTINGS };

/**
 * Données communes de la coque et des pages boutique (serveur). `cache` : la coque et la page lisent le catalogue
 * une seule fois par rendu. Ne lit jamais cookies/headers : les pages restent statiques.
 */
export const getShopData = cache(async (lang: Locale) => {
  const [products, categories, settings] = await Promise.all([getProducts(lang, { sort: "popular" }), getCategories(lang), getSettings()]);
  const catLabels = Object.fromEntries(categories.map((c) => [c.id, c.label]));
  const counts = Object.fromEntries(categories.map((c) => [c.id, products.filter((p) => p.categoryId === c.id).length]));
  return {
    products, // triés par ventes décroissantes
    categories: categories.map((c) => ({ ...c, count: counts[c.id] ?? 0 })),
    settings,
    catLabels,
    bestIds: bestSellerIds(products),
    newIds: newIds(products),
    searchIndex: products.map((p) => buildSearchEntry(p, catLabels[p.categoryId] ?? "")),
  };
});

export type ShopData = Awaited<ReturnType<typeof getShopData>>;
