"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { deleteLedgerEntry, updateLedgerEntry } from "@/app/admin/(panel)/carnet/actions";
import { Notice, type NoticeState } from "@/components/admin/ui/Notice";
import { EXPENSE_CATS, EXPENSE_IDS, type ExpenseCatId } from "@/lib/admin/ui/constants";
import { MSG } from "@/lib/admin/ui/result";
import { fieldCls } from "./EntryForm";

export type EntryRow = { id: string; date: string; dateTxt: string; cat: ExpenseCatId; label: string; amount: number; amountFmt: string };

/** Liste des écritures du mois (maquette lignes 335-344), avec modification en ligne et suppression en deux temps. */
export function EntryList({ rows, readOnly }: { rows: EntryRow[]; readOnly: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [draft, setDraft] = useState({ date: "", cat: "pub" as ExpenseCatId, label: "", amount: "" });
  const [notice, setNotice] = useState<NoticeState>(null);
  const clear = useCallback(() => setNotice(null), []);

  function run(task: () => Promise<{ ok: boolean; message?: string }>, okText: string, after?: () => void) {
    if (readOnly) {
      setNotice({ kind: "error", text: MSG.unavailable });
      return;
    }
    startTransition(async () => {
      try {
        const res = await task();
        if (res.ok) {
          setNotice({ kind: "ok", text: okText });
          after?.();
          router.refresh();
        } else {
          setNotice({ kind: "error", text: res.message ?? MSG.error });
        }
      } catch {
        setNotice({ kind: "error", text: MSG.error });
      }
    });
  }

  if (rows.length === 0) {
    return (
      <>
        <Notice notice={notice} onClear={clear} />
        <span className="text-sm text-[#4A443C]">Aucune dépense enregistrée ce mois-ci.</span>
      </>
    );
  }
  return (
    <>
      <Notice notice={notice} onClear={clear} />
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((l) => {
          const c = EXPENSE_CATS[l.cat];
          if (editing === l.id) {
            return (
              <li key={l.id} className="flex flex-wrap items-center gap-2 border-t border-[#F0EBE1] py-2.5">
                <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} aria-label="Date" className={`${fieldCls} flex-[0_1_150px]`} />
                <select value={draft.cat} onChange={(e) => setDraft({ ...draft, cat: e.target.value as ExpenseCatId })} aria-label="Catégorie" className={`${fieldCls} flex-[0_1_170px]`}>
                  {EXPENSE_IDS.map((id) => (
                    <option key={id} value={id}>
                      {EXPENSE_CATS[id][0]}
                    </option>
                  ))}
                </select>
                <input value={draft.label} maxLength={120} onChange={(e) => setDraft({ ...draft, label: e.target.value })} aria-label="Libellé" className={`${fieldCls} flex-[1_1_160px]`} />
                <input value={draft.amount} inputMode="numeric" onChange={(e) => setDraft({ ...draft, amount: e.target.value })} aria-label="Montant en F" className={`${fieldCls} flex-[0_1_110px]`} />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => updateLedgerEntry(l.id, draft), "Écriture modifiée.", () => setEditing(null))}
                  className="min-h-11 cursor-pointer rounded-full border-0 bg-[#141210] px-4 text-[13px] font-semibold text-[#F4F1EA] disabled:opacity-60"
                >
                  Enregistrer
                </button>
                <button type="button" onClick={() => setEditing(null)} className="min-h-11 cursor-pointer border-0 bg-transparent px-2 text-[13px] underline underline-offset-[3px]">
                  Annuler
                </button>
              </li>
            );
          }
          return (
            <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[#F0EBE1] py-2.5 text-sm">
              <span className="min-w-16 text-[13px] text-[#4A443C]">{l.dateTxt}</span>
              <span className="rounded-full px-2.5 py-[3px] text-xs font-semibold" style={{ background: c[1], color: c[2] }}>
                {c[0]}
              </span>
              <span className="min-w-0 flex-[1_1_160px]">{l.label}</span>
              <strong className="whitespace-nowrap">{l.amountFmt}</strong>
              {confirmDel === l.id ? (
                <span className="flex items-center gap-1 text-[13px]">
                  Supprimer ?
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => deleteLedgerEntry(l.id), "Écriture supprimée.", () => setConfirmDel(null))}
                    className="min-h-11 cursor-pointer border-0 bg-transparent px-2 font-semibold text-[#9A3412] underline underline-offset-[3px]"
                  >
                    Oui
                  </button>
                  <button type="button" onClick={() => setConfirmDel(null)} className="min-h-11 cursor-pointer border-0 bg-transparent px-2 underline underline-offset-[3px]">
                    Non
                  </button>
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft({ date: l.date, cat: l.cat, label: l.label, amount: String(l.amount) });
                      setEditing(l.id);
                    }}
                    className="min-h-11 cursor-pointer border-0 bg-transparent px-2 text-[13px] underline underline-offset-[3px]"
                    aria-label={`Modifier l'écriture : ${l.label}`}
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    aria-label={`Supprimer l'écriture : ${l.label}`}
                    onClick={() => setConfirmDel(l.id)}
                    className="size-11 cursor-pointer rounded-full border-0 bg-transparent text-base text-[#9A3412] hover:bg-[#F6E1DA]"
                  >
                    ×
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
