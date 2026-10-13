"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const BTN = "flex min-h-[46px] cursor-pointer items-center rounded-full px-5 text-[15px] font-semibold no-underline";

/**
 * Erreur pendant le rendu d'une page (le plus souvent : base injoignable sur une page jamais mise en cache, décision D6).
 * Localisée (dans le layout de langue, donc `<html lang>` correct), sans la coque de la boutique, qui peut être la cause.
 * « Réessayer » (`retry`, Next 16.3+) relit les données et relance le rendu du segment ; les liens restent utilisables.
 */
export default function LangError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("ErrorPage");
  useEffect(() => {
    // Trace côté navigateur (Sentry capte aussi l'erreur serveur) ; aucun détail technique affiché au visiteur.
    console.error(error);
  }, [error]);
  return (
    <main data-screen-label="Erreur" className="mx-auto flex min-h-[70vh] max-w-[760px] flex-col items-start justify-center gap-4 px-5 py-16">
      <span className="text-terracotta-deep text-[13px] font-semibold tracking-[0.04em] uppercase">{t("eyebrow")}</span>
      <h1 className="font-display m-0 text-[clamp(30px,4.4vw,48px)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">{t("title")}</h1>
      <p className="text-text m-0 max-w-[560px] text-[17px] leading-[1.6] text-pretty">{t("text")}</p>
      <div className="mt-2 flex flex-wrap gap-3">
        <button type="button" onClick={() => retry()} className={`${BTN} bg-ink text-cream hover:bg-[#2C2823] border-0`}>
          {t("retry")}
        </button>
        <Link href="/" className={`${BTN} border-border-strong text-ink! hover:text-ink! border bg-white`}>
          {t("home")}
        </Link>
        <Link href="/contact" className={`${BTN} border-border-strong text-ink! hover:text-ink! border bg-white`}>
          {t("contact")}
        </Link>
      </div>
    </main>
  );
}
