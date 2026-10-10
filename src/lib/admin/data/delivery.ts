import "server-only";
import adminDemo from "@/lib/demo/admin.json";
import { getSettings, type ShippingSettings } from "@/lib/catalog";
import { buildDeliveryBoard, type DeliveryBoard, type ZoneFilter } from "@/lib/orders/delivery";
import { adminDb, withTimeout } from "@/lib/orders/db";
import { fmtDate, startOfDayBenin } from "@/lib/orders/format";
import { mapDbCourier, mapDbOrder, mapDemoCourier, type DbOrderRow, type DemoCourier } from "@/lib/orders/mapping";
import type { AdminOrder, Courier, DataSource } from "@/lib/orders/types";
import { loadDemoOrders } from "./orders";

const ITEMS = "order_items(id,name,unit_price,qty)";
const DAY = 86_400_000;

export type CouriersResult = { couriers: Courier[]; source: DataSource; error: boolean };

function demoCouriers(): Courier[] {
  return (adminDemo.couriers as unknown as DemoCourier[]).map(mapDemoCourier);
}

/** Tous les livreurs (actifs et en pause). */
export async function getCouriers(): Promise<CouriersResult> {
  const db = adminDb();
  if (!db) return { couriers: demoCouriers(), source: "demo", error: false };
  try {
    const { data, error } = await withTimeout(db.from("couriers").select("*").order("name", { ascending: true }).limit(200));
    if (error) throw new Error("couriers_query");
    return { couriers: (data ?? []).map(mapDbCourier), source: "db", error: false };
  } catch {
    return { couriers: [], source: "db", error: true };
  }
}

export type DeliveryData = {
  board: DeliveryBoard;
  fees: ShippingSettings;
  /** « jeudi 9 octobre » (calculé côté serveur). */
  todayLabel: string;
  source: DataSource;
  error: boolean;
};

const EMPTY_BOARD = (zone: ZoneFilter, now: number): DeliveryBoard =>
  buildDeliveryBoard({ active: [], recentDelivered: [], deliveredToday: 0, delivered30: [], couriers: [], zone, now });

/** Données de l'onglet Livraisons : à expédier, en route, livrées récemment, livreurs et leurs statistiques. */
export async function getDeliveryData(zone: ZoneFilter, now = Date.now()): Promise<DeliveryData> {
  const fees = (await getSettings()).shipping;
  const todayLabel = fmtDate(now, { weekday: "long", day: "numeric", month: "long" });
  const db = adminDb();
  if (!db) {
    const all = loadDemoOrders();
    const t0 = startOfDayBenin(now);
    const delivered = all
      .filter((o) => o.status === "livree")
      .sort((a, b) => (b.deliveredAt ?? b.createdAt).localeCompare(a.deliveredAt ?? a.createdAt));
    const d30 = now - 30 * DAY;
    return {
      board: buildDeliveryBoard({
        active: all.filter((o) => o.status === "nouvelle" || o.status === "preparation" || o.status === "livraison"),
        recentDelivered: delivered,
        deliveredToday: delivered.filter((o) => new Date(o.deliveredAt ?? o.createdAt).getTime() >= t0).length,
        delivered30: delivered
          .filter((o) => new Date(o.deliveredAt ?? o.createdAt).getTime() >= d30)
          .map((o) => ({ courierId: o.courierId })),
        couriers: demoCouriers(),
        zone,
        now,
      }),
      fees,
      todayLabel,
      source: "demo",
      error: false,
    };
  }
  try {
    const t0 = new Date(startOfDayBenin(now)).toISOString();
    const d30 = new Date(now - 30 * DAY).toISOString();
    const [active, recent, today, d30rows, couriers] = await withTimeout(
      Promise.all([
        db
          .from("orders")
          .select(`*, ${ITEMS}`)
          .in("status", ["nouvelle", "preparation", "livraison"])
          .order("created_at", { ascending: true })
          .limit(200),
        db
          .from("orders")
          .select(`*, ${ITEMS}`)
          .eq("status", "livree")
          .order("delivered_at", { ascending: false, nullsFirst: false })
          .limit(30),
        db.from("orders").select("id", { count: "exact", head: true }).eq("status", "livree").gte("delivered_at", t0),
        db.from("orders").select("courier_id").eq("status", "livree").gte("delivered_at", d30).limit(1000),
        db.from("couriers").select("*").order("name", { ascending: true }).limit(200),
      ]),
    );
    if (active.error || recent.error || d30rows.error || couriers.error) throw new Error("delivery_query");
    return {
      board: buildDeliveryBoard({
        active: ((active.data ?? []) as DbOrderRow[]).map(mapDbOrder),
        recentDelivered: ((recent.data ?? []) as DbOrderRow[]).map(mapDbOrder),
        deliveredToday: today.count ?? 0,
        delivered30: (d30rows.data ?? []).map((r) => ({ courierId: (r.courier_id as string | null) ?? null })),
        couriers: (couriers.data ?? []).map(mapDbCourier),
        zone,
        now,
      }),
      fees,
      todayLabel,
      source: "db",
      error: false,
    };
  } catch {
    return { board: EMPTY_BOARD(zone, now), fees, todayLabel, source: "db", error: true };
  }
}

/** Commandes à expédier + en route (toutes zones) pour l'export CSV des livraisons. */
export async function getDeliveryExport(now = Date.now()): Promise<{ orders: AdminOrder[]; couriers: Courier[] }> {
  const data = await getDeliveryData("all", now);
  const { couriers } = await getCouriers();
  return { orders: [...data.board.toShip, ...data.board.onRoad], couriers };
}
