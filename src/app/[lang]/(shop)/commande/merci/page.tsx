import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getSettings } from "@/lib/catalog";
import { OrderConfirmation } from "@/components/checkout/OrderConfirmation";

export const revalidate = 60;

type Params = { lang: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) return {};
  setRequestLocale(lang);
  const t = await getTranslations({ locale: lang, namespace: "Thanks" });
  return { title: t("pageTitle"), robots: { index: false, follow: false } };
}

export default async function ThanksPage({ params }: { params: Promise<Params> }) {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);
  const settings = await getSettings();
  return <OrderConfirmation cutoff={settings.shipping.cutoff} />;
}
