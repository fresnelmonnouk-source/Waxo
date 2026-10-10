import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/catalog";
import { buildSitemap, type SitemapProduct } from "@/lib/seo/sitemap-build";
import { siteUrl } from "@/lib/seo/site";

export const revalidate = 3600;

/** Toutes les langues + fiches produits avec hreflang. Si le catalogue est indisponible, on publie quand même les pages statiques. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let products: SitemapProduct[] = [];
  try {
    const [fr, en] = await Promise.all([getProducts("fr"), getProducts("en")]);
    const enById = new Map(en.map((p) => [p.id, p]));
    products = fr.map((p) => ({ id: p.id, slugs: { fr: p.slug, en: enById.get(p.id)?.slug ?? p.slug } }));
  } catch {
    products = [];
  }
  return buildSitemap(products, siteUrl());
}
