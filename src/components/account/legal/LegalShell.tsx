import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export const LEGAL_PAGES = [
  { id: "cgv", href: "/cgv" },
  { id: "cgu", href: "/cgu" },
  { id: "mentions", href: "/mentions-legales" },
  { id: "privacy", href: "/confidentialite" },
  { id: "shipping", href: "/livraison-retours" },
] as const;
export type LegalId = (typeof LEGAL_PAGES)[number]["id"];

/** Cadre commun des pages légales (maquette 629-635) : navigation entre pages + bandeau « modèle à valider ». */
export function LegalShell({ current, children }: { current: LegalId; children: ReactNode }) {
  const t = useTranslations("Legal");
  return (
    <main className="mx-auto min-h-[70vh] max-w-[860px] px-5 pt-8 pb-[72px]">
      <nav aria-label={t("navAria")} className="mb-6 flex flex-wrap gap-x-5 gap-y-1 border-b border-border text-[14px]">
        {LEGAL_PAGES.map((p) => {
          const on = p.id === current;
          return (
            <Link
              key={p.id}
              href={p.href}
              aria-current={on ? "page" : undefined}
              className={`-mb-px border-b-2 py-3 text-ink no-underline hover:text-ink ${on ? "border-ink font-semibold" : "border-transparent font-normal"}`}
            >
              {t(`nav.${p.id}`)}
            </Link>
          );
        })}
      </nav>
      <div className="mb-7 rounded-[16px] bg-[#FBEFC9] px-4 py-[14px] text-[14px] leading-[1.5]">{t("draft")}</div>
      {children}
    </main>
  );
}

export const ARTICLE = "flex flex-col gap-[14px] text-[15.5px] leading-[1.65] text-[#2C2823]";
export const DOC_H1 = "font-display m-0 text-[clamp(26px,3.4vw,36px)] leading-[1.1] font-semibold tracking-[-0.03em] text-ink";
export const DOC_H2 = "m-0 mt-[18px] text-[18px] text-ink";
