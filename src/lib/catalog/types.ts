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
  /** Photo principale (couverture) = `images[0]`, ou null sans photo. Lue par le panier, les cartes, l'Open Graph. */
  imageUrl: string | null;
  /**
   * Photos, couverture en premier (0 à 8, migration 0024 ; repli sur `imageUrl` avant la migration). Toutes sur la fiche
   * (`getProductBySlug`) ; couverture seule dans les listes (`getProducts`…), qui ne montrent que la photo principale.
   */
  images: string[];
  createdAt: string;
  rating: { average: number; count: number };
  /** Case « Livraison gratuite à Cotonou & Calavi » (0025). La livraison n'est offerte que si TOUT le panier l'est. */
  freeShipping: boolean;
  /** Campagne en cours qui fixe le prix (0015) ; `comparePrice` vaut alors le prix normal. */
  campaign?: { slug: string; name: string; endsAt: string };
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
/** Fonctionnalités activables depuis l'admin (réglage public `features`). Absent en base = tout activé. */
export type FeatureSettings = { packs: boolean };
export type ShopSettings = { brand: BrandSettings; shipping: ShippingSettings; pay: PaySettings; features: FeatureSettings };

export type ProductSort = "popular" | "new" | "price-asc" | "price-desc" | "rating";
export type ProductQuery = { category?: string; q?: string; sort?: ProductSort; limit?: number };

export type { Locale };
