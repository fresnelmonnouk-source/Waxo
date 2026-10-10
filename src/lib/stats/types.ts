import type { ExpenseCatId, OrderStatusId } from "@/lib/admin/ui/constants";

/** Ligne de commande vue par les statistiques (`pid` = id produit, ou « pack:<id> »). */
/** `cost` : prix d'achat unitaire des lignes sans produit du catalogue (packs) ; null/absent = inconnu. */
export type StatOrderItem = { pid: string; name: string; price: number; qty: number; cost?: number | null };

export type StatOrder = {
  /** Identifiant technique (uuid en base) : sert aux actions du tableau de bord. */
  id: string;
  /** Numéro public « WX-10262 ». */
  number: string;
  /** Horodatage ISO (ou chaîne sans fuseau = heure du Bénin). */
  date: string;
  name: string;
  phone: string;
  zone: string;
  pay: string;
  status: OrderStatusId;
  sub: number;
  ship: number;
  total: number;
  items: StatOrderItem[];
};

export type StatProduct = {
  id: string;
  name: string;
  cat: string;
  price: number;
  /** Prix d'achat unitaire ; null = non renseigné. */
  cost: number | null;
  stock: number;
  sold: number;
  active: boolean;
  bg: string | null;
  imageUrl: string | null;
};

export type LedgerEntry = { id: string; date: string; cat: ExpenseCatId; label: string; amount: number };
