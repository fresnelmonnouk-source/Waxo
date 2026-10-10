/**
 * Logique pure des packs (aucun accès navigateur ni serveur) : somme des produits, économie, stock.
 * Utilisée par la couche de lecture (`@/lib/catalog/packs`), les composants et les tests.
 */

/** Un produit du pack, déjà localisé, avec les valeurs courantes du catalogue. */
export type PackItem = {
  productId: string;
  slug: string;
  name: string;
  qty: number;
  price: number; // prix unitaire courant (XOF entier)
  stock: number;
  keyword: string;
  bg: string | null;
  imageUrl: string | null;
};

/** Pack à plat, déjà localisé. `stock` = nombre de packs complets disponibles. */
export type Pack = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number; // prix du pack (XOF entier)
  imageUrl: string | null;
  bg: string | null; // pastel du premier produit (vignette du panier)
  items: PackItem[];
  itemsTotal: number; // somme des produits achetés séparément
  saving: number; // économie en XOF (0 si le pack n'est pas moins cher)
  savingPercent: number; // arrondi, 0 si pas d'économie
  stock: number;
};

/** Somme des produits achetés séparément : Σ prix × quantité. */
export function itemsTotal(items: readonly Pick<PackItem, "price" | "qty">[]): number {
  return items.reduce((n, i) => n + i.price * i.qty, 0);
}

/** Économie du pack par rapport à l'achat séparé ; jamais négative. */
export function packSaving(packPrice: number, total: number): { saving: number; percent: number } {
  if (!(total > 0) || packPrice >= total) return { saving: 0, percent: 0 };
  return { saving: total - packPrice, percent: Math.round(((total - packPrice) / total) * 100) };
}

/**
 * Stock du pack = plus petit quotient entier (stock du produit / quantité requise).
 * Un pack sans produit, ou dont un produit manque (`expected` > nombre d'items résolus), n'est pas vendable.
 */
export function packStock(items: readonly Pick<PackItem, "stock" | "qty">[], expected = items.length): number {
  if (items.length === 0 || items.length < expected) return 0;
  return Math.max(0, Math.min(...items.map((i) => Math.floor(Math.max(0, i.stock) / Math.max(1, i.qty)))));
}

/** Assemble un pack complet à partir de ses éléments résolus. */
export function buildPack(
  base: { id: string; slug: string; name: string; description: string; price: number; imageUrl: string | null },
  items: PackItem[],
  expectedItems = items.length,
): Pack {
  const total = itemsTotal(items);
  const { saving, percent } = packSaving(base.price, total);
  return {
    ...base,
    bg: items.find((i) => i.bg)?.bg ?? null,
    items,
    itemsTotal: total,
    saving,
    savingPercent: percent,
    stock: packStock(items, expectedItems),
  };
}

/** Nombre total d'articles (somme des quantités). */
export const itemCount = (items: readonly Pick<PackItem, "qty">[]): number => items.reduce((n, i) => n + i.qty, 0);
