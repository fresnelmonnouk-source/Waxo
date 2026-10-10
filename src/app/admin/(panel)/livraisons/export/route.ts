import { getDeliveryExport } from "@/lib/admin/data/delivery";
import { assertAdmin } from "@/lib/admin/guard";
import { toCsv } from "@/lib/orders/csv";
import { DATE_SHORT, PAY_LABEL, ZONE_LABEL, codDue, fmtDate, normPhone } from "@/lib/orders/format";
import { STATUS_META } from "@/lib/orders/status";

// Export CSV de la tournée du jour : commandes à expédier + en route, avec livreur et montant à encaisser.
export async function GET() {
  const admin = await assertAdmin();
  if (!admin) return Response.json({ error: "Accès refusé." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const { orders, couriers } = await getDeliveryExport();
  const byId = new Map(couriers.map((c) => [c.id, c]));
  const csv = toCsv([
    ["Numéro", "Statut", "Livreur", "Client", "Téléphone", "Zone", "Adresse", "Paiement", "À encaisser (F)", "Reçue le"],
    ...orders.map((o) => [
      o.number,
      STATUS_META[o.status].label,
      (o.courierId ? byId.get(o.courierId)?.name : "") ?? "",
      o.name,
      normPhone(o.phone),
      ZONE_LABEL[o.zone],
      o.address,
      PAY_LABEL[o.pay],
      codDue(o),
      fmtDate(o.createdAt, DATE_SHORT),
    ]),
  ]);

  const day = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="livraisons-waxo-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
