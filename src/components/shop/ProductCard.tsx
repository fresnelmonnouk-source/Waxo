"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cart } from "@/lib/cart/store";
import type { Product } from "@/lib/catalog/types";
import { favorites, useIsFavorite } from "@/lib/favorites/store";
import { discountPercent, fmtXof } from "@/lib/money";

/**
 * Carte produit partagée (catalogue, accueil, « Vous aimerez aussi », favoris).
 * VERSION MINIMALE posée par le socle : l'agent « boutique » la porte pixel-perfect depuis la maquette
 * en CONSERVANT ces props (Product en entrée, aucune autre dépendance).
 */
export function ProductCard({ product }: { product: Product }) {
  const t = useTranslations("Card");
  const isFav = useIsFavorite(product.id);
  const pct = discountPercent(product.comparePrice, product.price);
  const soldOut = product.stock <= 0;

  return (
    <article className="rounded-card border border-border bg-card p-3">
      <Link href={`/produit/${product.slug}`} className="block" style={{ textDecoration: "none" }}>
        <div className="rounded-field aspect-square" style={{ background: product.bg ?? "#EDE4CF" }} />
        <h3 className="mt-3 text-[15px] font-semibold">{product.name}</h3>
      </Link>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-semibold">{fmtXof(product.price)}</span>
        {product.comparePrice ? <s className="text-muted text-[13px]">{fmtXof(product.comparePrice)}</s> : null}
        {pct ? <span className="text-terracotta-deep text-[13px]">−{pct} %</span> : null}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={soldOut}
          onClick={() =>
            cart.add({ kind: "product", id: product.id, slug: product.slug, name: product.name, price: product.price, bg: product.bg, imageUrl: product.imageUrl })
          }
          className="h-11 flex-1 rounded-full bg-ink text-cream disabled:opacity-40"
        >
          {soldOut ? t("soldOut") : t("add")}
        </button>
        <button
          type="button"
          aria-pressed={isFav}
          aria-label={isFav ? t("unfavorite") : t("favorite")}
          onClick={() => favorites.toggle(product.id)}
          className="h-11 w-11 rounded-full border border-border-strong"
        >
          {isFav ? "♥" : "♡"}
        </button>
      </div>
    </article>
  );
}
