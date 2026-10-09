import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getSettings } from "@/lib/catalog";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";

// Page statique : le panier vit dans le navigateur ; les réglages (frais, franco, moyens de paiement) viennent
// de la base et se rafraîchissent toutes les minutes. Le serveur (place_order) reste l'autorité sur les montants.
export const revalidate = 60;

type Params = { lang: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) return {};
  setRequestLocale(lang);
  const t = await getTranslations({ locale: lang, namespace: "Checkout" });
  return { title: t("pageTitle"), robots: { index: false, follow: false } };
}

export default async function CheckoutPage({ params }: { params: Promise<Params> }) {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);
  const settings = await getSettings();
  return <CheckoutFlow shipping={settings.shipping} pay={settings.pay} />;
}
