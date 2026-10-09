import { useTranslations } from "next-intl";
import type { ShopSettings } from "@/lib/catalog/types";
import { fmtXof } from "@/lib/money";
import { LegalShell, ARTICLE, DOC_H1, DOC_H2 } from "./LegalShell";
import { richTags } from "./rich";

/** Valeurs injectées dans les textes légaux : tout vient des réglages (frais, franco, délais), jamais codé en dur. */
export function legalValues(settings: ShopSettings, cod: string) {
  const { shipping, brand } = settings;
  return {
    cotonou: fmtXof(shipping.cotonou),
    autre: fmtXof(shipping.autre),
    freeShip: fmtXof(shipping.freeFrom),
    cutoff: shipping.cutoff,
    days: shipping.returnDays,
    phone: brand.whatsapp,
    email: brand.email,
    cod,
  };
}

const DOCS = {
  cgv: { sections: 10, effective: true, page: "cgv" },
  cgu: { sections: 8, effective: true, page: "cgu" },
  mentions: { sections: 5, effective: false, page: "mentions" },
  privacy: { sections: 8, effective: true, page: "privacy" },
} as const;

/** Page légale à sections numérotées (CGV, CGU, mentions légales, confidentialité). Contenu dans les messages (passera en base `pages` plus tard). */
export function LegalDoc({ doc, settings }: { doc: keyof typeof DOCS; settings: ShopSettings }) {
  const t = useTranslations("Legal");
  const { sections, effective, page } = DOCS[doc];
  const values = legalValues(settings, settings.pay.cod ? t("codCgv") : "");

  return (
    <LegalShell current={page}>
      <article className={ARTICLE}>
        <h1 className={DOC_H1}>{t(`${doc}.title`)}</h1>
        {effective ? <span className="text-[14px] text-muted">{t("effective")}</span> : null}
        {Array.from({ length: sections }, (_, i) => `s${i + 1}`).map((s) => (
          <section key={s} className="flex flex-col gap-[14px]">
            <h2 className={DOC_H2}>{t(`${doc}.${s}.h`)}</h2>
            <p className="m-0 whitespace-pre-line">{t.rich(`${doc}.${s}.p`, { ...values, ...richTags })}</p>
          </section>
        ))}
      </article>
    </LegalShell>
  );
}
