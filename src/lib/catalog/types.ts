import type { Locale } from "@/i18n/routing";

export type Category = {
  id: string;
  label: string; // déjà localisé
  bg: string;
  sort: number;
};

/** Produit à plat, déjà localisé (repli FR si la traduction manque). Aucune donnée admin (pas de prix d'achat). */
export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryId: string;
  price: number; // XOF entier
  comparePrice: number | null;
  stock: number;
  sold: number;
  keyword: string;
  bg: string | null;
  imageUrl: string | null;
  createdAt: string;
  rating: { average: number; count: number };
};

export type Review = {
  id: string;
  productId: string;
  author: string;
  rating: number;
  body: string;
  verified: boolean;
  createdAt: string;
};

export type ShippingSettings = { cotonou: number; autre: number; freeFrom: number; cutoff: number; returnDays: number };
export type BrandSettings = {
  shopName: string;
  whatsapp: string;
  waNumber: string;
  email: string;
  hours: string;
};
export type PaySettings = { momo: boolean; moov: boolean; celtiis: boolean; carte: boolean; cod: boolean };
export type ShopSettings = { brand: BrandSettings; shipping: ShippingSettings; pay: PaySettings };

export type ProductSort = "popular" | "new" | "price-asc" | "price-desc" | "rating";
export type ProductQuery = { category?: string; q?: string; sort?: ProductSort; limit?: number };

export type { Locale };
