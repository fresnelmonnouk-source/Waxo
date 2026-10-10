import { isOrderStatus } from "./status";
import type { AdminOrder, AdminOrderItem, Courier, PayMethod, Zone } from "./types";

// ───────────────────────── Lignes de base (snake_case) → types du back-office ─────────────────────────
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const strOrNull = (v: unknown): string | null => (v == null || v === "" ? null : String(v));
const PAYS: PayMethod[] = ["momo", "moov", "celtiis", "carte", "cod"];
const toPay = (v: unknown): PayMethod => (PAYS.includes(v as PayMethod) ? (v as PayMethod) : "cod");
const toZone = (v: unknown): Zone => (v === "autre" ? "autre" : "cotonou");

export type DbOrderRow = Record<string, unknown> & { order_items?: Record<string, unknown>[] | null };

export function mapDbOrder(r: DbOrderRow): AdminOrder {
  const items: AdminOrderItem[] = (r.order_items ?? []).map((i) => ({
    id: str(i.id),
    name: str(i.name),
    unitPrice: num(i.unit_price),
    qty: num(i.qty),
  }));
  return {
    id: str(r.id),
    number: str(r.number),
    createdAt: str(r.created_at),
    userId: strOrNull(r.user_id),
    name: str(r.name),
    phone: str(r.phone),
    email: strOrNull(r.email),
    address: str(r.address),
    note: strOrNull(r.note),
    zone: toZone(r.zone),
    pay: toPay(r.pay),
    status: isOrderStatus(r.status) ? r.status : "nouvelle",
    subtotal: num(r.subtotal),
    shippingFee: num(r.shipping_fee),
    total: num(r.total),
    paid: r.paid === true,
    paidAt: strOrNull(r.paid_at),
    courierId: strOrNull(r.courier_id),
    codVerified: r.cod_verified === true,
    deliveredAt: strOrNull(r.delivered_at),
    items,
  };
}

export function mapDbCourier(r: Record<string, unknown>): Courier {
  return { id: str(r.id), name: str(r.name), phone: str(r.phone), zone: toZone(r.zone), active: r.active !== false };
}

// ───────────────────────── Repli démo (src/lib/demo/admin.json) ─────────────────────────
export type DemoOrder = {
  id: string;
  date: string;
  uid: string | null;
  name: string;
  phone: string;
  address: string;
  zone: string;
  pay: string;
  items: { pid: string; name: string; price: number; qty: number }[];
  sub: number;
  ship: number;
  total: number;
  status: string;
  courier?: string | null;
  deliveredAt?: string;
};
export type DemoClient = { id: string; first: string; last: string; phone: string; email: string; address: string; news: boolean; created: string };
export type DemoCourier = { id: string; name: string; phone: string; zone: string; active: boolean };

/** Les dates de la démo n'ont pas de fuseau : on les lit à l'heure du Bénin (UTC+1). */
export function demoDate(d: string): string {
  const withTz = /(?:Z|[+-]\d{2}:?\d{2})$/.test(d) ? d : `${d.length === 10 ? `${d}T00:00:00` : d}+01:00`;
  const t = new Date(withTz);
  return Number.isNaN(t.getTime()) ? new Date(0).toISOString() : t.toISOString();
}

export function mapDemoOrder(o: DemoOrder, clients: DemoClient[]): AdminOrder {
  const client = o.uid ? clients.find((c) => c.id === o.uid) : undefined;
  const status = isOrderStatus(o.status) ? o.status : "nouvelle";
  const pay = toPay(o.pay);
  const createdAt = demoDate(o.date);
  // La démo n'a pas de colonne « payé » : paiement en ligne = payé (sauf annulée), COD = payé à la livraison.
  const paid = status !== "annulee" && (pay === "cod" ? status === "livree" : true);
  return {
    id: o.id,
    number: o.id,
    createdAt,
    userId: o.uid,
    name: o.name,
    phone: o.phone,
    email: client?.email ?? null,
    address: o.address,
    note: null,
    zone: toZone(o.zone),
    pay,
    status,
    subtotal: o.sub,
    shippingFee: o.ship,
    total: o.total,
    paid,
    paidAt: paid ? createdAt : null,
    courierId: o.courier ?? null,
    codVerified: false,
    deliveredAt: status === "livree" ? (o.deliveredAt ? demoDate(o.deliveredAt) : createdAt) : null,
    items: o.items.map((i, k) => ({ id: `${o.id}-${k}`, name: i.name, unitPrice: i.price, qty: i.qty })),
  };
}

export function mapDemoCourier(c: DemoCourier): Courier {
  return { id: c.id, name: c.name, phone: c.phone, zone: toZone(c.zone), active: c.active };
}
