import { use } from "react";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { FavoritesView } from "@/components/account/FavoritesView";
import { pageTitle } from "@/components/account/page-meta";
import { routing } from "@/i18n/routing";

type Props = { params: Promise<{ lang: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, "Info.meta", "favoris");

// Statique : les favoris vivent dans le navigateur, les produits sont chargés côté client via GET /api/products.
export default function Page({ params }: Props) {
  const { lang } = use(params);
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);

  return (
    <main className="mx-auto min-h-[70vh] max-w-[1280px] px-5 pt-6 pb-[72px]">
      <FavoritesView />
    </main>
  );
}
