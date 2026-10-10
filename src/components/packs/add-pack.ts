"use client";

import { cart } from "@/lib/cart/store";
import { shopToast } from "@/components/shop/toast";
import type { Pack } from "./logic";

/**
 * Ajout d'un pack au panier (`kind: "pack"` du store existant). Même règles que les produits :
 * épuisé → message ; quantité déjà égale au stock du pack → message « stock maximum » ; sinon ajout + message.
 * `notify` = false : pas de message (la fiche détail ouvre déjà le tiroir). Renvoie la quantité réellement ajoutée (0 si rien).
 */
export function addPackToCart(pack: Pack, inCart: number, qty = 1, notify = true): number {
  if (pack.stock <= 0) {
    if (notify) shopToast.show({ kind: "soldOut" });
    return 0;
  }
  const room = pack.stock - inCart;
  if (room <= 0) {
    if (notify) shopToast.show({ kind: "maxStock", n: pack.stock });
    return 0;
  }
  const n = Math.min(Math.max(1, qty), room);
  cart.add(
    {
      kind: "pack",
      id: pack.id,
      slug: pack.slug,
      name: pack.name,
      price: pack.price,
      bg: pack.bg,
      imageUrl: pack.imageUrl,
    },
    n,
  );
  if (notify) shopToast.show({ kind: "added", name: pack.name });
  return n;
}
