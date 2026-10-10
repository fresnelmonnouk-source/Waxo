import type { Metadata } from "next";
import type { SearchParams } from "@/lib/orders/filters";
import { DeliveryBoard } from "@/components/admin/delivery/DeliveryBoard";
import { OrderDrawer } from "@/components/admin/orders/OrderDrawer";
import { SourceNote } from "@/components/admin/orders/ui";
import { getDeliveryData } from "@/lib/admin/data/delivery";
import { getOrderByNumber } from "@/lib/admin/data/orders";
import { requireAdmin } from "@/lib/admin/guard";
import { parseZoneFilter } from "@/lib/orders/delivery";
import { parseSelected } from "@/lib/orders/filters";

export const metadata: Metadata = { title: "Livraisons" };

export default async function DeliveryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = await searchParams;
  const zone = parseZoneFilter(sp.zone);
  const selected = parseSelected(sp);
  const [data, order] = await Promise.all([
    getDeliveryData(zone),
    selected ? getOrderByNumber(selected) : Promise.resolve(null),
  ]);
  const connected = data.source === "db" && !data.error;

  return (
    <div className="flex flex-col gap-5">
      <SourceNote source={data.source} error={data.error} />
      <DeliveryBoard
        board={data.board}
        fees={data.fees}
        zone={zone}
        connected={connected}
        todayLabel={data.todayLabel}
      />
      {order ? <OrderDrawer key={order.id} order={order} couriers={data.board.couriers} connected={connected} /> : null}
    </div>
  );
}
