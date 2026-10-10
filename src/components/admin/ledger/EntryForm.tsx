"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { addLedgerEntry } from "@/app/admin/(panel)/carnet/actions";
import { Notice, type NoticeState } from "@/components/admin/ui/Notice";
import { EXPENSE_CATS, EXPENSE_IDS, type ExpenseCatId } from "@/lib/admin/ui/constants";
import { MSG } from "@/lib/admin/ui/result";

export const fieldCls = "min-w-0 rounded-xl border border-[#E2DCCF] bg-white px-2.5 py-[9px] text-sm min-h-11";

/** Ajout d'une écriture (maquette lignes 327-334) : date, catégorie, libellé, montant. */
export function EntryForm({ today, readOnly }: { today: string; readOnly: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(today);
  const [cat, setCat] = useState<ExpenseCatId>("pub");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [notice, setNotice] = useState<NoticeState>(null);
  const clear = useCallback(() => setNotice(null), []);

  function submit() {
    if (readOnly) {
      setNotice({ kind: "error", text: MSG.unavailable });
      return;
    }
    startTransition(async () => {
      try {
        const res = await addLedgerEntry({ date, cat, label, amount });
        if (res.ok) {
          setLabel("");
          setAmount("");
          setNotice({ kind: "ok", text: "Écriture ajoutée." });
          router.refresh();
        } else {
          setNotice({ kind: "error", text: res.message });
        }
      } catch {
        setNotice({ kind: "error", text: MSG.error });
      }
    });
  }

  return (
    <>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#FAF8F3] p-3"
      >
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" className={`${fieldCls} flex-[0_1_150px]`} />
        <select value={cat} onChange={(e) => setCat(e.target.value as ExpenseCatId)} aria-label="Catégorie" className={`${fieldCls} flex-[0_1_170px]`}>
          {EXPENSE_IDS.map((id) => (
            <option key={id} value={id}>
              {EXPENSE_CATS[id][0]}
            </option>
          ))}
        </select>
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} aria-label="Libellé" placeholder="Libellé (ex. Pub Facebook)" className={`${fieldCls} flex-[1_1_180px]`} />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" aria-label="Montant en F" placeholder="Montant (F)" className={`${fieldCls} flex-[0_1_120px]`} />
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 cursor-pointer rounded-full border-0 bg-[#141210] px-4 text-[13px] font-semibold text-[#F4F1EA] hover:bg-[#2C2823] disabled:cursor-wait disabled:opacity-60"
        >
          Ajouter
        </button>
      </form>
      <Notice notice={notice} onClear={clear} />
    </>
  );
}
