import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/guard";
import { getAllSubscribersForExport } from "@/lib/admin/data/newsletter";
import { toCsv } from "@/lib/settings/csv";
import { fmtDateLong } from "@/lib/settings/format";
import { prettyPhone } from "@/lib/settings/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /admin/newsletter/export : CSV des abonnés (UTF-8 avec BOM, séparateur « ; », cellules neutralisées contre l'injection de formule). */
export async function GET() {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const subs = await getAllSubscribersForExport();
  if (!subs) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const rows: unknown[][] = [
    ["Canal", "Contact", "Date d'inscription"],
    ...subs.map((s) => [s.channel === "email" ? "E-mail" : "WhatsApp", s.channel === "email" ? s.value : "+229 " + prettyPhone(s.value), fmtDateLong(s.createdAt)]),
  ];
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="abonnes-newsletter-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
