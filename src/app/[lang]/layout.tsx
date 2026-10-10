import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { fontClassNames } from "@/lib/fonts";
import { routing } from "@/i18n/routing";
import { ConsentBanner } from "@/components/tracking/ConsentBanner";
import { TrackingProvider } from "@/components/tracking/TrackingProvider";
import { JsonLd } from "@/lib/seo/JsonLdScript";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";
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

// Métadonnées par défaut du site. Le canonical et les hreflang sont posés PAR PAGE (helper `pageMetadata` de @/lib/seo/metadata) :
// les mettre ici ferait pointer toutes les pages vers l'accueil.
export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const locale = hasLocale(routing.locales, lang) ? lang : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "Seo" });
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t("siteName"), template: `%s · ${t("siteName")}` },
    description: t("description"),
    applicationName: t("siteName"),
    openGraph: { type: "website", siteName: t("siteName"), locale: locale === "en" ? "en_GB" : "fr_FR", title: t("siteName"), description: t("description") },
    twitter: { card: "summary_large_image", title: t("siteName"), description: t("description") },
  };
}

export default async function LangLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);

  return (
    <html lang={lang} className={fontClassNames}>
      <body>
        <JsonLd data={[organizationJsonLd(), websiteJsonLd(lang)]} />
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
