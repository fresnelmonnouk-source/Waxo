import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { InfoPage, infoPageMetadata } from "@/components/account/legal/InfoPage";
import { routing } from "@/i18n/routing";

type Props = { params: Promise<{ lang: string }> };

// Régénération périodique de secours : l'enregistrement dans l'admin revalide aussi la page à la demande.
export const revalidate = 600;

// Contenu lu dans la table `pages` (repli : texte par défaut). Éditeur : /admin/pages.
export async function generateMetadata({ params }: Props) {
  const { lang } = await params;
  return infoPageMetadata("mentions-legales", lang);
}

export default async function Page({ params }: Props) {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);
  return <InfoPage slug="mentions-legales" lang={lang} />;
}
