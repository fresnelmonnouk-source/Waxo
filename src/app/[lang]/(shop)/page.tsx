import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getShopData } from "@/components/shop/data";
import { HomeHero } from "@/components/shop/HomeHero";
import { BestSellers, CategoryTiles, HomeCatalog, HowItWorks } from "@/components/shop/HomeSections";
import { Selection } from "@/components/shop/Selection";
import { routing } from "@/i18n/routing";
import { withSeo } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  return withSeo({}, lang, "/");
}

// Accueil : héro, rayons, aperçu du catalogue, sélection, meilleures ventes, « Comment ça marche ». Page statique.
export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);
  const data = await getShopData(lang);

  return (
    <main data-screen-label="Accueil">
      <HomeHero products={data.products} settings={data.settings} bestIds={data.bestIds} newIds={data.newIds} />
      <CategoryTiles categories={data.categories} />
      <HomeCatalog products={data.products} total={data.products.length} />
      <Selection products={data.products} newIds={data.newIds} bestIds={data.bestIds} />
      <BestSellers products={data.products} bestIds={data.bestIds} />
      <HowItWorks />
    </main>
  );
}
