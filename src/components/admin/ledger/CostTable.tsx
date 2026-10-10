"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { setProductCost } from "@/app/admin/(panel)/carnet/actions";
import { Notice, type NoticeState } from "@/components/admin/ui/Notice";
import { MSG } from "@/lib/admin/ui/result";
import { fmtXof } from "@/lib/money";
import { pctTxt, plural } from "@/lib/stats/format";
import { marginRate, parseAmount } from "@/lib/stats/ledger";

export type CostTableRow = { id: string; name: string; price: number; cost: number | null; soldInMonth: number };

/** « Prix d'achat des produits » (maquette lignes 346-358) : saisie du coût unitaire, marge calculée en direct. */
export function CostTable({ rows, monthName, readOnly }: { rows: CostTableRow[]; monthName: string; readOnly: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.id, r.cost == null ? "" : String(r.cost)])));
  const [saved, setSaved] = useState<Record<string, number | null>>(() => Object.fromEntries(rows.map((r) => [r.id, r.cost])));
  const [notice, setNotice] = useState<NoticeState>(null);
  const clear = useCallback(() => setNotice(null), []);

  function commit(row: CostTableRow) {
    const raw = values[row.id] ?? "";
    const next = raw.trim() === "" ? null : parseAmount(raw);
    if (next === saved[row.id]) return;
    if (readOnly) {
      setNotice({ kind: "error", text: MSG.unavailable });
      return;
    }
    startTransition(async () => {
      try {
        const res = await setProductCost(row.id, next);
        if (res.ok) {
          setSaved((s) => ({ ...s, [row.id]: next }));
          setValues((v) => ({ ...v, [row.id]: next == null ? "" : String(next) }));
          setNotice({ kind: "ok", text: `Prix d'achat enregistré : ${row.name}.` });
          router.refresh();
        } else {
          setNotice({ kind: "error", text: res.message });
        }
      } catch {
        setNotice({ kind: "error", text: MSG.error });
      }
    });
  }

  const grid = "grid grid-cols-[minmax(0,1fr)_78px_96px_58px] gap-2.5";
  return (
    <>
      <Notice notice={notice} onClear={clear} />
      <div className={`${grid} pb-1.5 text-xs font-semibold text-[#4A443C]`}>
        <span>Produit</span>
        <span className="text-right">Vente</span>
        <span className="text-right">Achat</span>
        <span className="text-right">Marge</span>
      </div>
      {rows.map((p) => {
        const raw = values[p.id] ?? "";
        const live = raw.trim() === "" ? null : parseAmount(raw);
        const m = marginRate(p.price, live);
        return (
          <div key={p.id} className={`${grid} items-center border-t border-[#F0EBE1] py-2 text-sm`}>
            <span className="min-w-0 leading-[1.3]">
              {p.name}
              <span className="block text-xs text-[#6B645A]">
                {plural(p.soldInMonth, "vendu", "vendus")} en {monthName}
              </span>
            </span>
            <span className="text-right">{fmtXof(p.price)}</span>
            <input
              value={raw}
              inputMode="numeric"
              aria-label={`Prix d'achat de ${p.name}`}
              placeholder="À saisir"
              onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
              onBlur={() => commit(p)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="min-h-11 w-full min-w-0 rounded-[10px] bg-[#FAF8F3] px-2 py-[7px] text-right text-sm"
              style={{ border: `1px solid ${live == null ? "#C2410C" : "#E2DCCF"}` }}
            />
            <strong className="text-right" style={{ color: m == null ? "#6B645A" : m < 0.3 ? "#C2410C" : "#1F6B4A" }}>
              {m == null ? "—" : pctTxt(m)}
            </strong>
          </div>
        );
      })}
    </>
  );
}
