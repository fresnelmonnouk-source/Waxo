import { getOrdersForExport } from "@/lib/admin/data/orders";
import { assertAdmin } from "@/lib/admin/guard";
import { toCsv } from "@/lib/orders/csv";
import { parseOrderFilters } from "@/lib/orders/filters";
import { PAY_LABEL, ZONE_LABEL, fmtDate, DATE_SHORT, normPhone } from "@/lib/orders/format";
import { STATUS_META } from "@/lib/orders/status";

// Export CSV des commandes (mêmes filtres que la liste, 1 000 lignes maximum). Réservé aux admins.
export async function GET(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return Response.json({ error: "Accès refusé." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const filters = parseOrderFilters(sp);
  const orders = await getOrdersForExport(filters);

  const csv = toCsv([
    [
      "Numéro",
      "Date",
      "Client",
      "Téléphone",
      "E-mail",
      "Zone",
      "Adresse",
      "Paiement",
      "Payée",
      "Statut",
      "Sous-total (F)",
      "Livraison (F)",
      "Total (F)",
      "Articles",
    ],
    ...orders.map((o) => [
      o.number,
      fmtDate(o.createdAt, DATE_SHORT),
      o.name,
      normPhone(o.phone),
      o.email,
      ZONE_LABEL[o.zone],
      o.address,
      PAY_LABEL[o.pay],
      o.paid,
      STATUS_META[o.status].label,
      o.subtotal,
      o.shippingFee,
      o.total,
      o.items.map((i) => `${i.qty}× ${i.name}`).join(" | "),
    ]),
  ]);

  const day = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="commandes-waxo-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
