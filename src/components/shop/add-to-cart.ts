"use client";

import { cart } from "@/lib/cart/store";
import type { Product } from "@/lib/catalog/types";
import { shopToast } from "./toast";

/**
 * Ajout au panier depuis une carte produit (règles de la maquette : `add`).
 * - épuisé : message, rien n'est ajouté ;
 * - quantité déjà égale au stock : message « stock maximum » ;
 * - sinon : ajout d'1 unité + message « ajouté au panier » avec raccourci vers le panier.
 * `currentQty` = quantité déjà au panier pour ce produit (0 si absent).
 */
export function addProductToCart(product: Product, currentQty: number): boolean {
  if (product.stock <= 0) {
    shopToast.show({ kind: "soldOut" });
    return false;
  }
  if (currentQty >= product.stock) {
    shopToast.show({ kind: "maxStock", n: product.stock });
    return false;
  }
  cart.add({
    kind: "product",
    id: product.id,
    slug: product.slug,
    name: product.name,
    price: product.price,
    bg: product.bg,
    imageUrl: product.imageUrl,
  });
  shopToast.show({ kind: "added", name: product.name });
  return true;
}
