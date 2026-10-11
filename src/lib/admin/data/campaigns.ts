import "server-only";
import demo from "@/lib/demo/catalog.json";
import { campaignFromRow, CAMPAIGN_SELECT } from "@/lib/campaigns/data";
import { campaignStats, type Campaign, type CampaignSaleLine, type CampaignStats } from "@/lib/campaigns/logic";
import { sortCampaigns } from "@/components/admin/campaigns/helpers";
import { ADMIN_LIST_LIMIT, adminDb, withTimeout } from "./products";

// Lecture admin des campagnes (service_role : voit aussi les campagnes désactivées) + produits (prix NORMAL) + ventes
// rattachées (order_items.campaign_id, commandes non annulées). Sans Supabase → repli démo ; table absente → « error ».

export type CampaignProductRef = { id: string; name: string; price: number; stock: number; bg: string | null; imageUrl: string | null; active: boolean };
export type AdminCampaign = Campaign & { stats: CampaignStats };
export type CampaignsData = {
  source: "db" | "demo" | "error";
  message?: string;
  campaigns: AdminCampaign[];
  products: CampaignProductRef[];
  truncated: boolean;
};

const EMPTY_STATS: CampaignStats = { orders: 0, units: 0, revenue: 0, top: [] };
const SALES_PAGE = 1000;
const SALES_MAX_PAGES = 20;

type DbErr = { code?: string; message?: string } | null | undefined;
/** 42P01 (Postgres) / PGRST205 (PostgREST) : table inconnue ; 42703 / PGRST204 : colonne inconnue (order_items.campaign_id). */
export const isMissingSchema = (e: DbErr) =>
  ["42P01", "PGRST205", "42703", "PGRST204"].includes(e?.code ?? "") || (/campaign/i.test(e?.message ?? "") && /(does not exist|could not find)/i.test(e?.message ?? ""));

export const MISSING_TABLE_MESSAGE =
  "Les campagnes ne sont pas encore installées dans la base : appliquez la migration 0015_campaigns.sql dans Supabase, puis rechargez la page.";

function demoProducts(): CampaignProductRef[] {
  return demo.products.map((p) => ({ id: p.id, name: p.fr.name, price: p.price, stock: p.stock, bg: p.bg, imageUrl: p.imageUrl, active: true }));
}

type ProductRow = {
  id: string;
  price: number;
  stock: number;
  bg: string | null;
  image_url: string | null;
  active: boolean;
  product_translations: { locale: string; name: string }[] | null;
};

type SaleRow = { product_id: string | null; name: string; unit_price: number; qty: number; order_id: string; campaign_id: string; orders?: unknown };

export async function getAdminCampaigns(): Promise<CampaignsData> {
  const sb = adminDb();
  if (!sb) return { source: "demo", campaigns: [], products: demoProducts(), truncated: false };
  try {
    const [camps, prods] = await Promise.all([
      withTimeout(sb.from("campaigns").select(CAMPAIGN_SELECT).order("starts_at", { ascending: false }).range(0, ADMIN_LIST_LIMIT - 1)),
      withTimeout(
        sb
          .from("products")
          .select("id,price,stock,bg,image_url,active,product_translations(locale,name)")
          .order("created_at", { ascending: false })
          .range(0, ADMIN_LIST_LIMIT - 1),
      ),
    ]);
    if (camps.error) {
      if (isMissingSchema(camps.error)) return { source: "error", message: MISSING_TABLE_MESSAGE, campaigns: [], products: [], truncated: false };
      throw camps.error;
    }
    if (prods.error) throw prods.error;

    const campaigns = ((camps.data ?? []) as unknown as Parameters<typeof campaignFromRow>[0][]).map(campaignFromRow);
    const products: CampaignProductRef[] = ((prods.data ?? []) as unknown as ProductRow[]).map((p) => ({
      id: p.id,
      name: (p.product_translations ?? []).find((t) => t.locale === "fr")?.name ?? "(sans nom)",
      price: p.price,
      stock: p.stock,
      bg: p.bg ?? null,
      imageUrl: p.image_url ?? null,
      active: p.active,
    }));

    // Ventes au prix de campagne (hors commandes annulées), paginées.
    const lines = new Map<string, CampaignSaleLine[]>();
    let salesTruncated = false;
    const ids = campaigns.map((c) => c.id);
    if (ids.length) {
      for (let page = 0; page < SALES_MAX_PAGES; page++) {
        const { data, error } = await withTimeout(
          sb
            .from("order_items")
            .select("product_id,name,unit_price,qty,order_id,campaign_id,orders!inner(status,paid,pay)")
            .in("campaign_id", ids)
            .neq("orders.status", "annulee")
            .order("id")
            .range(page * SALES_PAGE, (page + 1) * SALES_PAGE - 1),
        );
        if (error) {
          if (isMissingSchema(error)) return { source: "error", message: MISSING_TABLE_MESSAGE, campaigns: [], products: [], truncated: false };
          throw error;
        }
        const rows = (data ?? []) as unknown as SaleRow[];
        if (page === SALES_MAX_PAGES - 1 && rows.length === SALES_PAGE) salesTruncated = true;
        for (const r of rows) {
          // Vente réelle seulement : payée en ligne, ou paiement à la livraison (les paiements en ligne abandonnés ne comptent pas).
          const o = (Array.isArray(r.orders) ? r.orders[0] : r.orders) as { paid?: boolean; pay?: string } | null | undefined;
          if (o && !o.paid && o.pay !== "cod") continue;
          const list = lines.get(r.campaign_id) ?? [];
          list.push({ productId: r.product_id, name: r.name, unitPrice: r.unit_price, qty: r.qty, orderId: r.order_id });
          lines.set(r.campaign_id, list);
        }
        if (rows.length < SALES_PAGE) break;
      }
    }

    const withStats: AdminCampaign[] = campaigns.map((c) => ({ ...c, stats: lines.has(c.id) ? campaignStats(lines.get(c.id)!) : EMPTY_STATS }));
    return {
      source: "db",
      campaigns: sortCampaigns(withStats, Date.now()),
      products,
      truncated: campaigns.length >= ADMIN_LIST_LIMIT || products.length >= ADMIN_LIST_LIMIT || salesTruncated,
    };
  } catch (e) {
    console.error("[admin/campaigns] read", (e as DbErr)?.code ?? "", ((e as DbErr)?.message ?? "").slice(0, 120));
    return { source: "error", campaigns: [], products: [], truncated: false };
  }
}
