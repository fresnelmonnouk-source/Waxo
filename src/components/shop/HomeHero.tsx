import { useLocale, useTranslations } from "next-intl";
import { HeroAssistantCard } from "@/components/assistant/entries";
import { Link } from "@/i18n/navigation";
import type { Product, ShopSettings } from "@/lib/catalog/types";
import { fmtXof } from "@/lib/money";
import { TAG_STYLE, cssUrl, fmtRating, heroProducts, productTag, promoLabel, storeRating, type TagKind } from "./logic";

const STAR = "M12 2.6l2.8 6 6.6.6-5 4.5 1.5 6.5L12 16.9l-5.9 3.3 1.5-6.5-5-4.5 6.6-.6z";

function HeroImage({ url }: { url: string | null }) {
  return url ? <div aria-hidden="true" className="absolute inset-0" style={{ background: `${cssUrl(url)} center/cover no-repeat` }} /> : null;
}

/** Héro de l'accueil (maquette lignes 147-206), avec la carte « Dites à l'assistant ce dont vous avez besoin » (J3). */
export function HomeHero({
  products,
  settings,
  bestIds,
  newIds,
}: {
  products: Product[];
  settings: ShopSettings;
  bestIds: string[];
  newIds: string[];
}) {
  const t = useTranslations("Home");
  const tc = useTranslations("Card");
  const locale = useLocale();
  const cod = settings.pay.cod;
  const hero = heroProducts(products, bestIds);
  const feat = hero[0];
  const side = hero.slice(1, 3);
  const rating = storeRating(products);

  const tagOf = (p: Product): TagKind => productTag(p, { newIds, bestIds }) ?? "best";
  const tagText = (p: Product, k: TagKind) =>
    k === "soldout" ? tc("soldOut") : k === "promo" ? promoLabel(p) : k === "new" ? tc("tagNew") : tc("tagBest");

  return (
    <section className="mx-auto max-w-[1280px] px-5 pt-5">
      <div className="bg-ink text-cream overflow-hidden rounded-[32px]">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-10 p-[clamp(28px,4vw,56px)]">
          <div className="flex min-w-0 flex-col gap-[22px]">
            <span className="text-terracotta text-[13px] font-semibold tracking-[0.08em] uppercase">{t("heroEyebrow")}</span>
            <h1 className="font-display m-0 text-[clamp(34px,4.6vw,60px)] leading-[1.04] font-semibold tracking-[-0.035em] text-balance">{t("title")}</h1>
            <p className="m-0 max-w-[500px] text-[18px] leading-normal text-[#D6CFC0] text-pretty">
              {t("lead")} {cod ? t("payCod") : t("payNoCod")}
            </p>
            <HeroAssistantCard />
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/catalogue"
                className="bg-sun text-ink! hover:bg-cream hover:text-ink! rounded-full px-[26px] py-[15px] text-[16px] font-semibold no-underline"
              >
                {t("seeProducts", { count: products.length })}
              </Link>
              {rating.count > 0 ? (
                <span className="flex items-center gap-[6px] text-[14px] text-[#D6CFC0]">
                  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
                    <path d={STAR} fill="#FFC93C" />
                  </svg>
                  {t("rating", { rating: fmtRating(rating.avg, locale), count: rating.count })}
                </span>
              ) : null}
            </div>
          </div>
          {feat ? (
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <strong className="text-[15px]">{t("promosTitle")}</strong>
                <Link href="/catalogue?col=promos" className="text-cream! hover:text-cream! text-[14px] whitespace-nowrap underline">
                  {t("seeAllArrow")}
                </Link>
              </div>
              <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-3">
                <Link
                  href={`/produit/${feat.slug}`}
                  className="text-ink! hover:text-ink! relative row-span-2 flex min-h-[340px] flex-col justify-between overflow-hidden rounded-[24px] p-[18px] no-underline transition-transform duration-200 hover:-translate-y-1"
                  style={{ background: feat.bg ?? "#E9E2D3" }}
                >
                  <HeroImage url={feat.imageUrl} />
                  <span
                    className="relative self-start rounded-full px-3 py-[6px] text-[13px] font-semibold"
                    style={{ background: TAG_STYLE[tagOf(feat)].bg, color: TAG_STYLE[tagOf(feat)].color }}
                  >
                    {tagText(feat, tagOf(feat))}
                  </span>
                  <span aria-hidden="true" className="font-display relative text-[clamp(28px,3.4vw,44px)] leading-none font-semibold tracking-[-0.04em] opacity-80">
                    {feat.keyword}
                  </span>
                  <div className="relative flex flex-col gap-[6px] rounded-[16px] bg-white/90 px-[14px] py-3">
                    <span className="text-[15px] leading-[1.25] font-semibold">{feat.name}</span>
                    <div className="flex items-baseline gap-2">
                      <strong className="text-[18px]">{fmtXof(feat.price)}</strong>
                      {feat.comparePrice && feat.comparePrice > feat.price ? (
                        <span className="text-muted text-[14px] line-through">{fmtXof(feat.comparePrice)}</span>
                      ) : null}
                    </div>
                  </div>
                </Link>
                {side.map((p) => {
                  const k = tagOf(p);
                  return (
                    <Link
                      key={p.id}
                      href={`/produit/${p.slug}`}
                      className="text-ink! hover:text-ink! relative flex min-h-[164px] flex-col justify-between overflow-hidden rounded-[24px] p-[14px] no-underline transition-transform duration-200 hover:-translate-y-1"
                      style={{ background: p.bg ?? "#E9E2D3" }}
                    >
                      <HeroImage url={p.imageUrl} />
                      <span
                        className="relative self-start rounded-full px-[10px] py-1 text-[12px] font-semibold"
                        style={{ background: TAG_STYLE[k].bg, color: TAG_STYLE[k].color }}
                      >
                        {tagText(p, k)}
                      </span>
                      <div className="relative flex items-end justify-between gap-2 rounded-[12px] bg-white/90 py-2 pr-2 pl-[10px]">
                        <span className="text-[13px] leading-[1.25] font-medium">{p.name}</span>
                        <span className="bg-ink text-cream rounded-full px-[9px] py-[5px] text-[12px] font-semibold whitespace-nowrap">{fmtXof(p.price)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
        <div
          role="group"
          aria-label={t("guarantees")}
          className="grid grid-cols-1 gap-px border-t border-[rgba(244,241,234,0.18)] bg-[rgba(244,241,234,0.18)] min-[420px]:grid-cols-2 min-[760px]:grid-cols-4"
        >
          {[
            [t("g1Title"), t("g1Sub", { hour: settings.shipping.cutoff })],
            [cod ? t("g2CodTitle") : t("g2Title"), cod ? t("g2CodSub") : t("g2Sub")],
            [t("g3Title"), t("g3Sub")],
            [t("g4Title", { days: settings.shipping.returnDays }), t("g4Sub")],
          ].map(([title, sub]) => (
            <div key={title} className="bg-ink flex flex-col gap-[3px] px-6 py-[18px]">
              <strong className="text-[15px]">{title}</strong>
              <span className="text-[13px] text-[#B9B1A4]">{sub}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
