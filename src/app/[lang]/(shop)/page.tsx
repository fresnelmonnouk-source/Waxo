import { use } from "react";
import { hasLocale, useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// Page d'attente du jalon J0 : sert à vérifier tokens, polices, i18n. Remplacée au jalon J1.
export default function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = use(params);
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);
  const t = useTranslations();

  return (
    <main className="mx-auto flex min-h-screen max-w-[1280px] flex-col items-start justify-center gap-6 px-5">
      <span className="font-display text-[25px] leading-none font-bold tracking-[-0.03em]">
        Wá x<span className="text-terracotta">ɔ</span>
      </span>
      <h1 className="font-display max-w-[14ch] text-[60px] leading-[1.05] font-bold tracking-[-0.04em]">
        {t("Home.title")}
      </h1>
      <p className="text-muted text-lg">{t("Home.soon")}</p>
      <nav aria-label={t("Lang.label")} className="flex gap-3">
        <Link href="/" locale="fr" className="rounded-full border border-border-strong px-4 py-2 text-sm">
          {t("Lang.fr")}
        </Link>
        <Link href="/" locale="en" className="rounded-full border border-border-strong px-4 py-2 text-sm">
          {t("Lang.en")}
        </Link>
      </nav>
    </main>
  );
}
