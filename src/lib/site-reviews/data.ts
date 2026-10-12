import "server-only";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";
import type { SiteReview } from "./logic";

// Avis boutique PUBLIÉS (RLS : status = 'published'). Jamais de repli fictif : sans base, sans table ou en erreur → [].
const TIMEOUT_MS = 3000;

export async function getPublishedSiteReviews(limit = 12): Promise<SiteReview[]> {
  if (!supabasePublicEnv()) return [];
  try {
    const work = createPublicClient()
      .from("site_reviews")
      .select("id,author,city,rating,body,verified,published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit);
    const res = await Promise.race([Promise.resolve(work), new Promise<null>((r) => setTimeout(() => r(null), TIMEOUT_MS))]);
    if (!res || res.error || !res.data) return [];
    return (res.data as { id: string; author: string; city: string | null; rating: number; body: string; verified: boolean; published_at: string | null }[]).map(
      (r) => ({ id: r.id, author: r.author, city: r.city, rating: r.rating, body: r.body, verified: r.verified, publishedAt: r.published_at ?? "" }),
    );
  } catch {
    return [];
  }
}
