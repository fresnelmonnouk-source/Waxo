import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { ShopSettings } from "@/lib/catalog/types";
import { legalValues } from "./LegalDoc";
import { ARTICLE, DOC_H1, DOC_H2, LegalShell } from "./LegalShell";
import { richTags } from "./rich";

const ROW = "grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1fr)] gap-3";

/** « Livraison et retours » (maquette 725-746) : tableau des zones, jour de livraison, procédure de retour. */
export function ShippingDoc({ settings }: { settings: ShopSettings }) {
  const t = useTranslations("Legal.shipping");
  const tRoot = useTranslations("Legal");
  const values = legalValues(settings, settings.pay.cod ? tRoot("codShip") : "");

  return (
    <LegalShell current="shipping">
      <article className={ARTICLE}>
        <h1 className={DOC_H1}>{t("title")}</h1>
        <div className="mt-2 overflow-hidden rounded-[18px] border border-border bg-white">
          <div className={`${ROW} bg-[#FAF8F3] px-4 py-3 text-[13px] font-semibold text-text`}>
            <span>{t("colZone")}</span>
            <span>{t("colDelay")}</span>
            <span>{t("colFee")}</span>
          </div>
          <div className={`${ROW} border-t border-border px-4 py-[14px] text-[15px]`}>
            <strong>{t("r1z")}</strong>
            <span>{t("r1d", values)}</span>
            <span>{t("r1f", values)}</span>
          </div>
          <div className={`${ROW} border-t border-border px-4 py-[14px] text-[15px]`}>
            <strong>{t("r2z")}</strong>
            <span>{t("r2d")}</span>
            <span>{t("r2f", values)}</span>
          </div>
          <div className={`${ROW} border-t border-border px-4 py-[14px] text-[15px] text-text`}>
            <strong>{t("r3z")}</strong>
            <span>{t("r3d")}</span>
            <span>{t("r3f")}</span>
          </div>
        </div>

        <h2 className={DOC_H2}>{t("dayH")}</h2>
        <p className="m-0">{t("dayP", values)}</p>

        <h2 className={DOC_H2}>{t("returnH")}</h2>
        <ol className="m-0 flex list-decimal flex-col gap-2 pl-[22px]">
          <li>{t.rich("step1", { ...values, ...richTags })}</li>
          <li>{t("step2")}</li>
          <li>{t("step3", values)}</li>
        </ol>

        <h2 className={DOC_H2}>{t("condH")}</h2>
        <p className="m-0">{t.rich("condP", richTags)}</p>

        <Link
          href="/contact"
          className="mt-3 inline-flex self-start rounded-full bg-ink px-[22px] py-[14px] font-semibold text-cream no-underline transition-colors hover:bg-[#2C2823] hover:text-cream"
        >
          {t("cta")}
        </Link>
      </article>
    </LegalShell>
  );
}
