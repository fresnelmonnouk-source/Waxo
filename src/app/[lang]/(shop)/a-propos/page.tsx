import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { pageTitle } from "@/components/account/page-meta";
import { EYEBROW } from "@/components/account/styles";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getSettings } from "@/lib/catalog";

type Props = { params: Promise<{ lang: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, "Info.meta", "about");

const CARD = "flex flex-col gap-[10px] rounded-[24px] bg-white p-6";
const NUM = "font-display text-[28px] font-bold text-terracotta";

export default async function Page({ params }: Props) {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);
  const { shipping } = await getSettings();
  const t = await getTranslations("About");

  return (
    <main className="min-h-[70vh]">
      <section className="mx-auto grid max-w-[1100px] grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-10 px-5 pt-12 pb-10">
        <div className="flex flex-col gap-5">
          <span className={EYEBROW}>{t("eyebrow")}</span>
          <h1 className="font-display m-0 text-[clamp(30px,4vw,48px)] leading-[1.06] font-semibold tracking-[-0.035em] text-balance">{t("title")}</h1>
          <p className="m-0 text-[17px] leading-[1.6] text-pretty text-text">{t("p1")}</p>
          <p className="m-0 text-[17px] leading-[1.6] text-pretty text-text">{t("p2")}</p>
        </div>
        <div className="flex aspect-[4/5] items-end rounded-[28px] bg-[#E9E2D3] p-[18px]">
          <span className="rounded-full bg-white/80 px-3 py-[6px] text-[13px] text-text">{t("photo")}</span>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-5 pt-4 pb-14">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4">
          <div className={CARD}>
            <span className={NUM}>01</span>
            <strong className="text-[18px]">{t("c1t")}</strong>
            <span className="leading-[1.55] text-text">{t("c1p")}</span>
          </div>
          <div className={CARD}>
            <span className={NUM}>02</span>
            <strong className="text-[18px]">{t("c2t")}</strong>
            <span className="leading-[1.55] text-text">{t("c2p")}</span>
          </div>
          <div className={CARD}>
            <span className={NUM}>03</span>
            <strong className="text-[18px]">{t("c3t")}</strong>
            <span className="leading-[1.55] text-text">{t("c3p", { days: shipping.returnDays })}</span>
          </div>
        </div>
      </section>

      <section className="bg-ink text-cream">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-6 px-5 py-14">
          <h2 className="font-display m-0 text-[clamp(24px,3vw,34px)] leading-[1.1] font-semibold tracking-[-0.03em]">{t("ctaTitle")}</h2>
          <div className="flex flex-wrap gap-[10px]">
            <Link
              href="/catalogue"
              className="rounded-full bg-sun px-[22px] py-[14px] font-semibold text-ink no-underline transition-colors hover:bg-sun-hover hover:text-ink"
            >
              {t("ctaCatalog")}
            </Link>
            <Link
              href="/contact"
              className="rounded-full border border-muted px-[22px] py-[14px] font-semibold text-cream no-underline transition-colors hover:border-cream hover:text-cream"
            >
              {t("ctaContact")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
