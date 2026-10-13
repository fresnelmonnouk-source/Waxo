import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { CampaignCountdown } from "@/components/shop/CampaignBanner";
import {
  campaignPage,
  formatCampaignDate,
} from "@/components/shop/campaign-logic";
import { ProductCard } from "@/components/shop/ProductCard";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getProducts } from "@/lib/catalog";
import { campaignName, campaignTagline } from "@/lib/campaigns/logic";
import { getLiveCampaigns } from "@/lib/campaigns/data";
import { pageMetadata, seoText } from "@/lib/seo/metadata";

// Page ISR rendue à la demande (pas de generateStaticParams : piège next-intl SSG + notFound()). Aucun cookies()/headers().
// Statut, prix et produits se rafraîchissent toutes les 2 minutes.
export const revalidate = 120;

type Params = { lang: string; slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!hasLocale(routing.locales, lang)) return {};
  setRequestLocale(lang);
  const found = campaignPage(await getLiveCampaigns(), slug);
  if (!found) return {};
  const [t, ts] = await Promise.all([
    getTranslations({ locale: lang, namespace: "Campaign" }),
    getTranslations({ locale: lang, namespace: "SeoPages" }),
  ]);
  const name = campaignName(found.campaign, lang);
  const description =
    seoText(campaignTagline(found.campaign, lang)) ??
    seoText(ts("campaign.descriptionFallback", { name })) ??
    t("metaDescription", { name });
  // Même slug en FR et en EN : canonique + hreflang ; Open Graph propre à la campagne.
  return pageMetadata({
    lang,
    path: `/campagne/${encodeURIComponent(slug)}`,
    title: ts("campaign.title", { name }),
    brand: ts("brand"),
    description,
  });
}

export default async function CampaignPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { lang, slug } = await params;
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);

  const [campaigns, t] = await Promise.all([
    getLiveCampaigns(),
    getTranslations({ locale: lang, namespace: "Campaign" }),
  ]);
  const found = campaignPage(campaigns, slug);
  // Inconnue, terminée ou désactivée : la page n'existe pas.
  if (!found) notFound();
  const { state, campaign } = found;
  const name = campaignName(campaign, lang);
  const tagline = campaignTagline(campaign, lang);
  const running = state === "running";
  const products = running
    ? (await getProducts(lang)).filter((p) => p.campaign?.slug === slug)
    : [];

  return (
    <main
      data-screen-label="Campagne"
      className="mx-auto min-h-[70vh] max-w-[1280px] px-5 pt-6 pb-[72px]"
    >
      <nav
        aria-label={t("crumb")}
        className="text-muted mb-[14px] flex gap-2 text-[13px]"
      >
        <Link href="/" className="text-muted! hover:text-muted! underline">
          {t("home")}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="min-w-0 truncate">{name}</span>
      </nav>

      <header className="bg-ink text-cream rounded-block mb-9 flex flex-col gap-4 px-6 py-8 min-[640px]:px-10 min-[640px]:py-11">
        <span className="text-sun text-[13px] font-semibold tracking-[0.04em] uppercase">
          {running ? t("eyebrow") : t("upcomingEyebrow")}
        </span>
        <h1 className="font-display m-0 text-[clamp(30px,5vw,56px)] leading-[1.02] font-semibold tracking-[-0.035em] break-words text-balance">
          {name}
        </h1>
        {tagline ? (
          <p className="text-cream/85 m-0 max-w-[640px] text-[16px] leading-[1.6] text-pretty">
            {tagline}
          </p>
        ) : null}
        {!running ? (
          <p className="text-cream/85 m-0 max-w-[640px] text-[16px] leading-[1.6] text-pretty">
            {t("upcomingText")}
          </p>
        ) : null}
        {campaign.showCountdown || !running ? (
          <CampaignCountdown
            target={running ? campaign.endsAt : campaign.startsAt}
            label={running ? t("endsIn") : t("startsIn")}
            size="lg"
          />
        ) : null}
        <span className="text-cream/75 text-[14px]">
          {running
            ? t("until", { date: formatCampaignDate(campaign.endsAt, lang) })
            : t("startsOn", {
                date: formatCampaignDate(campaign.startsAt, lang),
              })}
        </span>
      </header>

      {running ? (
        products.length > 0 ? (
          <>
            <p className="text-muted m-0 mb-5 text-[14px]">
              {t("count", { count: products.length })}
            </p>
            <section
              aria-label={t("listLabel")}
              className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-x-5 gap-y-7"
            >
              {products.map((p) => (
                <ProductCard key={p.id} product={p} animate />
              ))}
            </section>
          </>
        ) : (
          <div className="bg-card rounded-card flex max-w-[560px] flex-col items-start gap-3 p-6">
            <strong className="font-display text-[20px] tracking-[-0.02em]">
              {t("empty")}
            </strong>
            <Link
              href="/catalogue"
              className="bg-ink text-cream! hover:text-cream! inline-flex h-11 items-center rounded-full px-6 text-[15px] font-semibold no-underline hover:bg-[#2C2823]"
            >
              {t("emptyCta")}
            </Link>
          </div>
        )
      ) : null}
    </main>
  );
}
