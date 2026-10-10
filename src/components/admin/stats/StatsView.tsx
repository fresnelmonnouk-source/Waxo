import { Card, KpiCard } from "@/components/admin/ui/Card";
import { ChipLink } from "@/components/admin/ui/Chip";
import { CATEGORY_COLOR, CATEGORY_LABEL, PAY_COLOR, PAY_LABEL, ZONE_LABEL } from "@/lib/admin/ui/constants";
import { fmtXof } from "@/lib/money";
import { WEEKDAYS_SHORT, dec1, pctTxt, plural } from "@/lib/stats/format";
import { STATS_RANGES, deltaPct, type GroupRow, type StatsResult } from "@/lib/stats";

function delta(current: number, previous: number, range: number): { sub: string; color: string } {
  const d = deltaPct(current, previous);
  if (d === null) return { sub: "Pas de période de comparaison", color: "#4A443C" };
  return { sub: `${d >= 0 ? "+" : "−"}${Math.abs(Math.round(d * 100))} % vs ${range} j précédents`, color: d >= 0 ? "#1F6B4A" : "#9A3412" };
}

function Breakdown({ title, rows, labelOf, colorOf, valueOf }: { title: string; rows: GroupRow[]; labelOf: (k: string) => string; colorOf: (k: string) => string; valueOf: (v: number) => string }) {
  return (
    <Card className="gap-3.5">
      <h2 className="m-0 text-[17px] font-bold">{title}</h2>
      {rows.length === 0 && <span className="text-sm text-[#4A443C]">Aucune vente sur la période.</span>}
      {rows.map((r) => (
        <div key={r.key} className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-2.5 text-[13px]">
            <span>{labelOf(r.key)}</span>
            <span className="whitespace-nowrap">
              <strong>{valueOf(r.value)}</strong> <span className="text-[#6B645A]">{pctTxt(r.share)}</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#F0EBE1]">
            <div className="h-full rounded-full" style={{ width: `${r.widthPct}%`, background: colorOf(r.key) }} />
          </div>
        </div>
      ))}
    </Card>
  );
}

/** Statistiques (maquette lignes 263-306) : mêmes calculs que `statsVals()`, graphiques en CSS/SVG maison. */
export function StatsView({ stats: s }: { stats: StatsResult }) {
  const maxBar = Math.max(1, ...s.bars.map((b) => b.v));
  const maxWeek = Math.max(1, ...s.weekCounts);
  const dCa = delta(s.ca, s.prevCa, s.range);
  const dCount = delta(s.count, s.prevCount, s.range);
  const dAvg = delta(s.avg, s.prevAvg, s.range);
  return (
    <>
      <div role="group" aria-label="Période" className="flex flex-wrap gap-1.5">
        {STATS_RANGES.map((n) => (
          <ChipLink key={n} href={`/admin/stats?periode=${n}`} active={s.range === n}>
            {n} jours
          </ChipLink>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
        <KpiCard size={24} label="Chiffre d'affaires" value={fmtXof(s.ca)} sub={dCa.sub} subColor={dCa.color} />
        <KpiCard size={24} label="Commandes" value={String(s.count)} sub={dCount.sub} subColor={dCount.color} />
        <KpiCard size={24} label="Panier moyen" value={fmtXof(s.avg)} sub={dAvg.sub} subColor={dAvg.color} />
        <KpiCard size={24} label="Articles vendus" value={String(s.units)} sub={`${s.count ? dec1(s.units / s.count) : "0"} par commande`} />
        <KpiCard size={24} label="Clients acheteurs" value={String(s.buyers)} sub="Numéros de téléphone distincts" />
        <KpiCard
          size={24}
          label="Taux d'annulation"
          value={pctTxt(s.cancelRate)}
          sub={plural(s.cancelledCount, "commande annulée", "commandes annulées")}
          subColor={s.cancelRate > 0.08 ? "#9A3412" : "#4A443C"}
        />
      </div>

      <Card className="gap-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="m-0 text-[17px] font-bold">Chiffre d&apos;affaires</h2>
          <span className="text-[13px] text-[#4A443C]">
            {s.range <= 30 ? "Par jour, livraison comprise, hors annulations" : "Par semaine, livraison comprise, hors annulations"}
          </span>
        </div>
        <div role="img" aria-label={`Chiffre d'affaires sur ${s.range} jours : ${fmtXof(s.ca)}`}>
          <div className="flex h-[200px] items-end gap-[3px] border-b border-[#E2DCCF]">
            {s.bars.map((b, i) => (
              <div
                key={i}
                title={b.tip}
                className="min-w-0 flex-[1_1_0] rounded-t-[4px]"
                style={{
                  height: b.v ? `${Math.max(2, (b.v / maxBar) * 100)}%` : "2px",
                  background: i === s.bars.length - 1 ? "#E2552B" : b.v ? "#141210" : "#E2DCCF",
                }}
              />
            ))}
          </div>
          <div className="-mt-1.5 flex gap-[3px] pt-1.5" aria-hidden="true">
            {s.bars.map((b, i) => (
              <span key={i} className="min-w-0 flex-[1_1_0] whitespace-nowrap text-center text-[11px] text-[#6B645A]">
                {b.label}
              </span>
            ))}
          </div>
        </div>
        <table className="sr-only">
          <caption>Chiffre d&apos;affaires par {s.range <= 30 ? "jour" : "semaine"}</caption>
          <tbody>
            {s.bars.map((b, i) => (
              <tr key={i}>
                <td>{b.tip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-start gap-5">
        <Breakdown
          title="Ventes par catégorie"
          rows={s.byCategory}
          labelOf={(k) => CATEGORY_LABEL[k] ?? "Autre"}
          colorOf={(k) => CATEGORY_COLOR[k] ?? "#6B645A"}
          valueOf={fmtXof}
        />
        <Breakdown
          title="Moyens de paiement"
          rows={s.byPay}
          labelOf={(k) => PAY_LABEL[k] ?? k}
          colorOf={(k) => PAY_COLOR[k] ?? "#6B645A"}
          valueOf={(v) => plural(v, "commande", "commandes")}
        />
        <Breakdown
          title="Zones de livraison"
          rows={s.byZone}
          labelOf={(k) => ZONE_LABEL[k] ?? k}
          colorOf={(k) => (k === "cotonou" ? "#141210" : "#FFC93C")}
          valueOf={fmtXof}
        />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-start gap-5">
        <Card className="gap-1">
          <h2 className="m-0 mb-2 text-[17px] font-bold">Produits qui rapportent le plus</h2>
          {s.topRev.length === 0 && <span className="text-sm text-[#4A443C]">Aucune vente sur la période.</span>}
          <ol className="m-0 flex list-none flex-col p-0">
            {s.topRev.map((t, i) => (
              <li key={`${t.name}-${i}`} className="flex items-center gap-3 border-t border-[#F0EBE1] py-2.5 text-sm">
                <span className="w-6 font-display font-bold">{i + 1}</span>
                <span className="min-w-0 flex-1">{t.name}</span>
                <span className="text-[#4A443C]">{plural(t.qty, "vendu", "vendus")}</span>
                <strong className="min-w-[84px] text-right">{fmtXof(t.rev)}</strong>
              </li>
            ))}
          </ol>
        </Card>
        <Card className="gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-[17px] font-bold">Commandes par jour de la semaine</h2>
            <span className="text-[13px] text-[#4A443C]">Repère les jours forts pour programmer vos publicités.</span>
          </div>
          <div className="flex h-[140px] items-end gap-2.5">
            {s.weekCounts.map((n, i) => (
              <div key={i} className="flex h-full min-w-0 flex-[1_1_0] flex-col items-center justify-end gap-1.5">
                <span className="text-xs font-semibold">{n}</span>
                <div className="w-full rounded-t-md" style={{ height: `${Math.max(3, (n / maxWeek) * 82)}%`, background: n === maxWeek ? "#E2552B" : "#141210" }} />
              </div>
            ))}
          </div>
          <div className="flex gap-2.5">
            {WEEKDAYS_SHORT.map((l) => (
              <span key={l} className="min-w-0 flex-[1_1_0] text-center text-xs text-[#4A443C]">
                {l}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
