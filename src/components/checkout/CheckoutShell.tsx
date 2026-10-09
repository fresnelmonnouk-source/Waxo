"use client";

import type { ReactNode, RefObject } from "react";
import { useTranslations } from "next-intl";

type Props = {
  /** Étape courante : 1 livraison, 2 paiement, 3 confirmation. */
  step: 1 | 2 | 3;
  onExit: () => void;
  scrollRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
};

/**
 * Coque plein écran de la commande (maquette : calque fixe z-50 sur fond crème, en-tête collant avec logo,
 * indicateur d'étapes et lien de sortie). Recouvre la coque de la boutique.
 */
export function CheckoutShell({ step, onExit, scrollRef, children }: Props) {
  const t = useTranslations("Checkout");
  const labels = [t("step1"), t("step2"), t("step3")];

  return (
    <div ref={scrollRef} className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-cream">
      <div className="sticky top-0 z-[2] border-b border-border bg-cream">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-3">
          <span className="font-display text-[23px] font-bold tracking-[-0.03em]">
            Wá x<span className="text-terracotta">ɔ</span>
          </span>
          <ol
            aria-label={t("stepsLabel")}
            className="m-0 order-3 flex list-none flex-wrap items-center gap-1.5 p-0 text-[14px] min-[980px]:order-none"
          >
            {labels.map((label, i) => {
              const n = i + 1;
              const done = n < step;
              const act = n === step;
              return (
                <li
                  key={label}
                  aria-current={act ? "step" : undefined}
                  className="flex items-center gap-2"
                  style={{ color: act || done ? "#141210" : "#6B645A", fontWeight: act ? 600 : 400 }}
                >
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px]"
                    style={{
                      background: act ? "#141210" : done ? "#1F6B4A" : "#E2DCCF",
                      color: act || done ? "#fff" : "#4A443C",
                    }}
                  >
                    {done ? "✓" : n}
                  </span>
                  {label}
                  <span aria-hidden="true" className="px-1 text-[#C9C1B2]">
                    {i < 2 ? "—" : ""}
                  </span>
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            onClick={onExit}
            className="min-h-11 cursor-pointer border-0 bg-transparent text-[14px] underline underline-offset-[3px]"
          >
            {step === 3 ? (
              t("exitClose")
            ) : (
              <>
                <span className="hidden min-[980px]:inline">{t("exitWide")}</span>
                <span className="min-[980px]:hidden">{t("exitShort")}</span>
              </>
            )}
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
