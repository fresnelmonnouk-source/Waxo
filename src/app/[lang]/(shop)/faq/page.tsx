import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { FaqList } from "@/components/account/FaqList";
import { richTags } from "@/components/account/legal/rich";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getSettings } from "@/lib/catalog";
import { fmtXof } from "@/lib/money";
import { JsonLd } from "@/lib/seo/JsonLdScript";
import { faqJsonLd } from "@/lib/seo/jsonld";
import { seoPageMetadata } from "@/lib/seo/pages";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props) {
  const { lang } = await params;
  return seoPageMetadata(lang, "faq", "/faq");
}

/** Balises riches des réponses, rendues en texte brut pour le JSON-LD FAQPage (mêmes mots que la page). */
const plainTags = Object.fromEntries(Object.keys(richTags).map((k) => [k, (chunks: string) => chunks]));

export default async function Page({ params }: Props) {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);
  const settings = await getSettings();
  const t = await getTranslations("Faq");

  // Chiffres issus des réglages (frais, franco, délai de retour) : la FAQ suit toujours les valeurs réelles.
  const values = {
    cutoff: settings.shipping.cutoff,
    cotonou: fmtXof(settings.shipping.cotonou),
    autre: fmtXof(settings.shipping.autre),
    freeShip: fmtXof(settings.shipping.freeFrom),
    days: settings.shipping.returnDays,
    cod: settings.pay.cod ? t("cod") : "",
  };
  const numbers = [1, 2, 3, 4, 5, 6, 7, 8];
  const items = numbers.map((n) => ({
    id: `q${n}`,
    question: t(`q${n}`),
    answer: t.rich(`a${n}`, { ...values, ...richTags }),
  }));
  const ld = faqJsonLd(numbers.map((n) => ({ question: t(`q${n}`), answer: t.markup(`a${n}`, { ...values, ...plainTags }) })));

  return (
    <main className="mx-auto min-h-[70vh] max-w-[860px] px-5 pt-10 pb-[72px]">
      <JsonLd data={ld} />
      <h1 className="font-display m-0 mb-[10px] text-[clamp(30px,4vw,44px)] font-semibold tracking-[-0.035em]">{t("title")}</h1>
      <p className="m-0 mb-7 text-[16px] text-text">{t.rich("intro", richTags)}</p>
      <FaqList items={items} />
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-[22px] bg-white p-[22px]">
        <strong className="text-[17px]">{t("stillTitle")}</strong>
        <div className="flex flex-wrap gap-[10px]">
          <Link
            href="/contact"
            className="flex min-h-[46px] items-center rounded-full border border-border-strong px-5 font-medium text-ink no-underline transition-colors hover:bg-cream hover:text-ink"
          >
            {t("contactCta")}
          </Link>
        </div>
      </div>
    </main>
  );
}
