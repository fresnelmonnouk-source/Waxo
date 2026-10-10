import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { getSubscribers } from "@/lib/admin/data/newsletter";
import { NewsletterBoard } from "@/components/admin/newsletter/NewsletterBoard";

export const metadata: Metadata = { title: "Newsletter" };

export default async function NewsletterPage() {
  await requireAdmin();
  const data = await getSubscribers();
  return <NewsletterBoard rows={data.rows} counts={data.counts} connected={data.connected} truncated={data.truncated} />;
}
