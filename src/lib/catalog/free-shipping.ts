// Articles en « livraison offerte à Cotonou & Calavi » : module PUR (types seuls), partagé par l'API du panier et la
// page commande. Même règle que place_order : un produit dont la case est cochée (0025) ; un pack dont SA case est cochée
// (0026), quel que soit l'état des cases de ses produits (et sans effet sur ses produits achetés séparément).
import type { Pack } from "@/components/packs/logic";
import type { Product } from "./types";

export function freeShippingIds(
  products: readonly Pick<Product, "id" | "freeShipping">[],
  packs: readonly Pick<Pack, "id" | "freeShipping">[],
): string[] {
  return [...products.filter((p) => p.freeShipping).map((p) => p.id), ...packs.filter((k) => k.freeShipping).map((k) => k.id)];
}
