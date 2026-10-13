import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { InfoPage } from "@/components/account/legal/InfoPage";
import { routing } from "@/i18n/routing";
import { seoPageMetadata } from "@/lib/seo/pages";

type Props = { params: Promise<{ lang: string }> };

// Régénération : celle de la coque de la boutique (120 s, la plus petite valeur de la route l'emporte, T2) ; l'enregistrement
// dans l'admin revalide aussi la page à la demande.

// Contenu lu dans la table `pages` (repli : texte par défaut). Éditeur : /admin/pages. Titre et description : `SeoPages.cgu`.
export async function generateMetadata({ params }: Props) {
  const { lang } = await params;
  return seoPageMetadata(lang, "cgu", "/cgu");
}

export default async function Page({ params }: Props) {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);
  return <InfoPage slug="cgu" lang={lang} />;
}
