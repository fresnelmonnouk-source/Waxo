"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { draftReplyAction, setMessageDoneAction } from "@/app/admin/(panel)/messages/actions";
import type { AdminMessage } from "@/lib/admin/data/messages";
import { replyLink, type Draft } from "@/lib/settings/kb-search";
import { fmtDateShort } from "@/lib/settings/format";
import { validEmail } from "@/lib/settings/phone";
import { btnLine, DemoBanner, EmptyBox, useToast } from "../settings/ui";

export function MessagesBoard({
  rows,
  initialDrafts,
  shopName,
  connected,
  truncated,
}: {
  rows: AdminMessage[];
  initialDrafts: Record<string, Draft>;
  shopName: string;
  connected: boolean;
  truncated: boolean;
}) {
  const { show, node } = useToast();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(initialDrafts);
  const [doneOverride, setDoneOverride] = useState<Record<string, boolean>>({});

  function toggleDone(m: AdminMessage, next: boolean, quiet = false) {
    setBusyId(m.id);
    startTransition(async () => {
      try {
        const res = await setMessageDoneAction(m.id, next);
        if (res.ok) {
          setDoneOverride((o) => ({ ...o, [m.id]: next }));
          if (!quiet) show(next ? "Message marqué comme traité." : "Message remis à traiter.");
        } else if (!quiet) show(res.message);
      } catch {
        if (!quiet) show("Une erreur est survenue. Réessayez.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function makeDraft(m: AdminMessage) {
    setBusyId(m.id);
    startTransition(async () => {
      try {
        const res = await draftReplyAction(m.id);
        if (res.ok) setDrafts((d) => ({ ...d, [m.id]: res.draft }));
        else show(res.message);
      } catch {
        show("Une erreur est survenue. Réessayez.");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <DemoBanner connected={connected} />
      <div className="flex flex-col gap-2">
        {rows.length === 0 ? <EmptyBox>Aucun message.</EmptyBox> : null}
        {rows.map((m) => {
          const done = doneOverride[m.id] ?? m.done;
          const draft = drafts[m.id];
          const mail = validEmail(m.contact);
          const link = replyLink(m.contact, shopName, draft?.text ?? null);
          const busy = pending && busyId === m.id;
          return (
            <article key={m.id} className="bg-white border border-[#E2DCCF] rounded-2xl px-4 py-3.5 flex flex-col gap-2" style={{ opacity: done ? 0.75 : 1 }} aria-busy={busy}>
              <div className="flex items-center gap-x-3 gap-y-2 flex-wrap text-[13px]">
                {m.subject ? <span className="bg-cream rounded-full px-2.5 py-[3px] font-semibold">{m.subject}</span> : null}
                <strong className="text-[14px]">{m.name}</strong>
                <span className="text-text break-all">{m.contact}</span>
                {m.orderNumber ? (
                  <Link href={`/admin/commandes?q=${encodeURIComponent(m.orderNumber)}`} className="text-text">
                    · {m.orderNumber}
                  </Link>
                ) : null}
                <span className="text-text">{fmtDateShort(m.createdAt)}</span>
                <span
                  className="ml-auto rounded-full px-2.5 py-[3px] text-[12px] font-semibold"
                  style={{ background: done ? "#E5EFE7" : "#FFF4D6", color: done ? "#1F6B4A" : "#8A5A00" }}
                >
                  {done ? "Traité" : "À traiter"}
                </span>
              </div>
              <p className="m-0 text-[14px] leading-normal whitespace-pre-line break-words">{m.body}</p>
              {draft ? (
                <div className="bg-[#FAF8F3] border border-[#E2DCCF] rounded-[14px] p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-[12px] font-semibold text-text">
                    <span
                      aria-hidden="true"
                      className="w-[22px] h-[22px] flex-none rounded-full bg-sun text-ink inline-flex items-center justify-center font-display font-bold text-[11px]"
                    >
                      w
                    </span>
                    Réponse proposée
                    <span className="ml-auto font-normal">{draft.mode}</span>
                  </div>
                  <textarea
                    value={draft.text}
                    onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: { ...draft, text: e.target.value.slice(0, 3000) } }))}
                    rows={5}
                    aria-label="Brouillon de réponse"
                    className="border border-[#E2DCCF] bg-white rounded-[12px] px-3 py-2.5 text-[14px] leading-normal resize-y"
                  />
                  <div className="flex gap-1.5 flex-wrap items-center text-[12px] text-text">
                    Sources :
                    {draft.sources.map((s, i) => (
                      <span key={`${s.title}-${i}`} className="bg-white border border-[#E2DCCF] rounded-full px-[9px] py-0.5">
                        {s.title}
                      </span>
                    ))}
                    {draft.sources.length === 0 ? <span>aucune fiche trouvée, vérifiez la réponse</span> : null}
                  </div>
                </div>
              ) : null}
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => makeDraft(m)}
                  className="border-0 bg-sun text-ink rounded-full px-3.5 min-h-[44px] cursor-pointer text-[13px] font-semibold hover:bg-sun-hover disabled:opacity-60"
                >
                  {busy && !draft ? "Rédaction…" : draft ? "Régénérer" : "Préparer une réponse"}
                </button>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    if (draft?.text && !done) toggleDone(m, true, true);
                  }}
                  className="no-underline bg-ink text-cream rounded-full px-3.5 min-h-[44px] flex items-center text-[13px] font-semibold hover:bg-[#2C2823] hover:text-cream"
                >
                  {draft?.text ? (mail ? "Envoyer par e-mail" : "Envoyer sur WhatsApp") : mail ? "Répondre par e-mail" : "Répondre sur WhatsApp"}
                </a>
                <button type="button" disabled={busy} onClick={() => toggleDone(m, !done)} className={`${btnLine} px-3.5 min-h-[44px] text-[13px]`}>
                  {done ? "Marquer à traiter" : "Marquer traité"}
                </button>
              </div>
            </article>
          );
        })}
        {truncated ? <p className="text-[13px] text-text m-0">Les 200 messages les plus récents sont affichés.</p> : null}
      </div>
      {node}
    </div>
  );
}
