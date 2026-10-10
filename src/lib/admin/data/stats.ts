import "server-only";
import adminDemo from "@/lib/demo/admin.json";
import catalogDemo from "@/lib/demo/catalog.json";
import { withTimeout } from "@/lib/auth/timeout";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeStats, type StatsRange, type StatsResult } from "@/lib/stats";
import type { StatOrder, StatOrderItem, StatProduct } from "@/lib/stats";
import type { OrderStatusId } from "@/lib/admin/ui/constants";

/**
 * Lecture des commandes + produits pour les écrans de pilotage (tableau de bord, statistiques, carnet).
 * Source : Supabase (service_role, serveur seulement) si configuré ; sinon repli sur la démo (`src/lib/demo/*.json`).
 * Supabase configuré mais en panne → source « error » et listes vides (jamais de fausses données en production).
 */
export type DataSource = "db" | "demo" | "error";

export type StatInputs = { source: DataSource; orders: StatOrder[]; products: StatProduct[] };

const PAGE = 200;
const MAX_PAGES = 10;
const HISTORY_DAYS = 400;

/** Vrai si une base est configurée côté serveur (clé service_role comprise). */
export function hasAdminDb(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/** Lecture paginée par tranches de 200 lignes (plafond MAX_PAGES), erreur → exception. */
export async function fetchAll<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error } = await withTimeout(page(i * PAGE, i * PAGE + PAGE - 1), 8000);
    if (error) throw new Error("db_read_failed");
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

// ───────────────────────── Démo ─────────────────────────
function demoInputs(): StatInputs {
  const costs = adminDemo.cost as Record<string, number>;
  const products: StatProduct[] = catalogDemo.products.map((p) => ({
    id: p.id,
    name: p.fr.name,
    cat: p.categoryId,
    price: p.price,
    cost: costs[p.id] ?? null,
    stock: p.stock,
    sold: p.sold,
    active: true,
    bg: p.bg ?? null,
    imageUrl: p.imageUrl ?? null,
  }));
  const orders: StatOrder[] = adminDemo.orders.map((o) => ({
    id: o.id,
    number: o.id,
    date: o.date,
    name: o.name,
    phone: o.phone,
    zone: o.zone,
    pay: o.pay,
    status: o.status as OrderStatusId,
    sub: o.sub,
    ship: o.ship,
    total: o.total,
    items: o.items.map((i) => ({ pid: i.pid, name: i.name, price: i.price, qty: i.qty })),
  }));
  return { source: "demo", orders, products };
}

// ───────────────────────── Base ─────────────────────────
type OrderRow = {
  id: string;
  number: string;
  created_at: string;
  name: string;
  phone: string;
  zone: string;
  pay: string;
  status: OrderStatusId;
  subtotal: number;
  shipping_fee: number;
  total: number;
  order_items: { product_id: string | null; pack_id: string | null; name: string; unit_price: number; qty: number }[] | null;
};
type ProductRow = {
  id: string;
  category_id: string;
  price: number;
  stock: number;
  sold: number;
  active: boolean;
  bg: string | null;
  image_url: string | null;
  product_translations: { locale: string; name: string }[] | null;
};

async function dbInputs(now: number): Promise<StatInputs> {
  const sb = createAdminClient();
  const since = new Date(now - HISTORY_DAYS * 86_400_000).toISOString();
  const [orderRows, productRows, costRows, packRows] = await Promise.all([
    fetchAll<OrderRow>(
      (a, b) =>
        sb
          .from("orders")
          .select("id, number, created_at, name, phone, zone, pay, status, subtotal, shipping_fee, total, order_items(product_id, pack_id, name, unit_price, qty)")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .order("id")
          .range(a, b) as unknown as Page<OrderRow>,
    ),
    fetchAll<ProductRow>(
      (a, b) =>
        sb
          .from("products")
          .select("id, category_id, price, stock, sold, active, bg, image_url, product_translations(locale, name)")
          .order("id")
          .range(a, b) as unknown as Page<ProductRow>,
    ),
    fetchAll<{ product_id: string; cost: number }>(
      (a, b) => sb.from("product_costs").select("product_id, cost").order("product_id").range(a, b) as unknown as Page<{ product_id: string; cost: number }>,
    ),
    fetchAll<{ pack_id: string; product_id: string; qty: number }>(
      (a, b) =>
        sb.from("pack_items").select("pack_id, product_id, qty").order("pack_id").order("product_id").range(a, b) as unknown as Page<{
          pack_id: string;
          product_id: string;
          qty: number;
        }>,
    ),
  ]);

  const costOf = new Map(costRows.map((c) => [c.product_id, c.cost]));
  const products: StatProduct[] = productRows.map((p) => {
    const tr = p.product_translations ?? [];
    const name = tr.find((t) => t.locale === "fr")?.name ?? tr[0]?.name ?? "Produit";
    return {
      id: p.id,
      name,
      cat: p.category_id,
      price: p.price,
      cost: costOf.get(p.id) ?? null,
      stock: p.stock,
      sold: p.sold,
      active: p.active,
      bg: p.bg,
      imageUrl: p.image_url,
    };
  });

  // Coût d'un pack = somme des coûts de ses produits (inconnu si l'un d'eux n'a pas de prix d'achat).
  const packCost = new Map<string, number | null>();
  for (const it of packRows) {
    const c = costOf.get(it.product_id);
    const prev = packCost.get(it.pack_id);
    if (prev === null || c === undefined) packCost.set(it.pack_id, null);
    else packCost.set(it.pack_id, (prev ?? 0) + c * it.qty);
  }

  const orders: StatOrder[] = orderRows.map((o) => ({
    id: o.id,
    number: o.number,
    date: o.created_at,
    name: o.name,
    phone: o.phone,
    zone: o.zone,
    pay: o.pay,
    status: o.status,
    sub: o.subtotal,
    ship: o.shipping_fee,
    total: o.total,
    items: (o.order_items ?? []).map((i): StatOrderItem => {
      if (i.product_id) return { pid: i.product_id, name: i.name, price: i.unit_price, qty: i.qty };
      return { pid: `pack:${i.pack_id ?? "inconnu"}`, name: i.name, price: i.unit_price, qty: i.qty, cost: i.pack_id ? (packCost.get(i.pack_id) ?? null) : null };
    }),
  }));
  return { source: "db", orders, products };
}

/** Commandes (400 derniers jours) + produits, avec repli démo. Ne jette jamais. */
export async function loadStatInputs(now: number = Date.now()): Promise<StatInputs> {
  if (!hasAdminDb()) return demoInputs();
  try {
    return await dbInputs(now);
  } catch {
    return { source: "error", orders: [], products: [] };
  }
}

export type StatsPageData = { source: DataSource; stats: StatsResult };

/** Données de la page Statistiques. */
export async function getStats(range: StatsRange, now: number = Date.now()): Promise<StatsPageData> {
  const inputs = await loadStatInputs(now);
  return { source: inputs.source, stats: computeStats(inputs.orders, inputs.products, range, now) };
}
