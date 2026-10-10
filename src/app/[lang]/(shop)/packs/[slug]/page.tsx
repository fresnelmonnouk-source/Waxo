import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { PackBuy } from "@/components/packs/PackBuy";
import { PackCard } from "@/components/packs/PackCard";
import { PackContents } from "@/components/packs/PackContents";
import { PackVisual } from "@/components/packs/PackVisual";
import { STOCK_COLOR, stockKind } from "@/components/shop/logic";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getSettings } from "@/lib/catalog";
import { getPackBySlug, getPacks } from "@/lib/catalog/packs";
import { fmtXof } from "@/lib/money";

// Page statique (ISR) : aucun cookies()/headers(). Prix, économie et stock se rafraîchissent toutes les 2 minutes.
export const revalidate = 120;

type Params = { lang: string; slug: string };

export async function generateStaticParams() {
  const lists = await Promise.all(routing.locales.map(async (lang) => ({ lang, list: await getPacks(lang) })));
  return lists.flatMap(({ lang, list }) => list.map((p) => ({ lang, slug: p.slug })));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!hasLocale(routing.locales, lang)) return {};
  setRequestLocale(lang);
  const pack = await getPackBySlug(lang, slug);
  if (!pack) return {};
  return { title: pack.name, description: pack.description };
}

export default async function PackPage({ params }: { params: Promise<Params> }) {
  const { lang, slug } = await params;
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);

  const pack = await getPackBySlug(lang, slug);
  if (!pack) notFound();

  const [t, tp, all, settings] = await Promise.all([
    getTranslations({ locale: lang, namespace: "Packs.detail" }),
    getTranslations({ locale: lang, namespace: "Packs" }),
    getPacks(lang),
    getSettings(),
  ]);

  const { cutoff, returnDays } = settings.shipping;
  const soldOut = pack.stock <= 0;
  const kind = stockKind(pack.stock);
  const stockText = soldOut ? t("stockOut") : kind === "low" ? t("stockLow", { count: pack.stock, cutoff }) : t("stockOk", { cutoff });
  const others = all.filter((p) => p.id !== pack.id).slice(0, 3);

  return (
    <main className="mx-auto min-h-[70vh] max-w-[1180px] px-5 pt-6 pb-20">
      <nav aria-label={tp("crumb")} className="text-muted mb-4 flex flex-wrap gap-2 text-[13px]">
        <Link href="/" className="text-muted!">
          {tp("home")}
        </Link>
        <span aria-hidden="true">/</span>
        <Link href="/packs" className="text-muted!">
          {tp("title")}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-ink">{pack.name}</span>
      </nav>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] items-start gap-9">
        <div className="relative">
          <PackVisual pack={pack} label={pack.name} large radius={28} />
          {soldOut ? (
            <span className="absolute top-[18px] left-[18px] rounded-full bg-[#E2DCCF] px-3 py-1.5 text-[13px] font-semibold text-[#4A443C]">
              {tp("card.soldOut")}
            </span>
          ) : pack.savingPercent > 0 ? (
            <span className="bg-terracotta-deep absolute top-[18px] left-[18px] rounded-full px-3 py-1.5 text-[13px] font-semibold text-white">
              {t("badge", { percent: pack.savingPercent })}
            </span>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-[18px]">
          <div className="flex flex-col gap-2.5">
            <span className="text-terracotta-deep text-[13px] font-semibold tracking-[0.04em] uppercase">{t("eyebrow")}</span>
            <h1 className="font-display m-0 text-[clamp(26px,3vw,38px)] leading-[1.1] font-semibold tracking-[-0.03em] text-balance">
              {pack.name}
            </h1>
            <div className="flex flex-wrap items-baseline gap-2.5">
              <strong className="text-[28px]">{fmtXof(pack.price)}</strong>
              {pack.saving > 0 ? (
                <>
                  <span className="text-muted text-[17px] line-through">{fmtXof(pack.itemsTotal)}</span>
                  <span className="bg-terracotta-deep rounded-full px-2.5 py-1 text-[13px] font-semibold text-white">
                    {t("badge", { percent: pack.savingPercent })}
                  </span>
                </>
              ) : null}
            </div>
          </div>
          <p className="text-text m-0 text-[16px] leading-[1.6] text-pretty">{pack.description}</p>

          {pack.saving > 0 ? (
            <dl className="bg-leaf-bg m-0 flex flex-col gap-1.5 rounded-2xl p-4 text-[14px]">
              <div className="flex justify-between gap-3">
                <dt className="text-text">{t("separately")}</dt>
                <dd className="m-0 font-medium">{fmtXof(pack.itemsTotal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text">{t("packPrice")}</dt>
                <dd className="m-0 font-medium">{fmtXof(pack.price)}</dd>
              </div>
              <div className="text-leaf border-leaf/20 mt-1 border-t pt-2 font-semibold">
                {t("youSave", { amount: fmtXof(pack.saving), percent: pack.savingPercent })}
              </div>
            </dl>
          ) : (
            <p className="text-text m-0 text-[14px]">{t("noSaving")}</p>
          )}

          <span className="text-[14px] font-medium" style={{ color: STOCK_COLOR[kind] }}>
            {stockText}
          </span>

          {soldOut ? (
            <div className="bg-card flex flex-col items-start gap-2.5 rounded-2xl p-4">
              <strong>{t("comingSoonTitle")}</strong>
              <span className="text-text text-[14px]">{t("comingSoonText")}</span>
              <Link
                href="/catalogue"
                className="bg-ink text-cream! hover:text-cream! inline-flex h-11 items-center rounded-full px-5 text-[14px] font-semibold no-underline"
              >
                {t("seeCatalog")}
              </Link>
            </div>
          ) : (
            <PackBuy pack={pack} />
          )}

          <div className="border-border text-text flex flex-col gap-2 border-t pt-4 text-[14px]">
            <span>{t("deliveryNote", { cutoff })}</span>
            <span>{settings.pay.cod ? t("payAll") : t("payNoCod")}</span>
            <span>
              {t("returns", { days: returnDays })} <Link href="/livraison-retours">{t("conditions")}</Link>
            </span>
          </div>
        </div>
      </div>

      <div className="mt-14">
        <PackContents items={pack.items} />
      </div>

      {others.length > 0 ? (
        <section aria-labelledby="other-packs" className="mt-14 flex flex-col gap-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="other-packs" className="font-display m-0 text-[22px] font-semibold tracking-[-0.02em]">
              {t("otherPacks")}
            </h2>
            <Link href="/packs" className="text-[14px] font-medium">
              {t("allPacks")}
            </Link>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-x-5 gap-y-8">
            {others.map((p) => (
              <PackCard key={p.id} pack={p} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
