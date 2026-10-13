import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AssistantWidget } from "@/components/assistant/AssistantWidget";
import { CampaignBanner } from "@/components/shop/CampaignBanner";
import { shopCampaigns } from "@/components/shop/campaign-logic";
import { CartSanitizer } from "@/components/shop/CartSanitizer";
import { CartDrawer } from "@/components/shop/CartDrawer";
import { CheckoutInert } from "@/components/shop/CheckoutInert";
import { DEFAULT_SETTINGS, getShopData } from "@/components/shop/data";
import { Footer } from "@/components/shop/Footer";
import { Header } from "@/components/shop/Header";
import { Newsletter } from "@/components/shop/Newsletter";
import { ShopToast } from "@/components/shop/ShopToast";
import { TopBar } from "@/components/shop/TopBar";
import { getLiveCampaigns } from "@/lib/campaigns/data";
import { CurrencyProvider } from "@/lib/currency/client";
import { FavoritesSanitizer } from "@/lib/favorites/FavoritesSanitizer";
import { routing } from "@/i18n/routing";
import { onlinePayAvailable } from "@/lib/payment/ready";

/** ISR : prix, stocks et réglages de TOUTES les pages de la boutique se rafraîchissent toutes les 2 min (sinon ils restent figés jusqu'au prochain déploiement — T5). */
export const revalidate = 120;

/**
 * Coque de la boutique : bandeau, en-tête collant, contenu, newsletter, pied de page, tiroir panier et messages éphémères.
 * Reste statique : aucune lecture de cookies/headers (l'état de session et le panier sont lus côté navigateur).
 * Sur le tunnel de commande (calque plein écran), bandeau, en-tête, newsletter et pied de page sont rendus inertes (CheckoutInert).
 */
export default async function ShopLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);

  const [data, t, campaigns] = await Promise.all([
    getShopData(lang),
    getTranslations({ locale: lang, namespace: "Shell" }),
    getLiveCampaigns(),
  ]);
  const { settings } = data;
  const online = await onlinePayAvailable(settings.pay);
  // Campagne en cours mise en avant (lien du menu + bannière), selon les interrupteurs de l'admin.
  const campaign = shopCampaigns(campaigns, lang);

  return (
    <CurrencyProvider fx={data.fx}>
      <CheckoutInert>
        <a
          href="#contenu"
          className="bg-sun text-ink! focus:outline-ink absolute -top-20 left-4 z-[80] rounded-full px-4 py-3 font-semibold no-underline focus:top-3"
        >
          {t("skip")}
        </a>
        {campaign.banner ? <CampaignBanner campaign={campaign.banner} /> : null}
        <TopBar freeFrom={settings.shipping.freeFrom} cod={settings.pay.cod} cutoff={settings.shipping.cutoff} />
        <Header
          categories={data.categories}
          searchIndex={data.searchIndex}
          total={data.products.length}
          packsEnabled={settings.features.packs}
          campaign={campaign.header}
        />
      </CheckoutInert>
      <div id="contenu" tabIndex={-1} className="outline-none">
        {children}
      </div>
      <CheckoutInert>
        <Newsletter />
        <Footer
          brand={settings.brand}
          cod={settings.pay.cod}
          online={online}
          cutoff={settings.shipping.cutoff}
          lang={lang}
          defaultHours={DEFAULT_SETTINGS.brand.hours}
        />
      </CheckoutInert>
      <CartDrawer />
      <CartSanitizer />
      <FavoritesSanitizer />
      <ShopToast />
      <AssistantWidget />
    </CurrencyProvider>
  );
}
