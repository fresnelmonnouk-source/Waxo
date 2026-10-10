import type { Metadata } from "next";
import type { SearchParams } from "@/lib/orders/filters";
import { ClientsBoard } from "@/components/admin/clients/ClientsBoard";
import { SourceNote } from "@/components/admin/orders/ui";
import { getClientOrders, getClients } from "@/lib/admin/data/clients";
import { requireAdmin } from "@/lib/admin/guard";
import { filterClients } from "@/lib/orders/clients";
import { sanitizeSearch } from "@/lib/orders/filters";

export const metadata: Metadata = { title: "Clients" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));
const CLIENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = sanitizeSearch(first(sp.q));
  const news = first(sp.news) === "1";
  const wanted = first(sp.client);

  const data = await getClients();
  const rows = filterClients(data.rows, q, news);
  const client = CLIENT_ID.test(wanted) ? (data.rows.find((c) => c.id === wanted) ?? null) : null;
  const orders = client ? await getClientOrders(client.id) : [];

  return (
    <div className="flex flex-col gap-5">
      <SourceNote source={data.source} error={data.error} />
      <ClientsBoard
        rows={rows}
        filters={{ q, news }}
        totalAll={data.rows.length}
        newsCount={data.rows.filter((c) => c.news).length}
        truncated={data.truncated}
        detail={client ? { client, orders } : null}
      />
    </div>
  );
}
