import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { BrandSettings } from "@/lib/catalog/types";
import { LangSwitch } from "./LangSwitch";

const COL_TITLE = "text-[13px] font-bold tracking-[0.08em] text-[#B9B1A4] uppercase";
const LINK = "text-cream! hover:text-sun! no-underline";

/** Pied de page (maquette lignes 913-956). Coordonnées et paiement à la livraison viennent des réglages. */
export function Footer({ brand, cod, lang, defaultHours }: { brand: BrandSettings; cod: boolean; lang: string; defaultHours: string }) {
  const t = useTranslations("Footer");
  // Les horaires des réglages sont saisis en français : en anglais, on ne remplace que le texte par défaut.
  const hours = lang === "en" && brand.hours === defaultHours ? t("hours") : brand.hours;
  const year = new Date().getFullYear();

  return (
    <footer aria-label={t("label")} className="bg-ink text-cream">
      <div className="mx-auto grid max-w-[1280px] grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-8 px-5 pt-14 pb-8">
        <div className="flex flex-col gap-[10px]">
          <span className="font-display text-[28px] font-bold tracking-[-0.03em]">
            Wá x<span className="text-terracotta">ɔ</span>
          </span>
          <span className="text-cream text-[14px]">{t("tagline")}</span>
          <span className="text-[14px] leading-normal text-[#B9B1A4]">{t("blurb")}</span>
        </div>
        <div className="flex flex-col gap-[10px] text-[14px]">
          <strong className={COL_TITLE}>{t("shop")}</strong>
          <Link href="/catalogue" className={LINK}>
            {t("all")}
          </Link>
          <Link href="/catalogue?col=nouveautes" className={LINK}>
            {t("new")}
          </Link>
          <Link href="/catalogue?col=ventes" className={LINK}>
            {t("best")}
          </Link>
          <Link href="/catalogue?col=notes" className={LINK}>
            {t("topRated")}
          </Link>
          <Link href="/catalogue?col=promos" className={LINK}>
            {t("promos")}
          </Link>
        </div>
        <div className="flex flex-col gap-[10px] text-[14px]">
          <strong className={COL_TITLE}>{t("help")}</strong>
          <Link href="/contact" className={LINK}>
            {t("contact")}
          </Link>
          <Link href="/faq" className={LINK}>
            {t("faq")}
          </Link>
          <Link href="/livraison-retours" className={LINK}>
            {t("shipping")}
          </Link>
          <Link href="/suivi" className={LINK}>
            {t("track")}
          </Link>
          <Link href="/a-propos" className={LINK}>
            {t("about")}
          </Link>
        </div>
        <div className="flex flex-col gap-[10px] text-[14px]">
          <strong className={COL_TITLE}>{t("legal")}</strong>
          <Link href="/cgv" className={LINK}>
            {t("cgv")}
          </Link>
          <Link href="/cgu" className={LINK}>
            {t("cgu")}
          </Link>
          <Link href="/mentions-legales" className={LINK}>
            {t("mentions")}
          </Link>
          <Link href="/confidentialite" className={LINK}>
            {t("privacy")}
          </Link>
        </div>
        <div className="flex flex-col gap-[10px] text-[14px]">
          <strong className={COL_TITLE}>{t("reach")}</strong>
          <a href={`https://wa.me/${brand.waNumber.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className={LINK}>
            {t("whatsapp", { phone: brand.whatsapp })}
          </a>
          <a href={`mailto:${brand.email}`} className={LINK}>
            {brand.email}
          </a>
          <span className="leading-normal text-[#B9B1A4]">{hours}</span>
        </div>
      </div>
      <div className="border-t border-[#2C2823]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-6 gap-y-[10px] px-5 py-[18px] text-[13px] text-[#B9B1A4]">
          <span>{t("copyright", { year })}</span>
          <span>
            {t("payments")}
            {cod ? t("paymentsCod") : ""}
          </span>
          <LangSwitch />
        </div>
      </div>
    </footer>
  );
}
