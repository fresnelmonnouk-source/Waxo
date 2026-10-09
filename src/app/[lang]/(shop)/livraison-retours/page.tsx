import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ShippingDoc } from "@/components/account/legal/ShippingDoc";
import { pageTitle } from "@/components/account/page-meta";
import { routing } from "@/i18n/routing";
import { getSettings } from "@/lib/catalog";

type Props = { params: Promise<{ lang: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, "Legal.shipping", "title");

// Contenu dans les messages (namespace Legal) pour l'instant ; passera en base (table `pages`) plus tard.
export default async function Page({ params }: Props) {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);
  const settings = await getSettings();
  return <ShippingDoc settings={settings} />;
}
