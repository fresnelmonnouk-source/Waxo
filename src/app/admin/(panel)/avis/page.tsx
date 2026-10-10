import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { getAdminReviews, parseReviewView } from "@/lib/admin/data/reviews";
import { ReviewsBoard } from "@/components/admin/reviews/ReviewsBoard";

export const metadata: Metadata = { title: "Avis" };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const raw = sp.vue;
  const view = parseReviewView(Array.isArray(raw) ? raw[0] : raw);
  const data = await getAdminReviews(view);
  return <ReviewsBoard rows={data.rows} counts={data.counts} view={view} truncated={data.truncated} connected={data.connected} />;
}
