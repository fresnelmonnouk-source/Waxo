"use client";

import { useMemo, useState, type ReactNode } from "react";
import { retrieve, snippet, type KbDoc } from "@/lib/settings/kb-search";
import { fmtDateShort, plural } from "@/lib/settings/format";
import { ASSISTANT_KB_TTL_MIN, KB_STATE_LABEL, kbStateOf, type AdminKbRow, type KbState } from "@/lib/admin/ai/kb-types";
import { btnDark, btnLine, btnLink, cardCls, fieldSmCls, FilterChip } from "../settings/ui";

const PILL: Record<KbState, { background: string; color: string }> = {
  published: { background: "#E5EFE7", color: "#1F6B4A" },
  draft: { background: "#FFC93C", color: "#141210" },
  disabled: { background: "#E2DCCF", color: "#4A443C" },
};

type Filter = "all" | KbState;

export function KbList({
  rows,
  productDocs,
  busy,
  canWrite,
  editor,
  editingId,
  onNew,
  onEdit,
  onState,
  onDelete,
}: {
  rows: AdminKbRow[];
  productDocs: KbDoc[];
  busy: boolean;
  canWrite: boolean;
  /** Formulaire ouvert (nouvelle fiche ou fiche `editingId`). */
  editor: ReactNode;
  editingId: string | null;
  onNew: () => void;
  onEdit: (row: AdminKbRow) => void;
  onState: (row: AdminKbRow, state: KbState) => void;
  onDelete: (row: AdminKbRow) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [test, setTest] = useState("");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: rows.length, published: 0, draft: 0, disabled: 0 };
    for (const r of rows) c[kbStateOf(r)]++;
    return c;
  }, [rows]);
  const shown = filter === "all" ? rows : rows.filter((r) => kbStateOf(r) === filter);

  // Le test ne cherche que dans ce que l'assistant voit vraiment : fiches publiées actives + fiches produits.
  const liveDocs = useMemo<KbDoc[]>(
    () => [...rows.filter((r) => kbStateOf(r) === "published").map((r) => ({ id: r.id, tag: r.tag, title: r.title, text: r.text, keywords: r.keywords, kind: "kb" as const })), ...productDocs],
    [rows, productDocs],
  );
  const hits = useMemo(() => (test.trim().length >= 3 ? retrieve(test, liveDocs, 5) : []), [test, liveDocs]);
  const hmax = Math.max(0.01, ...hits.map((h) => h.score));

  return (
    <section className={`${cardCls} gap-3.5`} aria-labelledby="kb-list-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-[680px] flex-col gap-1">
          <h2 id="kb-list-title" className="m-0 text-[17px] font-bold">
            Base de connaissances
          </h2>
          <span className="text-[13px] leading-normal text-[#4A443C]">
            Seules les fiches <strong>publiées</strong> servent à l&apos;assistant du site et aux brouillons de réponse des Discussions. Un brouillon reste invisible tant que vous ne cliquez pas sur « Publier ». L&apos;assistant du site prend en compte un changement sous {ASSISTANT_KB_TTL_MIN} minutes. Les fiches produits sont indexées automatiquement ({plural(productDocs.length, "fiche", "fiches")}).
          </span>
        </div>
        {canWrite ? (
          <button type="button" onClick={onNew} className={`${btnDark} min-h-[44px] px-4 text-[13px]`}>
            + Nouvelle fiche
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer les fiches">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="Toutes" count={counts.all} />
        <FilterChip active={filter === "published"} onClick={() => setFilter("published")} label="Publiées" count={counts.published} />
        <FilterChip active={filter === "draft"} onClick={() => setFilter("draft")} label="Brouillons" count={counts.draft} />
        <FilterChip active={filter === "disabled"} onClick={() => setFilter("disabled")} label="Désactivées" count={counts.disabled} />
      </div>

      <div className="flex flex-col gap-2.5 rounded-2xl bg-[#FAF8F3] p-3.5">
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          Tester une question (fiches publiées seulement)
          <input type="search" value={test} onChange={(e) => setTest(e.target.value)} placeholder="Ex. Puis-je retourner un article à Parakou ?" maxLength={200} className={`${fieldSmCls} bg-white`} />
        </label>
        {test.trim().length >= 3 && hits.length === 0 ? (
          <span className="text-[13px] text-[#4A443C]">Aucun passage trouvé : l&apos;assistant dira qu&apos;il doit vérifier. Demandez une fiche à l&apos;IA ci-dessus pour couvrir cette question.</span>
        ) : null}
        {hits.map((h) => (
          <div key={h.id} className="flex flex-wrap items-center gap-2.5 text-[13px]">
            <span className="h-1.5 w-[72px] flex-none overflow-hidden rounded-full bg-[#E2DCCF]" aria-hidden="true">
              <span className="block h-full bg-leaf" style={{ width: `${Math.round((h.score / hmax) * 100)}%` }} />
            </span>
            <strong>{h.title}</strong>
            <span className="rounded-full border border-[#E2DCCF] bg-white px-2 py-px text-[11px]">{h.tag}</span>
            <span className="min-w-0 flex-[1_1_200px] text-[#4A443C]">{snippet(h.text)}</span>
          </div>
        ))}
      </div>

      {editingId === null ? editor : null}

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D6CFC0] p-6 text-[14px] text-[#4A443C]">
          {rows.length === 0 ? "Aucune fiche pour le moment. Lancez une analyse ou demandez une fiche à l'IA." : "Aucune fiche dans ce filtre."}
        </div>
      ) : null}

      {shown.map((k) => {
        const state = kbStateOf(k);
        return (
          <div key={k.id} className="border-t border-[#F0EBE1] pt-3">
            {editingId === k.id ? (
              editor
            ) : (
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex min-w-[96px] flex-col items-start gap-1.5">
                  <span className="rounded-full px-2.5 py-[3px] text-[12px] font-semibold" style={PILL[state]}>
                    {KB_STATE_LABEL[state]}
                  </span>
                  <span className="rounded-full bg-cream px-2.5 py-[3px] text-[12px] font-semibold">{k.tag}</span>
                </div>
                <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
                  <strong className="text-[14px]">{k.title}</strong>
                  <span className="whitespace-pre-line text-[13px] leading-normal text-[#2C2823]">{k.text}</span>
                  <span className="text-[12px] text-[#4A443C]">
                    {k.source === "ai" ? "Rédigée par l'IA" : "Rédigée à la main"}
                    {k.updatedAt ? ` · modifiée le ${fmtDateShort(k.updatedAt)}` : ""}
                  </span>
                </div>
                {canWrite ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {state !== "published" ? (
                      <button type="button" disabled={busy} onClick={() => onState(k, "published")} className={`${btnDark} min-h-[44px] px-3.5 text-[12px]`}>
                        Publier
                      </button>
                    ) : null}
                    <button type="button" disabled={busy} onClick={() => onEdit(k)} className={`${btnLine} min-h-[44px] px-3 text-[12px]`}>
                      Modifier
                    </button>
                    {state !== "draft" ? (
                      <button type="button" disabled={busy} onClick={() => onState(k, "draft")} className={`${btnLine} min-h-[44px] px-3 text-[12px]`}>
                        Repasser en brouillon
                      </button>
                    ) : null}
                    {state === "published" ? (
                      <button type="button" disabled={busy} onClick={() => onState(k, "disabled")} className={`${btnLine} min-h-[44px] px-3 text-[12px]`}>
                        Désactiver
                      </button>
                    ) : null}
                    {confirmId === k.id ? (
                      <span className="flex items-center gap-1.5 text-[12px]">
                        Supprimer définitivement ?
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setConfirmId(null);
                            onDelete(k);
                          }}
                          className={`${btnDark} min-h-[44px] px-3 text-[12px]`}
                          style={{ background: "#9A3412" }}
                        >
                          Oui, supprimer
                        </button>
                        <button type="button" onClick={() => setConfirmId(null)} className={`${btnLink} min-h-[44px] px-2 text-[12px]`}>
                          Non
                        </button>
                      </span>
                    ) : (
                      <button type="button" disabled={busy} onClick={() => setConfirmId(k.id)} className={`${btnLink} min-h-[44px] px-2 text-[12px]`}>
                        Supprimer
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
