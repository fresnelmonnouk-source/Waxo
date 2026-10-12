import "server-only";
import { tryAdminClient, withTimeout } from "@/lib/settings/db";

// Lecture admin des avis boutique (0018), service_role. Table absente (0018 non appliquée) → message explicite.

export type AdminSiteReview = {
  id: string;
  createdAt: string;
  author: string;
  city: string | null;
  rating: number;
  body: string;
  source: "client" | "admin";
  origin: string | null;
  verified: boolean;
  status: "pending" | "published" | "hidden";
};

export type AdminSiteReviewsData = { connected: boolean; missing: boolean; rows: AdminSiteReview[] };

export async function getAdminSiteReviews(): Promise<AdminSiteReviewsData> {
  const sb = tryAdminClient();
  if (!sb) return { connected: false, missing: false, rows: [] };
  try {
    const { data, error } = await withTimeout(
      sb.from("site_reviews").select("id,created_at,author,city,rating,body,source,origin,verified,status").order("created_at", { ascending: false }).limit(300),
    );
    if (error) return { connected: true, missing: error.code === "42P01" || error.code === "PGRST205", rows: [] };
    const rows = (data ?? []).map((r) => ({
      id: r.id as string,
      createdAt: r.created_at as string,
      author: r.author as string,
      city: (r.city as string | null) ?? null,
      rating: r.rating as number,
      body: r.body as string,
      source: r.source as "client" | "admin",
      origin: (r.origin as string | null) ?? null,
      verified: !!r.verified,
      status: r.status as AdminSiteReview["status"],
    }));
    // À valider d'abord, puis publiés, puis masqués.
    const order = { pending: 0, published: 1, hidden: 2 } as const;
    rows.sort((a, b) => order[a.status] - order[b.status] || b.createdAt.localeCompare(a.createdAt));
    return { connected: true, missing: false, rows };
  } catch {
    return { connected: true, missing: false, rows: [] };
  }
}
