"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCartLines } from "@/lib/cart/store";
import { usePrice } from "@/lib/currency/client";
import { STOCK_COLOR, TAG_STYLE, stockKind } from "@/components/shop/logic";
import { addPackToCart } from "./add-pack";
import type { Pack } from "./logic";
import { PackVisual } from "./PackVisual";

/**
 * Carte pack (liste des packs, « Les autres packs »). Même langage que la carte produit :
 * visuel arrondi 20 px, pastille d'économie en terracotta-deep, bouton rond « + » de 44 px, prix en Onest gras.
 */
export function PackCard({ pack, animate = false }: { pack: Pack; animate?: boolean }) {
  const fmt = usePrice();
  const t = useTranslations("Packs.card");
  const lines = useCartLines();
  const inCart = lines.find((l) => l.kind === "pack" && l.id === pack.id)?.qty ?? 0;
  const soldOut = pack.stock <= 0;
  const stock = stockKind(pack.stock);
  const href = `/packs/${pack.slug}`;
  const stockText = stock === "out" ? t("stockOut") : stock === "low" ? t("stockLow", { n: pack.stock }) : t("stockOk");

  return (
    <article className="flex min-w-0 flex-col gap-3" style={animate ? { animation: "wxup .3s ease both" } : undefined}>
      <div className="relative transition-transform duration-200 hover:scale-[1.015]">
        <PackVisual pack={pack} label={t("visualAria", { name: pack.name })} />
        <Link href={href} aria-label={pack.name} className="absolute inset-0 z-[1] rounded-[20px]" />
        {soldOut ? (
          <span
            className="absolute top-3 left-3 rounded-full px-[10px] py-[5px] text-[12px] font-semibold"
            style={{ background: TAG_STYLE.soldout.bg, color: TAG_STYLE.soldout.color }}
          >
            {t("soldOut")}
          </span>
        ) : pack.saving > 0 ? (
          <span className="bg-terracotta-deep absolute top-3 left-3 rounded-full px-[10px] py-[5px] text-[12px] font-semibold text-white">
            {t("save", { amount: fmt(pack.saving) })}
          </span>
        ) : null}
        {!soldOut ? (
          <button
            type="button"
            aria-label={t("add")}
            onClick={() => addPackToCart(pack, inCart)}
            className="bg-ink text-cream absolute right-3 bottom-3 z-[2] flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-0 text-[22px] leading-none hover:bg-[#C2410C]"
          >
            +
          </button>
        ) : null}
      </div>
      <div className="flex flex-col gap-[5px] px-[2px]">
        <Link href={href} className="text-ink! hover:text-ink! text-[16px] leading-[1.3] font-medium no-underline">
          {pack.name}
        </Link>
        <span className="text-text text-[13px]">{t("products", { count: pack.items.length })}</span>
        <div className="flex flex-wrap items-baseline gap-2">
          <strong className="text-[17px]">{fmt(pack.price)}</strong>
          {pack.saving > 0 ? <s className="text-muted text-[14px]">{fmt(pack.itemsTotal)}</s> : null}
        </div>
        <span className="text-[13px]" style={{ color: STOCK_COLOR[stock] }}>
          {stockText}
        </span>
      </div>
    </article>
  );
}
