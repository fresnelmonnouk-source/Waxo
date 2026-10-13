"use client";

import { useEffect, useRef } from "react";
import { KB_TAGS } from "@/lib/settings/kb-search";
import { hasTbc, type KbSource } from "@/lib/admin/ai/kb-types";
import { btnDark, btnLine, fieldSmCls } from "../settings/ui";

export type EditorValue = { id?: string; tag: string; title: string; text: string; keywords: string; source: KbSource };

/** Formulaire d'une fiche (création, brouillon de l'IA ou modification). « Publier » est refusé tant qu'il reste un « [à confirmer] ». */
export function KbEditor({
  value,
  onChange,
  onSave,
  onCancel,
  error,
  busy,
  heading,
  isPublished,
}: {
  value: EditorValue;
  onChange: (v: EditorValue) => void;
  onSave: (publish: boolean) => void;
  onCancel: () => void;
  error: string;
  busy: boolean;
  heading: string;
  /** Fiche déjà en ligne : « Enregistrer » garde le statut publié. */
  isPublished: boolean;
}) {
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);
  const tbc = hasTbc(value.text) || hasTbc(value.title);
  const lbl = "flex flex-col gap-1.5 text-[13px] font-semibold";
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-[#E2DCCF] bg-[#FAF8F3] p-3.5" role="group" aria-label={heading}>
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-[14px]">{heading}</strong>
        {value.source === "ai" ? <span className="rounded-full bg-[#EDE7FB] px-2 py-px text-[11px] font-semibold text-[#4B2E9A]">Rédigée par l&apos;IA</span> : null}
      </div>
      <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,170px)]">
        <label className={lbl}>
          Titre
          <input ref={titleRef} value={value.title} maxLength={120} onChange={(e) => onChange({ ...value, title: e.target.value })} className={fieldSmCls} />
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
        <textarea value={value.text} maxLength={2000} rows={6} onChange={(e) => onChange({ ...value, text: e.target.value })} className={`${fieldSmCls} resize-y leading-normal`} />
        <span className="text-[12px] font-normal text-[#4A443C]">{value.text.trim().length.toLocaleString("fr-FR")} / 2 000 caractères</span>
      </label>
      <label className={lbl}>
        Mots-clés (facultatif)
        <input
          value={value.keywords}
          maxLength={300}
          onChange={(e) => onChange({ ...value, keywords: e.target.value })}
          placeholder="Mots que les clients emploient : parakou, délai, renvoi…"
          className={fieldSmCls}
        />
      </label>
      {tbc ? (
        <p role="note" className="m-0 rounded-xl bg-[#FBEFC9] px-3 py-2 text-[13px] leading-[1.45] text-[#4A443C]">
          Il reste au moins un « [à confirmer] » : l&apos;IA n&apos;avait pas l&apos;information. Remplacez-le par la bonne réponse avant de publier.
        </p>
      ) : null}
      {error ? (
        <span role="alert" className="text-[13px] text-[#C2410C]">
          {error}
        </span>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || tbc} onClick={() => onSave(true)} className={`${btnDark} min-h-[44px] px-4 text-[13px]`}>
          {isPublished ? "Enregistrer (en ligne)" : "Publier"}
        </button>
        {!isPublished ? (
          <button type="button" disabled={busy} onClick={() => onSave(false)} className={`${btnLine} min-h-[44px] px-4 text-[13px]`}>
            Enregistrer en brouillon
          </button>
        ) : null}
        <button type="button" onClick={onCancel} className={`${btnLine} min-h-[44px] px-3.5 text-[13px]`}>
          Annuler
        </button>
      </div>
    </div>
  );
}
