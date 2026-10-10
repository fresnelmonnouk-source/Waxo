"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { RefineButton } from "@/components/assistant/entries";
import { Link } from "@/i18n/navigation";
import { useCartLines } from "@/lib/cart/store";
import type { Product } from "@/lib/catalog/types";
import { usePrice } from "@/lib/currency/client";
import { addProductToCart } from "./add-to-cart";
import { TAG_STYLE, computeSelection, cssUrl, productTag, promoLabel, type TagKind } from "./logic";
import { useViewedIds } from "./viewed";

/**
 * « Notre sélection pour vous » (maquette lignes 250-276). Sans historique : sélection de départ (rendue côté serveur) ;
 * dès que des produits ont été consultés ou ajoutés au panier, la sélection suit ces rayons.
 * Le bouton « Affiner avec l'assistant » ouvre le widget (J3).
 */
export function Selection({ products, newIds, bestIds }: { products: Product[]; newIds: string[]; bestIds: string[] }) {
  const fmt = usePrice();
  const t = useTranslations("Home");
  const tc = useTranslations("Card");
  const viewed = useViewedIds();
  const lines = useCartLines();

  const { ids, personal } = useMemo(
    () => computeSelection(products, { viewed, cartIds: lines.map((l) => l.id) }),
    [products, viewed, lines],
  );
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const picks = ids.map((id) => byId.get(id)).filter((p): p is Product => !!p);

  const tagText: Record<TagKind, (p: Product) => string> = {
    soldout: () => tc("soldOut"),
    promo: (p) => promoLabel(p),
    new: () => tc("tagNew"),
    best: () => tc("tagBest"),
  };

  return (
    <section className="mt-16 bg-[#FBEFC9]">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-7 px-5 py-12">
        <div className="flex flex-[1_1_260px] flex-col items-start gap-[14px]">
          <span className="text-text text-[13px] font-semibold tracking-[0.08em] uppercase">{personal ? t("selEyebrowPersonal") : t("selEyebrow")}</span>
          <h2 className="font-display m-0 text-[clamp(26px,3vw,38px)] leading-[1.05] font-semibold tracking-[-0.035em]">{t("selTitle")}</h2>
          <p className="text-text m-0 max-w-[340px] text-[15px] leading-normal">{personal ? t("selSubPersonal") : t("selSub")}</p>
          <RefineButton />
          <Link href="/catalogue?col=selection" className="text-[14px] whitespace-nowrap underline">
            {t("selAll")}
          </Link>
        </div>
        <div
          role="region"
          aria-label={t("selTitle")}
          tabIndex={0}
          className="grid min-w-0 flex-[3_1_520px] snap-x snap-mandatory auto-cols-[minmax(180px,210px)] grid-flow-col gap-[14px] overflow-x-auto px-[2px] pt-1 pb-[10px]"
        >
          {picks.map((p) => {
            const kind = productTag(p, { newIds, bestIds });
            const qty = lines.find((l) => l.kind === "product" && l.id === p.id)?.qty ?? 0;
            return (
              <div key={p.id} className="flex min-w-0 snap-start flex-col gap-[10px] rounded-[20px] bg-white p-[10px]">
                <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[14px]" style={{ background: p.bg ?? "#E9E2D3" }}>
                  <Link href={`/produit/${p.slug}`} aria-label={p.name} className="absolute inset-0 z-[1]" />
                  <span aria-hidden="true" className="font-display text-[20px] font-semibold tracking-[-0.04em] opacity-75">
                    {p.keyword}
                  </span>
                  {p.imageUrl ? (
                    <div aria-hidden="true" className="absolute inset-0 h-full w-full" style={{ background: `${cssUrl(p.imageUrl)} center/cover no-repeat` }} />
                  ) : null}
                  {kind ? (
                    <span
                      className="absolute top-2 left-2 rounded-full px-[9px] py-1 text-[11px] font-semibold"
                      style={{ background: TAG_STYLE[kind].bg, color: TAG_STYLE[kind].color }}
                    >
                      {tagText[kind](p)}
                    </span>
                  ) : null}
                </div>
                <Link href={`/produit/${p.slug}`} className="text-ink! hover:text-ink! min-h-9 px-1 text-[14px] leading-[1.3] font-medium no-underline">
                  {p.name}
                </Link>
                <div className="flex items-center justify-between gap-2 pl-1">
                  <strong className="text-[15px]">{fmt(p.price)}</strong>
                  <button
                    type="button"
                    aria-label={tc("add")}
                    onClick={() => addProductToCart(p, qty)}
                    className="bg-ink text-cream h-11 w-11 cursor-pointer rounded-full border-0 text-[20px] hover:bg-[#C2410C]"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
