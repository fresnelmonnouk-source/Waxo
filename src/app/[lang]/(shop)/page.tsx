import { onlinePayAvailable } from "@/lib/payment/ready";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getShopData } from "@/components/shop/data";
import { HomeHero } from "@/components/shop/HomeHero";
import { ArrivalNotice, BestSellers, CategoryTiles, HomeCatalog, HowItWorks } from "@/components/shop/HomeSections";
import { Selection } from "@/components/shop/Selection";
import { SiteReviews } from "@/components/shop/SiteReviews";
import { routing } from "@/i18n/routing";
import { getPublishedSiteReviews } from "@/lib/site-reviews/data";
import { seoPageMetadata } from "@/lib/seo/pages";

// Titre absolu (`SeoPages.home.title`) : l'accueil porte ses mots-clés, sans le gabarit « | Waxo ».
export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  return seoPageMetadata(lang, "home", "/");
}

// Accueil : héro, rayons, aperçu du catalogue, sélection, meilleures ventes, « Comment ça marche », avis sur la boutique. Page statique.
// Boutique vide (avant la saisie des vrais produits) : aucune section vide ni compteur à zéro, un seul bloc « Arrivage en cours ».
export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);
  // Avis boutique : jusqu'à 200 avis publiés pour une moyenne réelle ; l'accueil n'en affiche que 6.
  const [data, siteReviews] = await Promise.all([getShopData(lang), getPublishedSiteReviews(200)]);
  const online = await onlinePayAvailable(data.settings.pay);
  const empty = data.products.length === 0;

  return (
    <main data-screen-label="Accueil">
      <HomeHero products={data.products} settings={data.settings} bestIds={data.bestIds} newIds={data.newIds} online={online} />
      {empty ? (
        <ArrivalNotice />
      ) : (
        <>
          <CategoryTiles categories={data.categories} />
          <HomeCatalog products={data.products} total={data.products.length} />
          <Selection products={data.products} newIds={data.newIds} bestIds={data.bestIds} />
          <BestSellers products={data.products} bestIds={data.bestIds} />
        </>
      )}
      <HowItWorks />
      <SiteReviews reviews={siteReviews} />
    </main>
  );
}
