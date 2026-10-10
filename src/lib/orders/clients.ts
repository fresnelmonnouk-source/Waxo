import { normPhone } from "@/lib/auth/validation";
import { initials } from "./format";
import { norm } from "./filters";
import type { OrderStatus } from "./types";

export type ClientProfile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  news: boolean;
  createdAt: string;
};
export type ClientOrderLite = { userId: string | null; total: number; status: OrderStatus; createdAt: string };
export type ClientRow = ClientProfile & {
  name: string;
  initials: string;
  orders: number;
  spent: number;
  lastOrderAt: string | null;
};

/** Agrège commandes (hors annulées) par client ; tri par total dépensé décroissant (maquette). */
export function aggregateClients(profiles: ClientProfile[], orders: ClientOrderLite[]): ClientRow[] {
  const agg = new Map<string, { n: number; spent: number; last: string | null }>();
  for (const o of orders) {
    if (!o.userId || o.status === "annulee") continue;
    const a = agg.get(o.userId) ?? { n: 0, spent: 0, last: null };
    a.n += 1;
    a.spent += o.total;
    if (!a.last || o.createdAt > a.last) a.last = o.createdAt;
    agg.set(o.userId, a);
  }
  return profiles
    .map((p) => {
      const a = agg.get(p.id);
      const name = `${p.firstName} ${p.lastName}`.trim() || p.email || "Client";
      return {
        ...p,
        name,
        initials: initials(name) || "?",
        orders: a?.n ?? 0,
        spent: a?.spent ?? 0,
        lastOrderAt: a?.last ?? null,
      };
    })
    .sort((a, b) => b.spent - a.spent || a.name.localeCompare(b.name, "fr"));
}

export function filterClients(rows: ClientRow[], q: string, newsOnly = false): ClientRow[] {
  const t = norm(q);
  const d = normPhone(q);
  return rows.filter((c) => {
    if (newsOnly && !c.news) return false;
    if (!t) return true;
    if (norm(`${c.name} ${c.email}`).includes(t)) return true;
    return d.length >= 3 && normPhone(c.phone).includes(d);
  });
}
