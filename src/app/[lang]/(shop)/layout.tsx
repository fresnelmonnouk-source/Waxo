import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { CartDrawer } from "@/components/shop/CartDrawer";
import { DEFAULT_SETTINGS, getShopData } from "@/components/shop/data";
import { Footer } from "@/components/shop/Footer";
import { Header } from "@/components/shop/Header";
import { Newsletter } from "@/components/shop/Newsletter";
import { ShopToast } from "@/components/shop/ShopToast";
import { TopBar } from "@/components/shop/TopBar";
import { routing } from "@/i18n/routing";

/**
 * Coque de la boutique : bandeau, en-tête collant, contenu, newsletter, pied de page, tiroir panier et messages éphémères.
 * Reste statique : aucune lecture de cookies/headers (l'état de session et le panier sont lus côté navigateur).
 */
export default async function ShopLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);

  const [data, t] = await Promise.all([getShopData(lang), getTranslations({ locale: lang, namespace: "Shell" })]);
  const { settings } = data;

  return (
    <>
      <a
        href="#contenu"
        className="bg-sun text-ink! focus:outline-ink absolute -top-20 left-4 z-[80] rounded-full px-4 py-3 font-semibold no-underline focus:top-3"
      >
        {t("skip")}
      </a>
      <TopBar freeFrom={settings.shipping.freeFrom} cod={settings.pay.cod} />
      <Header categories={data.categories} searchIndex={data.searchIndex} total={data.products.length} />
      <div id="contenu" tabIndex={-1} className="outline-none">
        {children}
      </div>
      <Newsletter />
      <Footer brand={settings.brand} cod={settings.pay.cod} lang={lang} defaultHours={DEFAULT_SETTINGS.brand.hours} />
      <CartDrawer />
      <ShopToast />
    </>
  );
}
