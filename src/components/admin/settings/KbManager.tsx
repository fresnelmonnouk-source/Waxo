"use client";

import { useMemo, useState, useTransition } from "react";
import { deleteKbEntryAction, saveKbEntryAction } from "@/app/admin/(panel)/reglages/actions";
import { KB_TAGS, retrieve, snippet, type KbDoc, type KbEntry } from "@/lib/settings/kb-search";
import { plural } from "@/lib/settings/format";
import { btnDark, btnLine, btnLink, cardCls, fieldSmCls, useToast } from "./ui";

type Draft = { id?: string; title: string; tag: string; text: string; keywords: string };
const EMPTY: Draft = { title: "", tag: "Livraison", text: "", keywords: "" };

function EntryForm({
  value,
  onChange,
  onSave,
  onCancel,
  error,
  busy,
}: {
  value: Draft;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  error: string;
  busy: boolean;
}) {
  const lbl = "flex flex-col gap-1.5 text-[13px] font-semibold";
  return (
    <div className="bg-[#FAF8F3] rounded-2xl p-3.5 flex flex-col gap-2.5">
      <div className="grid gap-2.5" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,160px)" }}>
        <label className={lbl}>
          Titre
          <input value={value.title} maxLength={120} onChange={(e) => onChange({ ...value, title: e.target.value })} className={fieldSmCls} />
        </label>
        <label className={lbl}>
          Thème
          <select value={value.tag} onChange={(e) => onChange({ ...value, tag: e.target.value })} className={`${fieldSmCls} min-h-[44px]`}>
            {KB_TAGS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={lbl}>
        Contenu
        <textarea
          value={value.text}
          maxLength={2000}
          rows={4}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
          className={`${fieldSmCls} leading-normal resize-y`}
        />
      </label>
      <label className={lbl}>
        Mots-clés (facultatif)
        <input
          value={value.keywords}
          maxLength={300}
          onChange={(e) => onChange({ ...value, keywords: e.target.value })}
          placeholder="Synonymes que les clients emploient : parakou, délai, quand…"
          className={fieldSmCls}
        />
      </label>
      {error ? (
        <span role="alert" className="text-[#C2410C] text-[13px]">
          {error}
        </span>
      ) : null}
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={onSave} className={`${btnDark} px-4 min-h-[44px] text-[13px]`}>
          Enregistrer la fiche
        </button>
        <button type="button" onClick={onCancel} className={`${btnLine} px-3.5 min-h-[44px] text-[13px]`}>
          Annuler
        </button>
      </div>
    </div>
  );
}

export function KbManager({ initial, productDocs, connected }: { initial: KbEntry[]; productDocs: KbDoc[]; connected: boolean }) {
  const { show, node } = useToast();
  const [pending, startTransition] = useTransition();
  const [entries, setEntries] = useState<KbEntry[]>(initial);
  const [editing, setEditing] = useState<string | null>(null); // id de la fiche, "new", ou null
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState("");
  const [test, setTest] = useState("");

  const docs = useMemo<KbDoc[]>(() => [...entries.map((e) => ({ ...e, kind: "kb" as const })), ...productDocs], [entries, productDocs]);
  const hits = useMemo(() => (test.trim().length >= 3 ? retrieve(test, docs, 5) : []), [test, docs]);
  const hmax = Math.max(0.01, ...hits.map((h) => h.score));

  function open(e: KbEntry | null) {
    setEditing(e ? e.id : "new");
    setDraft(e ? { id: e.id, title: e.title, tag: e.tag, text: e.text, keywords: e.keywords } : EMPTY);
    setError("");
  }

  function save() {
    if (draft.title.trim().length < 3) return setError("Titre trop court.");
    if (draft.text.trim().length < 20) return setError("Contenu trop court (20 caractères minimum).");
    startTransition(async () => {
      try {
        const res = await saveKbEntryAction({ id: draft.id, title: draft.title, tag: draft.tag, text: draft.text, keywords: draft.keywords });
        if (res.ok) {
          setEntries((list) => (draft.id ? list.map((x) => (x.id === res.entry.id ? res.entry : x)) : [res.entry, ...list]));
          setEditing(null);
          setError("");
          show("Fiche enregistrée. Les assistants l'utilisent dès maintenant.");
        } else setError(res.message);
      } catch {
        setError("Une erreur est survenue. Réessayez.");
      }
    });
  }

  function remove(e: KbEntry) {
    if (!window.confirm(`Supprimer la fiche « ${e.title} » ?`)) return;
    startTransition(async () => {
      try {
        const res = await deleteKbEntryAction(e.id);
        if (res.ok) {
          setEntries((list) => list.filter((x) => x.id !== e.id));
          show("Fiche supprimée.");
        } else show(res.message);
      } catch {
        show("Une erreur est survenue. Réessayez.");
      }
    });
  }

  return (
    <section className={`${cardCls} gap-3.5`} aria-labelledby="kb-title">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div className="flex flex-col gap-1 max-w-[640px]">
          <h2 id="kb-title" className="m-0 text-[17px]">
            Base de connaissances
          </h2>
          <span className="text-[13px] text-text leading-normal">
            L&apos;assistant de la boutique et les brouillons de réponse cherchent ici les passages utiles avant de répondre. Les fiches produits sont indexées automatiquement.{" "}
            {plural(entries.length, "fiche rédigée", "fiches rédigées")}, {plural(productDocs.length, "fiche produit", "fiches produits")}.
          </span>
        </div>
        <button type="button" onClick={() => open(null)} className={`${btnDark} px-4 min-h-[44px] text-[13px]`}>
          + Ajouter une fiche
        </button>
      </div>
      {!connected ? (
        <div role="note" className="bg-[#FFF4D6] text-[#8A5A00] rounded-2xl px-4 py-3 text-[13px]">
          Base non connectée (mode démo) : les fiches ci-dessous sont des exemples, les modifications ne sont pas enregistrées.
        </div>
      ) : null}

      <div className="bg-[#FAF8F3] rounded-2xl p-3.5 flex flex-col gap-2.5">
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          Tester une question
          <input type="search" value={test} onChange={(e) => setTest(e.target.value)} placeholder="Ex. Livrez-vous à Parakou ?" maxLength={200} className={`${fieldSmCls} bg-white`} />
        </label>
        {test.trim().length >= 3 && hits.length === 0 ? (
          <span className="text-[13px] text-text">Aucun passage trouvé : l&apos;assistant dira qu&apos;il doit vérifier. Ajoutez une fiche pour couvrir cette question.</span>
        ) : null}
        {hits.map((h) => (
          <div key={h.id} className="flex gap-2.5 items-center text-[13px] flex-wrap">
            <span className="w-[72px] h-1.5 flex-none rounded-full bg-[#E2DCCF] overflow-hidden" aria-hidden="true">
              <span className="block h-full bg-leaf" style={{ width: `${Math.round((h.score / hmax) * 100)}%` }} />
            </span>
            <strong>{h.title}</strong>
            <span className="bg-white border border-[#E2DCCF] rounded-full px-2 py-px text-[11px]">{h.tag}</span>
            <span className="text-muted flex-[1_1_200px] min-w-0">{snippet(h.text)}</span>
          </div>
        ))}
      </div>

      {editing === "new" ? <EntryForm value={draft} onChange={setDraft} onSave={save} onCancel={() => setEditing(null)} error={error} busy={pending} /> : null}

      {entries.map((k) => (
        <div key={k.id} className="border-t border-[#F0EBE1] pt-3">
          {editing === k.id ? (
            <EntryForm value={draft} onChange={setDraft} onSave={save} onCancel={() => setEditing(null)} error={error} busy={pending} />
          ) : (
            <div className="flex gap-3 items-start flex-wrap">
              <span className="bg-cream rounded-full px-2.5 py-[3px] text-[12px] font-semibold min-w-[72px] text-center">{k.tag}</span>
              <div className="flex-[1_1_260px] min-w-0 flex flex-col gap-1">
                <strong className="text-[14px]">{k.title}</strong>
                <span className="text-[13px] text-text leading-normal">{k.text}</span>
              </div>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => open(k)} className={`${btnLine} px-3 min-h-[44px] text-[12px]`}>
                  Modifier
                </button>
                <button type="button" disabled={pending} onClick={() => remove(k)} className={`${btnLink} text-[12px] min-h-[44px] px-2`}>
                  Supprimer
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      {node}
    </section>
  );
}
