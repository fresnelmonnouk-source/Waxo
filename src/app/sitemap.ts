import type { MetadataRoute } from "next";
import { getLiveCampaigns } from "@/lib/campaigns/data";
import { getProducts, getProductSlugs, getProductsUpdatedAt } from "@/lib/catalog";
import { getPackSlugs, getPacks, getPacksEnabled } from "@/lib/catalog/packs";
import { buildSitemap, type SitemapProduct } from "@/lib/seo/sitemap-build";
import { siteUrl } from "@/lib/seo/site";

export const revalidate = 3600;

/**
 * Pages publiques dans les deux langues, fiches produit et pack actives (hreflang par langue traduite, `lastmod` dès que
 * la migration 0019 est appliquée), campagnes en cours ou à venir. Catalogue vide : `/catalogue` retiré.
 * Base en panne : erreur, le sitemap précédent reste servi par l'ISR (décision D6) ; pendant le build, listes vides.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [fr, slugs, updated, packsEnabled, campaigns] = await Promise.all([
    getProducts("fr"),
    getProductSlugs(),
    getProductsUpdatedAt(),
    getPacksEnabled(),
    getLiveCampaigns(),
  ]);
  const products: SitemapProduct[] = fr.map((p) => ({ id: p.id, slugs: slugs.get(p.id) ?? { fr: p.slug }, updatedAt: updated.get(p.id) }));

  let packs: SitemapProduct[] = [];
  if (packsEnabled) {
    const [list, packSlugs] = await Promise.all([getPacks("fr"), getPackSlugs()]);
    packs = list.map((k) => ({ id: k.id, slugs: packSlugs.get(k.id) ?? { fr: k.slug } }));
  }

  return buildSitemap(products, siteUrl(), packs, {
    packsEnabled,
    catalogEmpty: fr.length === 0,
    campaigns: campaigns.map((c) => ({ slug: c.slug })),
  });
}
