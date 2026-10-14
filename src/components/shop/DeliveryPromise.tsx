"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { freeShippingEnabled } from "@/lib/checkout/shipping";
import { usePrice } from "@/lib/currency/client";
import { deliveryState, safeCutoff, type DeliveryState } from "@/lib/delivery/promise";
import { ExpressBadge, ExpressPicto, EXPRESS_SUN, cutoffParams } from "./ExpressBadge";

// Promesse « selon l'heure » (spec §3). Rendu serveur/ISR et hydratation : état « neutral » (phrase vraie à toute heure),
// puis l'état réel (heure du Bénin) une fois monté. Aucune minuterie à la seconde : l'état ne change qu'à l'heure limite et à minuit.

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) timer = setInterval(() => listeners.forEach((l) => l()), 60_000);
  return () => {
    listeners.delete(cb);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
const serverState = (): DeliveryState => "neutral";

/** État de la promesse : `neutral` au serveur et pendant l'hydratation, puis today / tomorrow / tomorrowSunday. */
export function useDeliveryState(cutoff: number): DeliveryState {
  const c = safeCutoff(cutoff);
  const snapshot = useCallback((): DeliveryState => deliveryState(Date.now(), c), [c]);
  return useSyncExternalStore(subscribe, snapshot, serverState);
}

export type PromiseSurface = "topbarShort" | "hero" | "stock";

/** Texte de la promesse pour une surface donnée (messages `Express.<surface>.<état>`). */
export function DeliveryPromise({ surface, cutoff }: { surface: PromiseSurface; cutoff: number }) {
  const t = useTranslations("Express");
  const locale = useLocale();
  const state = useDeliveryState(cutoff);
  const params = cutoffParams(cutoff, locale);
  if (surface === "topbarShort") {
    return (
      // Picto dans le flux du texte : sur 360 px, la phrase passe sur deux lignes et le picto reste collé au premier mot.
      <span>
        <ExpressPicto size={14} color={EXPRESS_SUN} className="mr-[6px] inline-block align-[-2px]" />
        <span>{t.rich(`topbarShort.${state}`, { ...params, b: (c) => <strong className="font-semibold">{c}</strong> })}</span>
      </span>
    );
  }
  return <>{t(`${surface}.${state}`, params)}</>;
}

/** Ligne de preuve du héro (spec §4.2) : badge M sur fond encre + promesse selon l'heure. */
export function HeroDeliveryProof({ cutoff }: { cutoff: number }) {
  const t = useTranslations("Express");
  return (
    <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] leading-[1.45] font-medium text-cream">
      <ExpressBadge label={t("badge")} size="M" variant="onDark" />
      <span className="min-w-0 flex-[1_1_260px] text-pretty">
        <DeliveryPromise surface="hero" cutoff={cutoff} />
      </span>
    </p>
  );
}

/**
 * Ligne de stock des fiches (spec §5.1) : pastille + « En stock. » en couleur, puis la promesse en gris.
 * Rupture : aucune promesse de délai.
 */
export function StockPromise({ label, color, cutoff, soldOut }: { label: string; color: string; cutoff: number; soldOut: boolean }) {
  return (
    <p className="m-0 flex items-baseline gap-2 text-[14px] leading-[1.5]">
      <span aria-hidden="true" className="relative top-[-1px] inline-block size-2 flex-none rounded-full" style={{ background: color }} />
      <span>
        <strong className="font-semibold" style={{ color }}>
          {label}
        </strong>
        {soldOut ? null : (
          <>
            {" "}
            <span className="text-text">
              <DeliveryPromise surface="stock" cutoff={cutoff} />
            </span>
          </>
        )}
      </span>
    </p>
  );
}

/** Note de livraison sous le bouton d'achat (spec §5.2) : le SEUL badge Express de la fiche. Tarifs issus des réglages. */
export function DeliveryNote({
  cotonou,
  autre,
  freeFrom,
  cod,
  freeShipping = false,
}: {
  cotonou: number;
  autre: number;
  freeFrom: number;
  cod: boolean;
  /** Produit en « livraison offerte à Cotonou & Calavi » (0025) : offerte si tout le panier l'est. */
  freeShipping?: boolean;
}) {
  const t = useTranslations("Express");
  const price = usePrice();
  const zone = freeShipping
    ? t("noteZoneFreeProduct")
    : freeShippingEnabled({ freeFrom })
      ? t("noteZone", { price: price(cotonou), free: price(freeFrom) })
      : t("noteZoneNoFree", { price: price(cotonou) });
  return (
    <div className="border-border flex flex-col gap-1.5 rounded-[var(--radius-field)] border bg-white px-4 py-[14px]">
      <p className="text-ink m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] leading-[1.4] font-medium">
        <ExpressBadge label={t("badge")} size="S" variant="onLight" />
        <span>{zone}</span>
      </p>
      <p className="text-muted m-0 text-[13px] leading-[1.45]">
        {freeShipping ? `${t("noteFreeProductCond")} ` : ""}
        {t("noteOther", { price: price(autre) })}
        {cod ? ` ${t("noteCod")}` : ""}
      </p>
    </div>
  );
}
