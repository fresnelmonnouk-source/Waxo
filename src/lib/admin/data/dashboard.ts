import "server-only";
import adminDemo from "@/lib/demo/admin.json";
import catalogDemo from "@/lib/demo/catalog.json";
import { withTimeout } from "@/lib/auth/timeout";
import { createAdminClient } from "@/lib/supabase/admin";
import { LOW_STOCK } from "@/lib/admin/ui/constants";
import { computeDashboard, type DashboardData, type StatProduct } from "@/lib/stats";
import { parseTs } from "@/lib/stats/time";
import { hasAdminDb, loadStatInputs, type DataSource } from "./stats";

export type DashboardReview = {
  id: string;
  author: string;
  rating: number;
  body: string;
  hidden: boolean;
  productName: string;
  createdAt: string;
};

export type DashboardPageData = {
  source: DataSource;
  data: DashboardData;
  reviews: DashboardReview[];
};

/** Tableau de bord : commandes à traiter, stock faible, meilleures ventes, derniers avis. Ne jette jamais. */
export async function getDashboard(now: number = Date.now()): Promise<DashboardPageData> {
  const inputs = await loadStatInputs(now);
  const data = computeDashboard(inputs.orders, inputs.products, now);
  const reviews = inputs.source === "db" ? await dbLatestReviews(inputs.products) : inputs.source === "demo" ? demoLatestReviews(inputs.products) : [];
  return { source: inputs.source, data, reviews };
}

function demoLatestReviews(products: StatProduct[]): DashboardReview[] {
  const names = new Map(products.map((p) => [p.id, p.name]));
  return [...catalogDemo.reviews]
    .sort((a, b) => parseTs(b.createdAt) - parseTs(a.createdAt))
    .slice(0, 3)
    .map((r) => ({
      id: r.id,
      author: r.author,
      rating: r.rating,
      body: r.body,
      hidden: false,
      productName: names.get(r.productId) ?? "Produit supprimé",
      createdAt: r.createdAt,
    }));
}

async function dbLatestReviews(products: StatProduct[]): Promise<DashboardReview[]> {
  try {
    const sb = createAdminClient();
    const { data, error } = await withTimeout(
      sb.from("reviews").select("id, product_id, author, rating, body, hidden, created_at").order("created_at", { ascending: false }).limit(3),
      6000,
    );
    if (error || !data) return [];
    const names = new Map(products.map((p) => [p.id, p.name]));
    return (data as { id: string; product_id: string; author: string; rating: number; body: string; hidden: boolean; created_at: string }[]).map((r) => ({
      id: r.id,
      author: r.author,
      rating: r.rating,
      body: r.body,
      hidden: r.hidden,
      productName: names.get(r.product_id) ?? "Produit supprimé",
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

// ───────────────────────── Compteurs de la coque (badges + sous-titres) ─────────────────────────
export type ShellCounts = {
  ordersTotal: number;
  ordersTodo: number;
  ordersShipping: number;
  productsTotal: number;
  productsLow: number;
  reviewsTotal: number;
  reviewsHidden: number;
  clients: number;
  messagesTodo: number;
  subscribers: number;
};

const ZERO: ShellCounts = {
  ordersTotal: 0,
  ordersTodo: 0,
  ordersShipping: 0,
  productsTotal: 0,
  productsLow: 0,
  reviewsTotal: 0,
  reviewsHidden: 0,
  clients: 0,
  messagesTodo: 0,
  subscribers: 0,
};

function demoCounts(): ShellCounts {
  const o = adminDemo.orders;
  return {
    ordersTotal: o.length,
    ordersTodo: o.filter((x) => x.status === "nouvelle" || x.status === "preparation").length,
    ordersShipping: o.filter((x) => x.status === "livraison").length,
    productsTotal: catalogDemo.products.length,
    productsLow: catalogDemo.products.filter((p) => p.stock <= LOW_STOCK).length,
    reviewsTotal: catalogDemo.reviews.length,
    reviewsHidden: 0,
    clients: adminDemo.clients.length,
    messagesTodo: adminDemo.messages.filter((m) => !m.done).length,
    subscribers: adminDemo.subs.length,
  };
}

/** Compteurs légers (requêtes `head`) pour les pastilles de la barre latérale et les sous-titres de page. Ne jette jamais. */
export async function getShellCounts(): Promise<ShellCounts> {
  if (!hasAdminDb()) return demoCounts();
  try {
    const sb = createAdminClient();
    const count = async (q: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> => {
      try {
        const { count: c, error } = await withTimeout(q, 4000);
        return error ? 0 : (c ?? 0);
      } catch {
        return 0;
      }
    };
    const head = { count: "exact" as const, head: true };
    const [ordersTotal, ordersTodo, ordersShipping, productsTotal, productsLow, reviewsTotal, reviewsHidden, clients, messagesTodo, subscribers] =
      await Promise.all([
        count(sb.from("orders").select("id", head)),
        count(sb.from("orders").select("id", head).in("status", ["nouvelle", "preparation"])),
        count(sb.from("orders").select("id", head).eq("status", "livraison")),
        count(sb.from("products").select("id", head)),
        count(sb.from("products").select("id", head).eq("active", true).lte("stock", LOW_STOCK)),
        count(sb.from("reviews").select("id", head)),
        count(sb.from("reviews").select("id", head).eq("hidden", true)),
        count(sb.from("profiles").select("id", head).eq("role", "client")),
        count(sb.from("messages").select("id", head).eq("done", false)),
        count(sb.from("newsletter_subs").select("id", head)),
      ]);
    return { ordersTotal, ordersTodo, ordersShipping, productsTotal, productsLow, reviewsTotal, reviewsHidden, clients, messagesTodo, subscribers };
  } catch {
    return ZERO;
  }
}
