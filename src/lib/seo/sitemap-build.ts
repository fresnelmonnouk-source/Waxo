// Construction du sitemap : fonction PURE (la lecture du catalogue est faite par src/app/sitemap.ts).
import { LOCALES, STATIC_PUBLIC_PATHS, absoluteUrl, type SeoLocale } from "./site";

export type SitemapProduct = { id: string; slugs: Partial<Record<SeoLocale, string>>; updatedAt?: string };
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

export function buildSitemap(products: SitemapProduct[], base: string, packs: SitemapProduct[] = []): SitemapEntry[] {
  const out: SitemapEntry[] = [];
  for (const p of STATIC_PUBLIC_PATHS) {
    const home = p === "/";
    out.push(...entry({ fr: p, en: p }, base, { changeFrequency: home || p === "/catalogue" ? "daily" : "monthly", priority: home ? 1 : p === "/catalogue" ? 0.9 : 0.5 }));
  }
  for (const prod of products) {
    const paths: Partial<Record<SeoLocale, string>> = {};
    for (const l of LOCALES) {
      const slug = prod.slugs[l] ?? prod.slugs.fr; // repli FR : la fiche existe dans les deux langues (même slug si pas de traduction)
      if (slug) paths[l] = `/produit/${encodeURIComponent(slug)}`;
    }
    out.push(...entry(paths, base, { changeFrequency: "weekly", priority: 0.8, lastModified: prod.updatedAt }));
  }
  // Fiches pack : mêmes règles (FR/EN, repli FR), un cran sous les produits.
  for (const pack of packs) {
    const paths: Partial<Record<SeoLocale, string>> = {};
    for (const l of LOCALES) {
      const slug = pack.slugs[l] ?? pack.slugs.fr;
      if (slug) paths[l] = `/packs/${encodeURIComponent(slug)}`;
    }
    out.push(...entry(paths, base, { changeFrequency: "weekly", priority: 0.7, lastModified: pack.updatedAt }));
  }
  return out;
}
