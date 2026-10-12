import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { SiteReviewForm } from "@/components/shop/SiteReviewForm";
import { routing } from "@/i18n/routing";
import { withSeo } from "@/lib/seo/metadata";

type Props = { params: Promise<{ lang: string }> };

// Formulaire d'avis : page utile aux clients, sans intérêt pour les moteurs de recherche (noindex).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const t = await getTranslations({ locale: lang, namespace: "SiteReviews" });
  return withSeo({ title: t("metaTitle"), description: t("metaDescription") }, lang, "/avis-boutique", { noindex: true });
}

/** « Donner mon avis sur Wá xɔ » : avis GÉNÉRAL sur la boutique (livraison, service, emballage), publié après relecture. */
export default async function Page({ params }: Props) {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);
  const t = await getTranslations("SiteReviews");

  return (
    <main data-screen-label="Avis boutique" className="mx-auto min-h-[70vh] max-w-[720px] px-5 pt-10 pb-[72px]">
      <h1 className="font-display m-0 mb-[10px] text-[clamp(30px,4vw,44px)] leading-[1.08] font-semibold tracking-[-0.035em]">
        {t("pageTitle")}
      </h1>
      <p className="text-text m-0 mb-3 text-[17px] leading-[1.55]">{t("pageIntro")}</p>
      <p className="m-0 mb-7 rounded-[14px] bg-[#FBEFC9] px-4 py-3 text-[15px] leading-[1.5]">{t("pageNote")}</p>
      <SiteReviewForm />
    </main>
  );
}
