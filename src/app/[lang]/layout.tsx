import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { fontClassNames } from "@/lib/fonts";
import { routing } from "@/i18n/routing";
import { ConsentBanner } from "@/components/tracking/ConsentBanner";
import { TrackingProvider } from "@/components/tracking/TrackingProvider";
import { getSettings, type ShopSettings } from "@/lib/catalog";
import { JsonLd } from "@/lib/seo/JsonLdScript";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";
import { SEO_BRAND } from "@/lib/seo/metadata";
import { siteUrl } from "@/lib/seo/site";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((lang) => ({ lang }));
}

export const viewport: Viewport = {
  themeColor: "#F4F1EA",
  width: "device-width",
  initialScale: 1,
};

// Métadonnées par défaut du site. Le canonical, les hreflang et l'Open Graph de chaque page sont posés PAR PAGE
// (`seoPageMetadata` / `pageMetadata` de @/lib/seo) : les mettre ici ferait pointer toutes les pages vers l'accueil.
// Gabarit des titres : « {titre de page} | Waxo » (décision de Fresnel : « Waxo » dans Google, « Wá xɔ » sur le site).
export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const locale = hasLocale(routing.locales, lang) ? lang : routing.defaultLocale;
  const [t, ts] = await Promise.all([
    getTranslations({ locale, namespace: "Seo" }),
    getTranslations({ locale, namespace: "SeoPages" }),
  ]);
  const brand = ts.has("brand") ? ts("brand") : SEO_BRAND;
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: brand, template: `%s | ${brand}` },
    description: t("description"),
    applicationName: t("siteName"),
    openGraph: { type: "website", siteName: t("siteName"), locale: locale === "en" ? "en_GB" : "fr_FR", title: brand, description: t("description") },
    twitter: { card: "summary_large_image", title: brand, description: t("description") },
  };
}

/** Réglages pour le JSON-LD Organization. Base en panne : organisation sans coordonnées plutôt qu'une page en erreur. */
async function orgSettings(): Promise<ShopSettings | null> {
  try {
    return await getSettings();
  } catch {
    return null;
  }
}

export default async function LangLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);
  const settings = await orgSettings();
  const brand = settings?.brand;
  // Téléphone au format international (+229…) depuis le numéro WhatsApp des réglages ; rien s'il n'est pas renseigné.
  const phone = brand?.waNumber?.replace(/\D/g, "") ? `+${brand.waNumber.replace(/\D/g, "")}` : brand?.whatsapp;

  return (
    <html lang={lang} className={fontClassNames}>
      <body>
        <JsonLd data={[organizationJsonLd({ email: brand?.email, phone }), websiteJsonLd(lang)]} />
        <NextIntlClientProvider>
          {children}
          {/* Aucun script de suivi avant consentement ; le bandeau et le suivi ne lisent que le navigateur (pages restent statiques). */}
          <ConsentBanner />
          <TrackingProvider />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
