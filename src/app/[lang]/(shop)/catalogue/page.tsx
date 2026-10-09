import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { CatalogStatic } from "@/components/shop/CatalogStatic";
import { CatalogView } from "@/components/shop/CatalogView";
import { getShopData } from "@/components/shop/data";
import { routing } from "@/i18n/routing";

// Type local : PageProps<"/[lang]/catalogue"> n'existe qu'après la génération des types de routes par Next.
type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props) {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) return {};
  const t = await getTranslations({ locale: lang, namespace: "Catalog" });
  return { title: t("title") };
}

// Catalogue : page statique ; filtres et tri pilotés par l'URL et appliqués côté navigateur (24 produits).
export default async function CatalogPage({ params }: Props) {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);
  const data = await getShopData(lang);

  return (
    <main data-screen-label="Catalogue" className="mx-auto min-h-[70vh] max-w-[1280px] px-5 pt-6 pb-[72px]">
      <Suspense fallback={<CatalogStatic products={data.products} newIds={data.newIds} bestIds={data.bestIds} />}>
        <CatalogView products={data.products} categories={data.categories} newIds={data.newIds} bestIds={data.bestIds} />
      </Suspense>
    </main>
  );
}
