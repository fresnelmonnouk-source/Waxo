import type { Metadata } from "next";
import Link from "next/link";
import { AccountantPanel } from "@/components/admin/AccountantPanel";
import { CostTable } from "@/components/admin/ledger/CostTable";
import { EntryForm } from "@/components/admin/ledger/EntryForm";
import { EntryList, type EntryRow } from "@/components/admin/ledger/EntryList";
import { LedgerKpis, ProfitLoss } from "@/components/admin/ledger/ProfitLoss";
import { Card } from "@/components/admin/ui/Card";
import { ChipLink } from "@/components/admin/ui/Chip";
import { SourceBanner } from "@/components/admin/ui/SourceBanner";
import { getLedgerPage } from "@/lib/admin/data/ledger";
import { requireAdmin } from "@/lib/admin/guard";
import { fmtXof } from "@/lib/money";
import { cap, monthLabel, monthOnly, plural } from "@/lib/stats/format";
import { dayKeyOf, fmtDate, nowMs } from "@/lib/stats/time";

export const metadata: Metadata = { title: "Carnet de comptes" };

const VISIBLE_MONTHS = 4;

// Carnet de comptes (maquette lignes 307-386). Mois piloté par l'URL : ?mois=AAAA-MM. Le volet IA est monté tel quel (agent « comptable IA »).
export default async function LedgerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const mois = Array.isArray(sp.mois) ? sp.mois[0] : sp.mois;
  const { source, months, key, account: a, costRows } = await getLedgerPage(mois);
  const readOnly = source !== "db";

  const entries: EntryRow[] = a.entries.map((l) => ({
    id: l.id,
    date: l.date,
    dateTxt: fmtDate(l.date, { day: "numeric", month: "short" }),
    cat: l.cat,
    label: l.label,
    amount: l.amount,
    amountFmt: fmtXof(l.amount),
  }));
  const shown = months.slice(0, VISIBLE_MONTHS);
  const older = months.slice(VISIBLE_MONTHS);

  return (
    <>
      <SourceBanner source={source} />
      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-5">
          <div role="group" aria-label="Mois" className="flex flex-wrap items-center gap-1.5">
            {shown.map((k) => (
              <ChipLink key={k} href={`/admin/carnet?mois=${k}`} active={k === key}>
                {cap(monthLabel(k))}
              </ChipLink>
            ))}
            {older.length > 0 && (
              <nav aria-label="Mois plus anciens" className="flex flex-wrap gap-1.5">
                {older.map((k) => (
                  <Link key={k} href={`/admin/carnet?mois=${k}`} aria-current={k === key ? "true" : undefined} className="text-[13px] underline underline-offset-[3px]">
                    {cap(monthLabel(k))}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          <LedgerKpis a={a} />
          <ProfitLoss a={a} />

          <Card className="gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="m-0 text-[17px] font-bold">Écritures</h2>
              <span className="text-[13px] text-[#4A443C]">
                {plural(entries.length, "écriture", "écritures")} · {fmtXof(entries.reduce((x, l) => x + l.amount, 0))}
              </span>
            </div>
            <EntryForm today={dayKeyOf(nowMs())} readOnly={readOnly} />
            <EntryList rows={entries} readOnly={readOnly} />
          </Card>

          <Card className="gap-1.5">
            <h2 className="m-0 text-[17px] font-bold">Prix d&apos;achat des produits</h2>
            <span className="mb-2 text-[13px] leading-normal text-[#4A443C]">
              Coût unitaire rendu Cotonou : achat, transport et dédouanement. Il sert à calculer la marge de chaque vente.
            </span>
            <CostTable
              key={`${key}-${costRows.map((r) => r.cost ?? "x").join(",")}`}
              rows={costRows.map((r) => ({ id: r.id, name: r.name, price: r.price, cost: r.cost, soldInMonth: r.soldInMonth }))}
              monthName={monthOnly(key)}
              readOnly={readOnly}
            />
          </Card>
        </div>
        <div className="sticky top-5 min-w-0 flex-[1_1_340px] min-[1180px]:max-w-[440px]">
          <AccountantPanel />
        </div>
      </div>
    </>
  );
}
