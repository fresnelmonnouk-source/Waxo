import "server-only";
import adminDemo from "@/lib/demo/admin.json";
import { aggregateClients, type ClientOrderLite, type ClientProfile, type ClientRow } from "@/lib/orders/clients";
import { adminDb, withTimeout, type AdminDb } from "@/lib/orders/db";
import { isOrderStatus } from "@/lib/orders/status";
import { demoDate, mapDbOrder, mapDemoOrder, type DbOrderRow, type DemoClient, type DemoOrder } from "@/lib/orders/mapping";
import type { AdminOrder, DataSource } from "@/lib/orders/types";

/** Nombre maximal de clients chargés (les plus récents). */
export const CLIENTS_LIMIT = 200;
const CHUNK = 1000;
const MAX_CHUNKS = 5;
const ITEMS = "order_items(id,name,unit_price,qty)";

export type ClientsResult = { rows: ClientRow[]; source: DataSource; error: boolean; truncated: boolean };

function demoProfiles(): ClientProfile[] {
  return (adminDemo.clients as unknown as DemoClient[]).map((c) => ({
    id: c.id,
    firstName: c.first,
    lastName: c.last,
    email: c.email,
    phone: c.phone,
    address: c.address,
    news: c.news,
    createdAt: demoDate(c.created),
  }));
}

function demoLite(): ClientOrderLite[] {
  return (adminDemo.orders as unknown as DemoOrder[]).map((o) => ({
    userId: o.uid,
    total: o.total,
    status: isOrderStatus(o.status) ? o.status : "nouvelle",
    createdAt: demoDate(o.date),
  }));
}

/** E-mails de connexion (auth.users) : absents de `profiles`, lus via l'API admin, par blocs de 1 000. */
async function loadEmails(db: AdminDb): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let page = 1; page <= 3; page += 1) {
    const { data, error } = await withTimeout(db.auth.admin.listUsers({ page, perPage: 1000 }));
    if (error) break;
    for (const u of data.users) if (u.email) map.set(u.id, u.email);
    if (data.users.length < 1000) break;
  }
  return map;
}

/** Commandes (colonnes minimales) d'un ensemble de clients, lues par blocs de 1 000 (limite PostgREST). */
async function loadOrderLites(db: AdminDb, ids: string[]): Promise<ClientOrderLite[]> {
  const out: ClientOrderLite[] = [];
  if (!ids.length) return out;
  for (let i = 0; i < MAX_CHUNKS; i += 1) {
    const { data, error } = await withTimeout(
      db
        .from("orders")
        .select("user_id,total,status,created_at")
        .in("user_id", ids)
        .order("created_at", { ascending: false })
        .range(i * CHUNK, (i + 1) * CHUNK - 1),
    );
    if (error) throw new Error("client_orders_query");
    for (const r of data ?? []) {
      out.push({
        userId: (r.user_id as string | null) ?? null,
        total: Number(r.total) || 0,
        status: isOrderStatus(r.status) ? r.status : "nouvelle",
        createdAt: String(r.created_at ?? ""),
      });
    }
    if ((data?.length ?? 0) < CHUNK) break;
  }
  return out;
}

/** Clients (profils non-admin) avec nombre de commandes et total dépensé (hors annulées). */
export async function getClients(): Promise<ClientsResult> {
  const db = adminDb();
  if (!db) return { rows: aggregateClients(demoProfiles(), demoLite()), source: "demo", error: false, truncated: false };
  try {
    const { data, error, count } = await withTimeout(
      db
        .from("profiles")
        .select("id,first_name,last_name,phone,address,news,created_at", { count: "exact" })
        .eq("role", "client")
        .order("created_at", { ascending: false })
        .limit(CLIENTS_LIMIT),
    );
    if (error) throw new Error("profiles_query");
    const emails = await loadEmails(db).catch(() => new Map<string, string>());
    const profiles: ClientProfile[] = (data ?? []).map((p) => ({
      id: String(p.id),
      firstName: String(p.first_name ?? ""),
      lastName: String(p.last_name ?? ""),
      email: emails.get(String(p.id)) ?? "",
      phone: String(p.phone ?? ""),
      address: String(p.address ?? ""),
      news: p.news === true,
      createdAt: String(p.created_at ?? ""),
    }));
    const lites = await loadOrderLites(
      db,
      profiles.map((p) => p.id),
    );
    return {
      rows: aggregateClients(profiles, lites),
      source: "db",
      error: false,
      truncated: (count ?? 0) > CLIENTS_LIMIT,
    };
  } catch {
    return { rows: [], source: "db", error: true, truncated: false };
  }
}

/** Les 30 dernières commandes d'un client (fiche détail). */
export async function getClientOrders(clientId: string): Promise<AdminOrder[]> {
  const db = adminDb();
  if (!db) {
    const clients = adminDemo.clients as unknown as DemoClient[];
    return (adminDemo.orders as unknown as DemoOrder[])
      .filter((o) => o.uid === clientId)
      .map((o) => mapDemoOrder(o, clients))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 30);
  }
  try {
    const { data, error } = await withTimeout(
      db.from("orders").select(`*, ${ITEMS}`).eq("user_id", clientId).order("created_at", { ascending: false }).limit(30),
    );
    if (error) return [];
    return ((data ?? []) as DbOrderRow[]).map(mapDbOrder);
  } catch {
    return [];
  }
}
