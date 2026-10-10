import { Card } from "@/components/admin/ui/Card";
import { EXPENSE_CATS } from "@/lib/admin/ui/constants";
import { fmtXof } from "@/lib/money";
import { adBreakEven, type MonthAccount } from "@/lib/stats";
import { dec1, monthLabel, pctTxt, plural } from "@/lib/stats/format";

/** Indicateurs du mois (maquette lignes 313-315). */
export function LedgerKpis({ a }: { a: MonthAccount }) {
  const items = [
    { label: "Chiffre d'affaires", value: fmtXof(a.ca), sub: `${plural(a.orders, "commande", "commandes")} · ${plural(a.units, "article", "articles")}`, color: "#141210" },
    { label: "Marge brute", value: fmtXof(a.gross), sub: `${pctTxt(a.grossPct)} du chiffre d'affaires`, color: "#141210" },
    { label: "Charges", value: fmtXof(a.opex), sub: `dont publicité ${fmtXof(a.exp.pub)}`, color: "#141210" },
    { label: "Résultat net", value: fmtXof(a.net), sub: a.net >= 0 ? "Bénéfice du mois" : "Perte du mois", color: a.net >= 0 ? "#1F6B4A" : "#9A3412" },
  ];
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3.5">
      {items.map((k) => (
        <div key={k.label} className="flex flex-col gap-1.5 rounded-[20px] bg-white px-5 py-[18px]">
          <span className="text-[13px] text-[#4A443C]">{k.label}</span>
          <strong className="font-display text-[22px] font-semibold tracking-[-0.03em]" style={{ color: k.color }}>
            {k.value}
          </strong>
          <span className="text-[13px] text-[#4A443C]">{k.sub}</span>
        </div>
      ))}
    </div>
  );
}

type Row = { label: string; value: string; strong?: boolean; muted?: boolean; color?: string };

/** Compte de résultat du mois (maquette lignes 316-324). */
export function ProfitLoss({ a }: { a: MonthAccount }) {
  const ml = monthLabel(a.key);
  const neg = (v: number) => (v ? `− ${fmtXof(v)}` : fmtXof(0));
  const rows: Row[] = [
    { label: "Ventes de produits", value: fmtXof(a.sales) },
    { label: "Frais de livraison facturés", value: fmtXof(a.shipF) },
    { label: "Chiffre d'affaires", value: fmtXof(a.ca), strong: true },
    { label: "Coût d'achat des produits vendus", value: neg(a.cogs) },
    { label: "Marge brute", value: `${fmtXof(a.gross)} · ${pctTxt(a.grossPct)}`, strong: true },
    ...(["pub", "livraison", "emballage", "loyer", "salaire", "autre"] as const).map((k) => ({ label: EXPENSE_CATS[k][0], value: neg(a.exp[k]), muted: !a.exp[k] })),
    { label: "Résultat net", value: fmtXof(a.net), strong: true, color: a.net >= 0 ? "#1F6B4A" : "#9A3412" },
  ];
  return (
    <Card>
      <h2 className="m-0 mb-2.5 text-[17px] font-bold">Compte de résultat · {ml}</h2>
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex justify-between gap-3 py-[9px]"
          style={{
            borderBottom: `1px solid ${r.strong ? "#141210" : "#F0EBE1"}`,
            fontSize: r.strong ? 15 : 14,
            fontWeight: r.strong ? 700 : 400,
            color: r.color ?? (r.muted ? "#78716A" : "#141210"),
          }}
        >
          <span>{r.label}</span>
          <span className="whitespace-nowrap">{r.value}</span>
        </div>
      ))}
      <div className="flex flex-col gap-1.5 pt-3 text-[13px] leading-normal text-[#4A443C]">
        <span>
          Achats de stock payés en {ml} : {fmtXof(a.stockBuy)}. Ils sortent de la trésorerie mais ne sont pas déduits du résultat : leur coût est compté au fil des
          ventes.
        </span>
        {a.roas != null && (
          <span>
            Publicité : 1 F dépensé pour {dec1(a.roas)} F de ventes produits (rentable au-delà de {dec1(adBreakEven(a.grossPct))}).
          </span>
        )}
        {a.missing.length > 0 && <span className="text-[#C2410C]">Prix d&apos;achat manquant pour : {a.missing.join(", ")}. La marge est surestimée.</span>}
      </div>
    </Card>
  );
}
