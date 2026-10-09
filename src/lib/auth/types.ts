/** Formes partagées entre les routes /api et l'interface (JSON sérialisable, jamais de donnée interne). */
import type { OrderStatus } from "./status";

export type MeUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  news: boolean;
  role: "client" | "admin";
  createdAt: string;
};

export type OrderItemView = { name: string; qty: number; unitPrice: number; slug: string | null };

export type OrderView = {
  number: string;
  status: OrderStatus;
  createdAt: string;
  zone: string;
  pay: string;
  address: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  items: OrderItemView[];
};

/** Réponse du suivi invité : volontairement minimale (statut, lignes, total, date). */
export type TrackView = {
  number: string;
  status: OrderStatus;
  createdAt: string;
  total: number;
  items: { name: string; qty: number; unitPrice: number }[];
};
