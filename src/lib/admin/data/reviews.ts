import "server-only";
import catalogDemo from "@/lib/demo/catalog.json";
import { tryAdminClient, withTimeout } from "@/lib/settings/db";

export type AdminReview = {
  id: string;
  productId: string;
  productName: string;
  author: string;
  rating: number;
  body: string;
  verified: boolean;
  seed: boolean;
  hidden: boolean;
  createdAt: string;
};
export type ReviewView = "all" | "published" | "hidden";
export type ReviewsData = {
  rows: AdminReview[];
  counts: { all: number; published: number; hidden: number };
  connected: boolean;
  truncated: boolean;
};

export const REVIEW_LIMIT = 200;
export const parseReviewView = (v: unknown): ReviewView => (v === "published" || v === "hidden" ? v : "all");

type DbRow = {
  id: string;
  product_id: string;
  author: string;
  rating: number;
  body: string;
  verified: boolean;
  seed: boolean;
  hidden: boolean;
  created_at: string;
  products: { product_translations: { locale: string; name: string }[] } | { product_translations: { locale: string; name: string }[] }[] | null;
};

function productNameOf(row: DbRow): string {
  const prod = Array.isArray(row.products) ? row.products[0] : row.products;
  const tr = prod?.product_translations ?? [];
  return (tr.find((t) => t.locale === "fr") ?? tr[0])?.name ?? "Produit supprimé";
}

export async function getAdminReviews(view: ReviewView): Promise<ReviewsData> {
  const sb = tryAdminClient();
  if (sb) {
    try {
      let q = sb
        .from("reviews")
        .select("id,product_id,author,rating,body,verified,seed,hidden,created_at,products(product_translations(locale,name))")
        .order("created_at", { ascending: false })
        .limit(REVIEW_LIMIT);
      if (view === "hidden") q = q.eq("hidden", true);
      if (view === "published") q = q.eq("hidden", false);
      const [rowsRes, allRes, hiddenRes] = await withTimeout(
        Promise.all([
          q,
          sb.from("reviews").select("id", { count: "exact", head: true }),
          sb.from("reviews").select("id", { count: "exact", head: true }).eq("hidden", true),
        ]),
      );
      if (!rowsRes.error && rowsRes.data) {
        const all = allRes.count ?? rowsRes.data.length;
        const hidden = hiddenRes.count ?? 0;
        const rows = (rowsRes.data as unknown as DbRow[]).map((r) => ({
          id: r.id,
          productId: r.product_id,
          productName: productNameOf(r),
          author: r.author,
          rating: r.rating,
          body: r.body,
          verified: r.verified,
          seed: r.seed,
          hidden: r.hidden,
          createdAt: r.created_at,
        }));
        const total = view === "hidden" ? hidden : view === "published" ? all - hidden : all;
        return { rows, counts: { all, published: all - hidden, hidden }, connected: true, truncated: total > rows.length };
      }
    } catch {
      /* repli démo */
    }
  }
  const names = new Map(catalogDemo.products.map((p) => [p.id, p.fr.name]));
  const all = catalogDemo.reviews
    .map((r) => ({
      id: r.id,
      productId: r.productId,
      productName: names.get(r.productId) ?? "Produit supprimé",
      author: r.author,
      rating: r.rating,
      body: r.body,
      verified: r.verified,
      seed: r.seed,
      hidden: false,
      createdAt: r.createdAt,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rows = view === "hidden" ? [] : all;
  return { rows, counts: { all: all.length, published: all.length, hidden: 0 }, connected: false, truncated: false };
}
