// Types partagés du back-office « ventes » (commandes, livraisons, clients). Module pur (client + serveur).

export type OrderStatus = "nouvelle" | "preparation" | "livraison" | "livree" | "annulee";
export type PayMethod = "momo" | "moov" | "celtiis" | "carte" | "cod";
export type Zone = "cotonou" | "autre";
export type OrderEmailEvent = "preparation" | "livraison" | "livree" | "annulee";

export type AdminOrderItem = { id: string; name: string; unitPrice: number; qty: number };

export type AdminOrder = {
  /** uuid en base ; en repli démo, identique au numéro. */
  id: string;
  /** « WX-10262 » */
  number: string;
  /** ISO 8601 absolu. */
  createdAt: string;
  userId: string | null;
  name: string;
  phone: string;
  email: string | null;
  address: string;
  note: string | null;
  zone: Zone;
  pay: PayMethod;
  status: OrderStatus;
  subtotal: number;
  shippingFee: number;
  total: number;
  paid: boolean;
  paidAt: string | null;
  courierId: string | null;
  codVerified: boolean;
  deliveredAt: string | null;
  items: AdminOrderItem[];
};

export type Courier = { id: string; name: string; phone: string; zone: Zone; active: boolean };

export type ActionOk<T extends object = object> = { ok: true } & T;
export type ActionErr = { ok: false; code: string; message: string };
export type ActionResult<T extends object = object> = ActionOk<T> | ActionErr;

export type DataSource = "db" | "demo";
