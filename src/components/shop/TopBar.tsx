"use client";

import { useTranslations } from "next-intl";
import { freeShippingEnabled } from "@/lib/checkout/shipping";
import { CURRENCIES, isCurrency } from "@/lib/currency/core";
import { setCurrency, useCurrency, usePrice } from "@/lib/currency/client";

/** Bandeau noir au-dessus de l'en-tête (maquette lignes 29-33). Les deux messages de gauche/droite n'apparaissent qu'en large (≥ 980 px). */
export function TopBar({ freeFrom, cod }: { freeFrom: number; cod: boolean }) {
  const t = useTranslations("Shell.topbar");
  const tc = useTranslations("Shell.currency");
  const price = usePrice();
  const currency = useCurrency();
  return (
    <div className="bg-ink text-cream flex flex-wrap items-center justify-center gap-x-7 gap-y-[6px] px-4 py-[9px] text-center text-[13px]">
      <span className="whitespace-nowrap max-[979px]:hidden">{t("delivery")}</span>
      {freeShippingEnabled({ freeFrom }) ? (
        <span className="text-sun whitespace-nowrap">{t("freeShip", { amount: price(freeFrom) })}</span>
      ) : null}
      {cod ? <span className="whitespace-nowrap max-[979px]:hidden">{t("cod")}</span> : null}
      <label className="inline-flex items-center gap-[6px] whitespace-nowrap">
        <span className="sr-only">{tc("label")}</span>
        <span aria-hidden="true" className="text-cream/70 max-[979px]:hidden">
          {tc("short")}
        </span>
        <select
          value={currency}
          onChange={(e) => {
            if (isCurrency(e.target.value)) setCurrency(e.target.value);
          }}
          title={tc("note")}
          className="bg-ink text-cream border-cream/30 focus-visible:outline-sun cursor-pointer rounded-md border px-[6px] py-[2px] text-[13px]"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {tc(c === "XOF" ? "xof" : c === "EUR" ? "eur" : "usd")}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
