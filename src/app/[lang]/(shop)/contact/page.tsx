import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/account/ContactForm";
import { pageTitle } from "@/components/account/page-meta";
import { EYEBROW } from "@/components/account/styles";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getSettings } from "@/lib/catalog";

type Props = { params: Promise<{ lang: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, "Info.meta", "contact");

const ROW_CARD =
  "flex items-center justify-between gap-3 rounded-[22px] bg-white px-[22px] py-5 text-ink no-underline transition-colors hover:bg-[#FAF8F3] hover:text-ink";

export default async function Page({ params }: Props) {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);
  const { brand } = await getSettings();
  const t = await getTranslations("Contact");

  return (
    <main className="mx-auto min-h-[70vh] max-w-[1100px] px-5 pt-10 pb-[72px]">
      <div className="mb-8 flex max-w-[640px] flex-col gap-3">
        <span className={EYEBROW}>{t("eyebrow")}</span>
        <h1 className="font-display m-0 text-[clamp(30px,4vw,46px)] leading-[1.06] font-semibold tracking-[-0.035em]">{t("title")}</h1>
        <p className="m-0 text-[17px] leading-[1.55] text-text">{t("intro")}</p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-start gap-6">
        <div className="flex flex-col gap-3">
          <a
            href={`https://wa.me/${brand.waNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col gap-[6px] rounded-[22px] bg-leaf p-[22px] text-white no-underline transition-colors hover:bg-[#185A3E] hover:text-white"
          >
            <strong className="text-[18px]">{t("whatsapp")}</strong>
            <span className="text-[15px]">{brand.whatsapp}</span>
            <span className="mt-[6px] text-[14px] font-semibold">{t("writeWa")}</span>
          </a>
          <a href={`tel:+${brand.waNumber}`} className={ROW_CARD}>
            <span className="flex flex-col gap-1">
              <strong>{t("phone")}</strong>
              <span className="text-[15px] text-text">{brand.whatsapp}</span>
            </span>
            <span className="text-[14px] font-semibold">{t("call")}</span>
          </a>
          <a href={`mailto:${brand.email}`} className={ROW_CARD}>
            <span className="flex flex-col gap-1">
              <strong>{t("email")}</strong>
              <span className="text-[15px] text-text">{brand.email}</span>
            </span>
            <span className="text-[14px] font-semibold">{t("write")}</span>
          </a>
          <div className="flex flex-col gap-[6px] rounded-[22px] border border-border px-[22px] py-5">
            <strong>{t("noShopTitle")}</strong>
            <span className="text-[15px] leading-[1.5] text-text">{t("noShopText")}</span>
          </div>
          <span className="px-[2px] py-1 text-[14px] text-text">
            {t.rich("faqHint", { faq: (c) => <Link href="/faq">{c}</Link> })}
          </span>
        </div>
        <div className="rounded-[24px] bg-white p-6">
          <ContactForm />
        </div>
      </div>
    </main>
  );
}
