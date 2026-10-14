// Types partagés produits + packs du back-office (client ET serveur ; aucun import serveur ici).
import type { ProductDetails } from "@/lib/catalog/details";

export type AdminCategory = { id: string; label: string; bg: string; sort: number };

export type Translation = { name: string; slug: string; description: string };

export type AdminProduct = {
  id: string;
  categoryId: string;
  price: number;
  comparePrice: number | null;
  stock: number;
  sold: number;
  keyword: string;
  bg: string | null;
  /** Photo principale = `images[0]` (compatibilité : panier, packs, tableau de bord). */
  imageUrl: string | null;
  /** Photos dans l'ordre d'affichage, la première est la photo principale (0 à 8). */
  images: string[];
  active: boolean;
  createdAt: string;
  /** Prix d'achat (product_costs) — null = non renseigné. Lu uniquement par le back-office. */
  cost: number | null;
  fr: Translation;
  en: Translation | null;
  /** Rubriques facultatives (0025) par langue ; vides avant la migration. */
  details: { fr: ProductDetails; en: ProductDetails };
  /** Case « Livraison gratuite à Cotonou & Calavi » (0025). */
  freeShipping: boolean;
  rating: { average: number; count: number };
};

/** « db » = lu en base ; « demo » = Supabase non branché (repli, écritures désactivées) ; « error » = base configurée mais illisible. */
export type DataSource = "db" | "demo" | "error";

export type ProductsData = {
  source: DataSource;
  products: AdminProduct[];
  categories: AdminCategory[];
  /** true si la limite de 200 produits est atteinte (la liste est tronquée). */
  truncated: boolean;
  /** Colonne `products.images` présente (migration 0024) : sinon une seule photo par produit. */
  imagesColumn: boolean;
  /** Rubriques + livraison offerte présentes (migration 0025) : sinon ces champs sont signalés indisponibles. */
  detailsColumns: boolean;
};

/** Valeurs du formulaire produit (chaînes, comme saisies). Le serveur re-valide tout. */
export type ProductFormValues = {
  name: string;
  nameEn: string;
  categoryId: string;
  price: string;
  comparePrice: string;
  stock: string;
  cost: string;
  description: string;
  descriptionEn: string;
  keyword: string;
  bg: string;
  active: boolean;
  /** Photos (URL du bucket `products`), la première est la photo principale. 8 au plus. */
  images: string[];
  /** Rubriques facultatives (0025), une information par ligne. Vide = rubrique absente de la fiche. */
  details: ProductDetails;
  detailsEn: ProductDetails;
  /** Livraison gratuite à Cotonou & Calavi (si tout le panier l'est). */
  freeShipping: boolean;
  /** Stock affiché à l'ouverture (modification) : le stock n'est réécrit que s'il a été changé, et sans écraser une vente. */
  stockAtOpen?: string;
};

export type PackItem = { productId: string; qty: number };

export type AdminPack = {
  id: string;
  price: number;
  imageUrl: string | null;
  active: boolean;
  createdAt: string;
  fr: Translation;
  en: Translation | null;
  items: PackItem[];
};

/** Produit minimal proposé dans le sélecteur de contenu d'un pack. */
export type PackProductRef = {
  id: string;
  name: string;
  price: number;
  stock: number;
  bg: string | null;
  imageUrl: string | null;
  active: boolean;
};

export type PacksData = {
  source: DataSource;
  packs: AdminPack[];
  products: PackProductRef[];
  truncated: boolean;
  /** Menu « Packs » affiché sur la boutique (réglage public `features.packs`). */
  menuEnabled: boolean;
};

export type PackFormValues = {
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  price: string;
  active: boolean;
  imageUrl: string | null;
  items: PackItem[];
};

export type ActionCode =
  | "unauthorized"
  | "unavailable"
  | "invalid"
  | "not_found"
  | "in_order"
  | "in_pack"
  | "conflict"
  | "error";

/** Retour de toute server action : jamais d'erreur SQL brute, uniquement un message FR et des erreurs par champ. */
export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; code: ActionCode; message: string; fields?: Record<string, string> };

export const UNAVAILABLE_MESSAGE = "Base non connectée (mode démo) : modification impossible.";
