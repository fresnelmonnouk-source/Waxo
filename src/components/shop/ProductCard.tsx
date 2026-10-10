"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCartLines } from "@/lib/cart/store";
import type { Product } from "@/lib/catalog/types";
import { favorites, useIsFavorite } from "@/lib/favorites/store";
import { usePrice } from "@/lib/currency/client";
import { addProductToCart } from "./add-to-cart";
import { STOCK_COLOR, TAG_STYLE, cssUrl, fmtRating, productTag, promoLabel, stockKind, type TagKind } from "./logic";

/**
 * Carte produit partagée (accueil, catalogue, « Vous aimerez aussi », favoris). Fidèle à la maquette.
 * Signature minimale conservée : `<ProductCard product={p} />` (étiquette « Épuisé » / remise déduites du produit).
 * Props facultatives :
 * - `tag`     : étiquette calculée par la liste (nouveau, best-seller…) ; `null` = aucune ; absent = déduite du produit.
 * - `variant` : "catalog" (défaut : étiquette en haut à gauche + note) ou "home" (remise en haut à droite, sans note).
 * - `rank`    : numéro de classement (section « Plus vendus »).
 * - `animate` : animation d'apparition `wxup` (page catalogue).
 */
export function ProductCard({
  product,
  tag,
  variant = "catalog",
  rank,
  animate = false,
}: {
  product: Product;
  tag?: TagKind | null;
  variant?: "catalog" | "home";
  rank?: number;
  animate?: boolean;
}) {
  const fmt = usePrice();
  const t = useTranslations("Card");
  const locale = useLocale();
  const isFav = useIsFavorite(product.id);
  const lines = useCartLines();
  const qty = lines.find((l) => l.kind === "product" && l.id === product.id)?.qty ?? 0;

  const soldOut = product.stock <= 0;
  const hasOld = !!(product.comparePrice && product.comparePrice > product.price);
  const kind = tag === undefined ? productTag(product) : tag;
  const stock = stockKind(product.stock);
  const href = `/produit/${product.slug}`;
  const tagText: Record<TagKind, string> = {
    soldout: t("soldOut"),
    promo: promoLabel(product),
    new: t("tagNew"),
    best: t("tagBest"),
  };
  const stockText = stock === "out" ? t("stockOut") : stock === "low" ? t("stockLow", { n: product.stock }) : t("stockOk");

  return (
    <article className="flex min-w-0 flex-col gap-3" style={animate ? { animation: "wxup .3s ease both" } : undefined}>
      <div
        className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[20px] transition-transform duration-200 hover:scale-[1.015]"
        style={{ background: product.bg ?? "#E9E2D3" }}
      >
        <Link href={href} aria-label={product.name} className="absolute inset-0 z-[1] rounded-[20px]" />
        <span
          aria-hidden="true"
          className="font-display font-semibold tracking-[-0.04em]"
          style={{ fontSize: "clamp(20px,2.2vw,28px)", opacity: variant === "home" ? 0.7 : 0.75 }}
        >
          {product.keyword}
        </span>
        {product.imageUrl ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 h-full w-full"
            style={{ background: `${cssUrl(product.imageUrl)} center/cover no-repeat` }}
          />
        ) : null}
        {rank ? (
          <span
            role="img"
            aria-label={t("rank", { n: rank })}
            className="font-display bg-ink text-terracotta absolute top-3 left-3 flex h-10 w-10 items-center justify-center rounded-full text-[16px] font-bold"
          >
            {rank}
          </span>
        ) : null}
        {variant === "home" ? (
          hasOld ? (
            <span className="absolute top-3 right-3 rounded-full bg-terracotta-deep px-[10px] py-[5px] text-[12px] font-semibold text-white">
              {promoLabel(product)}
            </span>
          ) : null
        ) : kind ? (
          <span
            className="absolute top-3 left-3 rounded-full px-[10px] py-[5px] text-[12px] font-semibold"
            style={{ background: TAG_STYLE[kind].bg, color: TAG_STYLE[kind].color }}
          >
            {tagText[kind]}
          </span>
        ) : null}
        <button
          type="button"
          aria-pressed={isFav}
          aria-label={isFav ? t("unfavorite") : t("favorite")}
          onClick={() => favorites.toggle(product.id)}
          className="text-ink absolute bottom-3 left-3 z-[2] flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-0 bg-white/90 hover:bg-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill={isFav ? "#C2410C" : "none"} stroke={isFav ? "#C2410C" : "#141210"} strokeWidth="2" strokeLinejoin="round">
            <path d="M12 21s-7-4.4-9.3-8.7C.8 8.7 2.5 4.5 6.5 4.5c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3 4 0 5.7 4.2 3.8 7.8C19 16.6 12 21 12 21z" />
          </svg>
        </button>
        {!soldOut ? (
          <button
            type="button"
            aria-label={t("add")}
            onClick={() => addProductToCart(product, qty)}
            className="bg-ink text-cream absolute right-3 bottom-3 z-[2] flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-0 text-[22px] leading-none hover:bg-[#C2410C]"
          >
            +
          </button>
        ) : null}
      </div>
      <div className="flex flex-col gap-[5px] px-[2px]">
        <Link href={href} className="text-ink! hover:text-ink! text-[15px] leading-[1.3] font-medium no-underline">
          {product.name}
        </Link>
        {variant === "catalog" && product.rating.count > 0 ? (
          <span className="text-text flex items-center gap-1 text-[13px]">
            <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2.6l2.8 6 6.6.6-5 4.5 1.5 6.5L12 16.9l-5.9 3.3 1.5-6.5-5-4.5 6.6-.6z" fill="#141210" />
            </svg>
            <span>{t("rating", { rating: fmtRating(product.rating.average, locale), count: product.rating.count })}</span>
          </span>
        ) : null}
        <div className="flex flex-wrap items-baseline gap-2">
          <strong className="text-[17px]">{fmt(product.price)}</strong>
          {hasOld && product.comparePrice ? (
            <s className="text-muted text-[14px]">{fmt(product.comparePrice)}</s>
          ) : null}
        </div>
        <span className="text-[13px]" style={{ color: STOCK_COLOR[stock] }}>
          {stockText}
        </span>
      </div>
    </article>
  );
}
