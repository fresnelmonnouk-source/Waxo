"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { setOrderStatusAction } from "@/app/admin/(panel)/commandes/actions";
import { Notice, type NoticeState } from "@/components/admin/ui/Notice";
import { MSG } from "@/lib/admin/ui/result";
import { STATUS, type OrderStatusId } from "@/lib/admin/ui/constants";

export type TodoRow = {
  id: string;
  number: string;
  name: string;
  dateTxt: string;
  zoneTxt: string;
  status: OrderStatusId;
  totalFmt: string;
  nextStatus: OrderStatusId | null;
  nextLabel: string;
};

/** « Commandes à traiter » (maquette lignes 88-100) : ligne cliquable vers la commande + bouton d'étape suivante. */
export function TodoOrders({ rows, readOnly }: { rows: TodoRow[]; readOnly: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);
  const clear = useCallback(() => setNotice(null), []);

  function advance(row: TodoRow) {
    if (!row.nextStatus) return;
    if (readOnly) {
      setNotice({ kind: "error", text: MSG.unavailable });
      return;
    }
    const to = row.nextStatus;
    setBusyId(row.id);
    startTransition(async () => {
      try {
        const res = await setOrderStatusAction({ orderId: row.id, to });
        if (res.ok) {
          setNotice({ kind: "ok", text: "message" in res && typeof res.message === "string" ? res.message : "Statut mis à jour." });
          router.refresh();
        } else {
          setNotice({ kind: "error", text: res.message });
        }
      } catch {
        setNotice({ kind: "error", text: MSG.error });
      } finally {
        setBusyId(null);
      }
    });
  }

  if (rows.length === 0) return <span className="text-sm text-[#4A443C]">Aucune commande en attente.</span>;
  return (
    <>
      <Notice notice={notice} onClear={clear} />
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((o) => {
          const st = STATUS[o.status];
          return (
            <li key={o.id} className="relative flex flex-wrap items-center gap-x-3.5 gap-y-2 border-t border-[#F0EBE1] py-3">
              <Link
                href={`/admin/commandes?q=${encodeURIComponent(o.number)}`}
                className="min-w-20 text-sm font-bold no-underline after:absolute after:inset-0 after:content-['']"
              >
                {o.number}
              </Link>
              <span className="min-w-0 flex-[1_1_140px] text-sm">
                {o.name}
                <span className="block text-xs text-[#4A443C]">
                  {o.dateTxt} · {o.zoneTxt}
                </span>
              </span>
              <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: st[1], color: st[2] }}>
                {st[0]}
              </span>
              <strong className="min-w-[76px] text-right text-sm">{o.totalFmt}</strong>
              {o.nextStatus && (
                <button
                  type="button"
                  onClick={() => advance(o)}
                  disabled={pending && busyId === o.id}
                  className="relative z-10 min-h-11 cursor-pointer rounded-full border-0 bg-[#141210] px-3 text-xs font-semibold text-[#F4F1EA] hover:bg-[#2C2823] disabled:cursor-wait disabled:opacity-60"
                >
                  {pending && busyId === o.id ? "…" : o.nextLabel}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
