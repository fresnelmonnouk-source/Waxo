import { use } from "react";
import { hasLocale, useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { pageTitle } from "@/components/account/page-meta";
import { TrackForm } from "@/components/account/TrackForm";
import { EYEBROW } from "@/components/account/styles";
import { routing } from "@/i18n/routing";

type Props = { params: Promise<{ lang: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, "Info.meta", "suivi");

// Suivi invité : pas de maquette, même langage visuel que « Mon compte » (cartes blanches, boutons pilule).
export default function Page({ params }: Props) {
  const { lang } = use(params);
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);
  const t = useTranslations("Track");

  return (
    <main className="mx-auto min-h-[70vh] max-w-[1100px] px-5 pt-10 pb-[72px]">
      <div className="mb-8 flex max-w-[640px] flex-col gap-3">
        <span className={EYEBROW}>{t("eyebrow")}</span>
        <h1 className="font-display m-0 text-[clamp(30px,4vw,46px)] leading-[1.06] font-semibold tracking-[-0.035em]">{t("title")}</h1>
        <p className="m-0 text-[17px] leading-[1.55] text-text">{t("intro")}</p>
      </div>
      <TrackForm />
    </main>
  );
}
