"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/**
 * Choix de la langue (FR / EN), absent de la maquette (monolingue) : placé dans le pied de page et le tiroir mobile.
 * Conserve la page courante ; la recherche et les filtres du catalogue ne sont pas reportés.
 */
export function LangSwitch({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const t = useTranslations("Lang");
  const current = useLocale();
  const pathname = usePathname();
  return (
    <nav aria-label={t("label")} className="flex items-center gap-1">
      {routing.locales.map((l) => {
        const active = l === current;
        return (
          <Link
            key={l}
            href={pathname}
            locale={l}
            lang={l}
            hrefLang={l}
            aria-current={active ? "true" : undefined}
            className={
              (tone === "dark" ? "text-cream! hover:text-sun! " : "text-ink! hover:text-terracotta-deep! ") +
              "flex min-h-11 items-center rounded-full px-3 text-[13px] no-underline " +
              (active ? (tone === "dark" ? "border border-[#B9B1A4] font-semibold" : "border-ink border font-semibold") : "border border-transparent")
            }
          >
            {t(l)}
          </Link>
        );
      })}
    </nav>
  );
}
