"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useCartLines } from "@/lib/cart/store";
import { fmtXof } from "@/lib/money";
import { cartDrawer, useCartDrawerOpen } from "@/lib/ui/cart-drawer";
import { addPackToCart } from "./add-pack";
import type { Pack } from "./logic";

/**
 * Quantité + « Ajouter au panier » + « Commander maintenant » pour un pack, et la barre d'achat collante mobile
 * (même comportement que la fiche produit : écran < 980 px, tiroir panier fermé). Le stock du pack est plafonné
 * par le produit le plus limitant ; le serveur revérifie tout à la commande (`place_order`).
 */
export function PackBuy({ pack }: { pack: Pack }) {
  const t = useTranslations("Packs.detail");
  const router = useRouter();
  const lines = useCartLines();
  const drawerOpen = useCartDrawerOpen();
  const [qty, setQty] = useState(1);
  const [maxHit, setMaxHit] = useState(false);

  const inCart = lines.find((l) => l.kind === "pack" && l.id === pack.id)?.qty ?? 0;
  const maxQty = Math.max(1, pack.stock);

  function add(): boolean {
    if (pack.stock - inCart <= 0) {
      setMaxHit(true);
      return false;
    }
    setMaxHit(false);
    return addPackToCart(pack, inCart, qty, false) > 0;
  }

  return (
    <>
      <div className="flex flex-col gap-[18px]">
        <div className="flex flex-wrap gap-2.5">
          <div className="border-border-strong bg-card flex items-center rounded-full border">
            <button
              type="button"
              aria-label={t("qtyDec")}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="h-[50px] w-[46px] cursor-pointer border-0 bg-transparent text-[18px]"
            >
              −
            </button>
            <span aria-live="polite" className="min-w-[26px] text-center font-semibold">
              {qty}
            </span>
            <button
              type="button"
              aria-label={t("qtyInc")}
              onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              className="h-[50px] w-[46px] cursor-pointer border-0 bg-transparent text-[18px]"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              if (add()) cartDrawer.open();
            }}
            className="bg-ink text-cream h-[52px] flex-[1_1_200px] cursor-pointer rounded-full border-0 px-[22px] text-[16px] font-semibold hover:bg-[#2C2823]"
          >
            {t("addToCart", { total: fmtXof(pack.price * qty) })}
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            add();
            router.push("/commande");
          }}
          className="border-ink hover:border-sun hover:bg-sun h-[52px] cursor-pointer rounded-full border-[1.5px] bg-transparent text-[16px] font-semibold"
        >
          {t("buyNow")}
        </button>
        {maxHit ? (
          <span role="status" className="text-terracotta-deep -mt-2 text-[13px]">
            {t("maxStock", { count: pack.stock })}
          </span>
        ) : null}
      </div>

      {!drawerOpen ? (
        <div className="border-border bg-card fixed inset-x-0 bottom-0 z-[28] flex items-center gap-3 border-t px-4 py-3 shadow-[0_-10px_30px_-20px_rgba(20,18,16,.4)] min-[980px]:hidden">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-text truncate text-[13px]">{pack.name}</span>
            <strong className="text-[17px]">{fmtXof(pack.price)}</strong>
          </div>
          <button
            type="button"
            onClick={() => {
              if (add()) cartDrawer.open();
            }}
            className="bg-ink text-cream h-[50px] cursor-pointer rounded-full border-0 px-5 font-semibold"
          >
            {t("stickyAdd")}
          </button>
        </div>
      ) : null}
    </>
  );
}
