// Articles en « livraison offerte à Cotonou & Calavi » (0025) : module PUR (types seuls), partagé par l'API du panier et la
// page commande. Même règle que place_order : un produit coché ; un pack dont TOUS les produits sont cochés.
import type { Pack } from "@/components/packs/logic";
import type { Product } from "./types";

export function freeShippingIds(products: readonly Pick<Product, "id" | "freeShipping">[], packs: readonly Pick<Pack, "id" | "items">[]): string[] {
  const free = new Set(products.filter((p) => p.freeShipping).map((p) => p.id));
  const packIds = packs.filter((k) => k.items.length > 0 && k.items.every((i) => free.has(i.productId))).map((k) => k.id);
  return [...free, ...packIds];
}
