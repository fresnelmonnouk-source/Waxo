import { useTranslations } from "next-intl";
import { fmtXof } from "@/lib/money";

/** Bandeau noir au-dessus de l'en-tête (maquette lignes 29-33). Les deux messages de gauche/droite n'apparaissent qu'en large (≥ 980 px). */
export function TopBar({ freeFrom, cod }: { freeFrom: number; cod: boolean }) {
  const t = useTranslations("Shell.topbar");
  return (
    <div className="bg-ink text-cream flex flex-wrap justify-center gap-x-7 gap-y-[6px] px-4 py-[9px] text-center text-[13px]">
      <span className="whitespace-nowrap max-[979px]:hidden">{t("delivery")}</span>
      <span className="text-sun whitespace-nowrap">{t("freeShip", { amount: fmtXof(freeFrom) })}</span>
      {cod ? <span className="whitespace-nowrap max-[979px]:hidden">{t("cod")}</span> : null}
    </div>
  );
}
