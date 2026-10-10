import type { Metadata } from "next";
import type { SearchParams } from "@/lib/orders/filters";
import { OrderDrawer } from "@/components/admin/orders/OrderDrawer";
import { OrdersBoard } from "@/components/admin/orders/OrdersBoard";
import { SourceNote } from "@/components/admin/orders/ui";
import { getCouriers } from "@/lib/admin/data/delivery";
import { getOrderByNumber, getOrders } from "@/lib/admin/data/orders";
import { requireAdmin } from "@/lib/admin/guard";
import { parseOrderFilters, parseSelected } from "@/lib/orders/filters";

export const metadata: Metadata = { title: "Commandes" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = await searchParams;
  const filters = parseOrderFilters(sp);
  const selected = parseSelected(sp);
  const [data, order, couriers] = await Promise.all([
    getOrders(filters),
    selected ? getOrderByNumber(selected) : Promise.resolve(null),
    selected ? getCouriers() : Promise.resolve(null),
  ]);
  const connected = data.source === "db" && !data.error;

  return (
    <div className="flex flex-col gap-5">
      <SourceNote source={data.source} error={data.error} />
      <OrdersBoard
        rows={data.rows}
        counts={data.counts}
        total={data.total}
        page={data.page}
        pageCount={data.pageCount}
        filters={{ ...filters, page: data.page }}
        connected={connected}
        error={data.error}
      />
      {order ? (
        <OrderDrawer key={order.id} order={order} couriers={couriers?.couriers ?? []} connected={data.source === "db"} />
      ) : null}
    </div>
  );
}
