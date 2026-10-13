"use client";

import { useLocale, useTranslations } from "next-intl";
import { freeShippingEnabled } from "@/lib/checkout/shipping";
import { CURRENCIES, isCurrency } from "@/lib/currency/core";
import { setCurrency, useCurrency, usePrice } from "@/lib/currency/client";
import { DEFAULT_CUTOFF } from "@/lib/delivery/promise";
import { DeliveryPromise } from "./DeliveryPromise";
import { ExpressInline, cutoffParams } from "./ExpressBadge";

/**
 * Bandeau noir au-dessus de l'en-tête (maquette lignes 29-33 + Livraison Express, spec §4.1).
 * < 640 px : un seul message, la promesse courte qui suit l'heure. ≥ 640 px : règle Express + livraison offerte ; ≥ 980 px : + paiement à la réception.
 * Le picto horloge est le SEUL picto de la topbar.
 */
export function TopBar({ freeFrom, cod, cutoff = DEFAULT_CUTOFF }: { freeFrom: number; cod: boolean; cutoff?: number }) {
  const t = useTranslations("Shell.topbar");
  const locale = useLocale();
  const tc = useTranslations("Shell.currency");
  const price = usePrice();
  const currency = useCurrency();
  return (
    <div className="on-dark bg-ink text-cream flex flex-wrap items-center justify-center gap-x-7 gap-y-[6px] px-4 py-[9px] text-center text-[13px]">
      <span className="min-[640px]:hidden">
        <DeliveryPromise surface="topbarShort" cutoff={cutoff} />
      </span>
      <ExpressInline className="whitespace-nowrap max-[639px]:hidden">
        {t.rich("delivery", { ...cutoffParams(cutoff, locale), b: (c) => <strong className="font-semibold">{c}</strong> })}
      </ExpressInline>
      {freeShippingEnabled({ freeFrom }) ? (
        <span className="whitespace-nowrap max-[639px]:hidden">
          {t.rich("freeShip", { amount: price(freeFrom), b: (c) => <strong className="text-sun font-semibold">{c}</strong> })}
        </span>
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
