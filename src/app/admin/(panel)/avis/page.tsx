import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { getAdminReviews, parseReviewView } from "@/lib/admin/data/reviews";
import { ReviewsBoard } from "@/components/admin/reviews/ReviewsBoard";
import { SiteReviewsPanel } from "@/components/admin/reviews/SiteReviewsPanel";
import { getAdminSiteReviews } from "@/lib/admin/data/site-reviews";

export const metadata: Metadata = { title: "Avis" };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const raw = sp.vue;
  const view = parseReviewView(Array.isArray(raw) ? raw[0] : raw);
  const [data, site] = await Promise.all([getAdminReviews(view), getAdminSiteReviews()]);
  return (
    <div className="flex flex-col gap-5">
      <SiteReviewsPanel data={site} />
      <ReviewsBoard rows={data.rows} counts={data.counts} view={view} truncated={data.truncated} connected={data.connected} />
    </div>
  );
}
