import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { getAdminThread, getInbox, markAdminRead, parseInboxFilters, parseSelectedId } from "@/lib/conversations/admin-data";
import { DiscussionsBoard } from "@/components/admin/messages/DiscussionsBoard";

export const metadata: Metadata = { title: "Discussions" };

type SearchParams = Record<string, string | string[] | undefined>;

/** Boîte de réception « Discussions » : liste filtrable + fil ouvert (?c=<id>). Ouvrir un fil le marque comme lu. */
export default async function MessagesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = await searchParams;
  const filters = parseInboxFilters(sp);
  const selected = parseSelectedId(sp);
  const [inbox, thread] = await Promise.all([getInbox(filters), selected ? getAdminThread(selected) : Promise.resolve(null)]);
  if (thread?.unread) await markAdminRead(thread.id);
  return <DiscussionsBoard inbox={inbox} filters={filters} thread={thread} />;
}
