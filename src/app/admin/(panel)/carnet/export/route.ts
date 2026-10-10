import { loadLedger } from "@/lib/admin/data/ledger";
import { assertAdmin } from "@/lib/admin/guard";
import { ledgerCsv } from "@/lib/stats/ledger";

// Export CSV des écritures du carnet (UTF-8 avec BOM, séparateur « ; », cellules à formule neutralisées).
export async function GET() {
  if (!(await assertAdmin())) {
    return Response.json({ ok: false, code: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const { entries } = await loadLedger();
  return new Response(ledgerCsv(entries), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="carnet-de-comptes-waxo.csv"',
      "Cache-Control": "no-store",
    },
  });
}
