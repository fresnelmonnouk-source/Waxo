"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { adjustStock } from "@/app/admin/(panel)/produits/actions";
import { Notice, safeCssUrl, type NoticeState } from "@/components/admin/ui/Notice";
import { MSG } from "@/lib/admin/ui/result";

export type LowRow = { id: string; name: string; bg: string | null; imageUrl: string | null; stock: number };

/** « Stock faible » (maquette lignes 101-113) : réassort rapide +1 / +10. */
export function LowStock({ rows, readOnly }: { rows: LowRow[]; readOnly: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);
  const clear = useCallback(() => setNotice(null), []);

  function add(row: LowRow, delta: 1 | 10) {
    if (readOnly) {
      setNotice({ kind: "error", text: MSG.unavailable });
      return;
    }
    setBusy(`${row.id}:${delta}`);
    startTransition(async () => {
      try {
        const res = await adjustStock(row.id, delta);
        if (res.ok) {
          setNotice({ kind: "ok", text: `${row.name} : ${res.stock} en stock.` });
          router.refresh();
        } else {
          setNotice({ kind: "error", text: res.message });
        }
      } catch {
        setNotice({ kind: "error", text: MSG.error });
      } finally {
        setBusy(null);
      }
    });
  }

  if (rows.length === 0) return <span className="text-sm text-[#4A443C]">Aucun produit sous 5 unités.</span>;
  return (
    <>
      <Notice notice={notice} onClear={clear} />
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((p) => {
          const bgImg = safeCssUrl(p.imageUrl);
          return (
            <li key={p.id} className="flex items-center gap-3 border-t border-[#F0EBE1] py-2.5">
              <div className="relative size-10 flex-none overflow-hidden rounded-[10px]" style={{ background: p.bg ?? "#EDE4CF" }}>
                {bgImg && <div aria-hidden="true" className="absolute inset-0 size-full bg-cover bg-center bg-no-repeat" style={{ backgroundImage: bgImg }} />}
              </div>
              <span className="min-w-0 flex-1 text-sm leading-[1.3]">{p.name}</span>
              <strong className="min-w-7 text-right text-[15px]" style={{ color: p.stock <= 0 ? "#9A3412" : "#C2410C" }}>
                {p.stock}
              </strong>
              <button
                type="button"
                aria-label={`Ajouter une unité : ${p.name}`}
                onClick={() => add(p, 1)}
                disabled={pending && busy === `${p.id}:1`}
                className="size-11 cursor-pointer rounded-full border border-[#D6CFC0] bg-white text-sm disabled:cursor-wait disabled:opacity-60"
              >
                +1
              </button>
              <button
                type="button"
                aria-label={`Ajouter dix unités : ${p.name}`}
                onClick={() => add(p, 10)}
                disabled={pending && busy === `${p.id}:10`}
                className="min-h-11 cursor-pointer rounded-full border-0 bg-[#FFC93C] px-3 text-xs font-bold disabled:cursor-wait disabled:opacity-60"
              >
                +10
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
