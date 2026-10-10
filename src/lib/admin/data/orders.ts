import "server-only";
import adminDemo from "@/lib/demo/admin.json";
import { adminDb, withTimeout } from "@/lib/orders/db";
import { PAGE_SIZE, filterOrders, searchOrClause, periodStart, type OrderFilters } from "@/lib/orders/filters";
import { mapDbOrder, mapDemoOrder, type DbOrderRow, type DemoClient, type DemoOrder } from "@/lib/orders/mapping";
import { STATUS_LIST } from "@/lib/orders/status";
import type { AdminOrder, DataSource, OrderStatus } from "@/lib/orders/types";

const ITEMS = "order_items(id,name,unit_price,qty)";
const EXPORT_CHUNK = 200;
const EXPORT_MAX = 1000;

export type StatusCounts = Record<OrderStatus | "all", number>;
export type OrdersPage = {
  rows: AdminOrder[];
  /** Nombre de lignes correspondant aux filtres (toutes pages). */
  total: number;
  /** Compteurs globaux par statut (pastilles de filtre). */
  counts: StatusCounts;
  page: number;
  pageCount: number;
  source: DataSource;
  /** true → la base a répondu en erreur : la liste est vide mais ce n'est pas « aucune commande ». */
  error: boolean;
};

/** Commandes de démonstration (admin.json) converties au format du back-office. */
export function loadDemoOrders(): AdminOrder[] {
  const clients = adminDemo.clients as unknown as DemoClient[];
  return (adminDemo.orders as unknown as DemoOrder[]).map((o) => mapDemoOrder(o, clients));
}

function emptyCounts(): StatusCounts {
  return { all: 0, nouvelle: 0, preparation: 0, livraison: 0, livree: 0, annulee: 0 };
}

function demoPage(f: OrderFilters, now: number): OrdersPage {
  const all = loadDemoOrders();
  const counts = emptyCounts();
  for (const o of all) {
    counts[o.status] += 1;
    counts.all += 1;
  }
  const filtered = filterOrders(all, f, now);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(f.page, pageCount);
  return {
    rows: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total: filtered.length,
    counts,
    page,
    pageCount,
    source: "demo",
    error: false,
  };
}

/** Liste paginée et filtrée (statut, recherche numéro/nom/téléphone, période). Filtrage CÔTÉ BASE quand elle est branchée. */
export async function getOrders(f: OrderFilters, now = Date.now()): Promise<OrdersPage> {
  const db = adminDb();
  if (!db) return demoPage(f, now);
  try {
    const from = (f.page - 1) * PAGE_SIZE;
    let q = db
      .from("orders")
      .select(`*, ${ITEMS}`, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (f.status !== "all") q = q.eq("status", f.status);
    const since = periodStart(f.period, now);
    if (since !== null) q = q.gte("created_at", new Date(since).toISOString());
    const or = searchOrClause(f.q);
    if (or) q = q.or(or);

    const [res, ...countRes] = await withTimeout(
      Promise.all([
        q,
        ...STATUS_LIST.map((s) => db.from("orders").select("id", { count: "exact", head: true }).eq("status", s)),
      ]),
    );
    if (res.error) throw new Error("orders_query");
    const counts = emptyCounts();
    STATUS_LIST.forEach((s, i) => {
      counts[s] = countRes[i]?.count ?? 0;
      counts.all += counts[s];
    });
    const total = res.count ?? res.data?.length ?? 0;
    return {
      rows: ((res.data ?? []) as DbOrderRow[]).map(mapDbOrder),
      total,
      counts,
      page: f.page,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      source: "db",
      error: false,
    };
  } catch {
    return { rows: [], total: 0, counts: emptyCounts(), page: f.page, pageCount: 1, source: "db", error: true };
  }
}

/** Une commande par son numéro (« WX-10262 ») pour le tiroir détail. */
export async function getOrderByNumber(number: string): Promise<AdminOrder | null> {
  const db = adminDb();
  if (!db) return loadDemoOrders().find((o) => o.number === number) ?? null;
  try {
    const { data, error } = await withTimeout(
      db.from("orders").select(`*, ${ITEMS}`).eq("number", number).maybeSingle(),
    );
    if (error || !data) return null;
    return mapDbOrder(data as DbOrderRow);
  } catch {
    return null;
  }
}

/** Commande par identifiant (uuid en base) — utilisée par les server actions et les exports. */
export async function getOrderById(id: string): Promise<AdminOrder | null> {
  const db = adminDb();
  if (!db) return loadDemoOrders().find((o) => o.id === id) ?? null;
  try {
    const { data, error } = await withTimeout(db.from("orders").select(`*, ${ITEMS}`).eq("id", id).maybeSingle());
    if (error || !data) return null;
    return mapDbOrder(data as DbOrderRow);
  } catch {
    return null;
  }
}

/** Export : mêmes filtres que la liste, jusqu'à 1 000 lignes (par blocs de 200). */
export async function getOrdersForExport(f: Pick<OrderFilters, "status" | "q" | "period">, now = Date.now()): Promise<AdminOrder[]> {
  const db = adminDb();
  if (!db) return filterOrders(loadDemoOrders(), f, now).slice(0, EXPORT_MAX);
  const out: AdminOrder[] = [];
  try {
    for (let from = 0; from < EXPORT_MAX; from += EXPORT_CHUNK) {
      let q = db
        .from("orders")
        .select(`*, ${ITEMS}`)
        .order("created_at", { ascending: false })
        .range(from, from + EXPORT_CHUNK - 1);
      if (f.status !== "all") q = q.eq("status", f.status);
      const since = periodStart(f.period, now);
      if (since !== null) q = q.gte("created_at", new Date(since).toISOString());
      const or = searchOrClause(f.q);
      if (or) q = q.or(or);
      const { data, error } = await withTimeout(q);
      if (error) break;
      const rows = ((data ?? []) as DbOrderRow[]).map(mapDbOrder);
      out.push(...rows);
      if (rows.length < EXPORT_CHUNK) break;
    }
  } catch {
    /* export partiel plutôt qu'une erreur brute */
  }
  return out;
}
