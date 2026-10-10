"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { assistant } from "@/components/assistant/store";
import { useRouter } from "@/i18n/navigation";
import { cart, useCartLines } from "@/lib/cart/store";
import { cartDrawer, useCartDrawerOpen } from "@/lib/ui/cart-drawer";
import { usePrice } from "@/lib/currency/client";

type Props = {
  id: string;
  slug: string;
  name: string;
  price: number;
  stock: number;
  bg: string | null;
  imageUrl: string | null;
};

/**
 * Quantité + « Ajouter au panier » + « Commander maintenant », et la barre d'achat collante mobile
 * (maquette : `stickyBuy` = écran < 980 px, produit disponible, tiroir panier fermé).
 */
export function ProductBuy({ id, slug, name, price, stock, bg, imageUrl }: Props) {
  const fmt = usePrice();
  const t = useTranslations("Product");
  const router = useRouter();
  const lines = useCartLines();
  const drawerOpen = useCartDrawerOpen();
  const [qty, setQty] = useState(1);
  const [maxHit, setMaxHit] = useState(false);

  // Barre d'achat collante visible (mobile) : le bouton flottant de l'assistant se décale au-dessus.
  useEffect(() => {
    assistant.setStickyBuy(!drawerOpen);
    return () => assistant.setStickyBuy(false);
  }, [drawerOpen]);

  const inCart = lines.find((l) => l.kind === "product" && l.id === id)?.qty ?? 0;
  const maxQty = Math.max(1, stock);

  /** Ajoute `qty` sans dépasser le stock (maquette : `add()`). Renvoie false si le stock est déjà atteint. */
  function add(): boolean {
    const room = stock - inCart;
    if (room <= 0) {
      setMaxHit(true);
      return false;
    }
    setMaxHit(false);
    cart.add({ kind: "product", id, slug, name, price, bg, imageUrl }, Math.min(qty, room));
    return true;
  }

  return (
    <>
      <div className="flex flex-col gap-[18px]">
        <div className="flex flex-wrap gap-2.5">
          <div className="flex items-center rounded-full border border-border-strong bg-card">
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
            className="h-[52px] flex-[1_1_200px] cursor-pointer rounded-full border-0 bg-ink px-[22px] text-[16px] font-semibold text-cream hover:bg-[#2C2823]"
          >
            {t("addToCart", { total: fmt(price * qty) })}
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            add();
            router.push("/commande");
          }}
          className="h-[52px] cursor-pointer rounded-full border-[1.5px] border-ink bg-transparent text-[16px] font-semibold hover:border-sun hover:bg-sun"
        >
          {t("buyNow")}
        </button>
        {maxHit ? (
          <span role="status" className="-mt-2 text-[13px] text-terracotta-deep">
            {t("maxStock", { count: stock })}
          </span>
        ) : null}
      </div>

      {!drawerOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-[28] flex items-center gap-3 border-t border-border bg-card px-4 py-3 shadow-[0_-10px_30px_-20px_rgba(20,18,16,.4)] min-[980px]:hidden">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] text-text">{name}</span>
            <strong className="text-[17px]">{fmt(price)}</strong>
          </div>
          <button
            type="button"
            onClick={() => {
              if (add()) cartDrawer.open();
            }}
            className="h-[50px] cursor-pointer rounded-full border-0 bg-ink px-5 font-semibold text-cream"
          >
            {t("stickyAdd")}
          </button>
        </div>
      ) : null}
    </>
  );
}
