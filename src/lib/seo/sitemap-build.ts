// Construction du sitemap : fonction PURE (la lecture du catalogue est faite par src/app/sitemap.ts).
import { LOCALES, STATIC_PUBLIC_PATHS, absoluteUrl, type SeoLocale } from "./site";

/** Fiche (produit ou pack). Slug `en` absent = pas de texte anglais : fiche FR seule, sans alternate EN (S8). */
export type SitemapProduct = { id: string; slugs: Partial<Record<SeoLocale, string>>; updatedAt?: string };
/** Campagne en cours ou à venir : même slug en FR et en EN. */
export type SitemapCampaign = { slug: string };
export type SitemapEntry = {
  url: string;
  lastModified?: string;
  changeFrequency?: "daily" | "weekly" | "monthly";
  priority?: number;
  alternates: { languages: Record<string, string> };
};

function entry(paths: Partial<Record<SeoLocale, string>>, base: string, extra: Partial<SitemapEntry> = {}): SitemapEntry[] {
  const languages: Record<string, string> = {};
  for (const l of LOCALES) if (paths[l]) languages[l] = absoluteUrl(l, paths[l] as string, base);
  const fr = paths.fr ?? paths.en;
  if (fr) languages["x-default"] = languages.fr ?? languages.en;
  return LOCALES.filter((l) => paths[l]).map((l) => ({ url: languages[l], alternates: { languages }, ...extra }));
}

export function buildSitemap(
  products: SitemapProduct[],
  base: string,
  packs: SitemapProduct[] = [],
  opts: { packsEnabled?: boolean; catalogEmpty?: boolean; campaigns?: SitemapCampaign[] } = {},
): SitemapEntry[] {
  const out: SitemapEntry[] = [];
  const packsOn = opts.packsEnabled !== false;
  for (const p of STATIC_PUBLIC_PATHS) {
    if (p === "/packs" && !packsOn) continue; // packs désactivés depuis l'admin : la page est en 404, hors sitemap
    if (p === "/catalogue" && opts.catalogEmpty) continue; // catalogue vide : `noindex`, hors sitemap (soft-404, S14)
    const home = p === "/";
    out.push(...entry({ fr: p, en: p }, base, { changeFrequency: home || p === "/catalogue" ? "daily" : "monthly", priority: home ? 1 : p === "/catalogue" ? 0.9 : 0.5 }));
  }
  for (const prod of products) {
    const paths: Partial<Record<SeoLocale, string>> = {};
    for (const l of LOCALES) {
      const slug = prod.slugs[l]; // pas de repli : sans texte anglais, la page /en est une copie de la FR (canonique FR)
      if (slug) paths[l] = `/produit/${encodeURIComponent(slug)}`;
    }
    out.push(...entry(paths, base, { changeFrequency: "weekly", priority: 0.8, lastModified: prod.updatedAt }));
  }
  // Fiches pack : mêmes règles (une entrée par langue traduite), un cran sous les produits.
  for (const pack of packsOn ? packs : []) {
    const paths: Partial<Record<SeoLocale, string>> = {};
    for (const l of LOCALES) {
      const slug = pack.slugs[l];
      if (slug) paths[l] = `/packs/${encodeURIComponent(slug)}`;
    }
    out.push(...entry(paths, base, { changeFrequency: "weekly", priority: 0.7, lastModified: pack.updatedAt }));
  }
  // Campagnes en cours ou à venir (pages indexables, même slug dans les deux langues).
  for (const c of opts.campaigns ?? []) {
    const path = `/campagne/${encodeURIComponent(c.slug)}`;
    out.push(...entry({ fr: path, en: path }, base, { changeFrequency: "daily", priority: 0.6 }));
  }
  return out;
}
