"use client";

import { useId, useState } from "react";
import { draftProductAction } from "@/app/admin/(panel)/produits/ai-actions";
import { DRAFT_FIELD_LABEL, WRITER_NOTES_MAX, type DraftField, type DraftTarget, type ProductDraft } from "@/lib/admin/ai/product-draft";
import { LINK_REMINDER, NOTES_HELP, doneStatus, runWriter, type WriterMode as Mode, type WriterRunStatus } from "./ai-writer-run";
import { FIELD_ERR, FIELD_LABEL, inputClass } from "./ui";

type Status = { kind: "idle" } | { kind: "running" } | WriterRunStatus;

/**
 * « Rédiger avec l'IA » (tiroir produit) : lien d'un site qui vend ce produit et/ou notes de l'admin → proposition qui
 * REMPLIT le formulaire, sans rien enregistrer. Si des champs sont déjà remplis, l'admin choisit : remplacer, ou ne
 * remplir que les champs vides (jamais d'écrasement silencieux).
 */
export function AiWriterPanel({
  ready,
  rayon,
  getCurrent,
  onApply,
}: {
  /** Clé DeepSeek configurée sur le serveur. */
  ready: boolean;
  /** Libellé du rayon sélectionné dans le formulaire. */
  rayon: string;
  /** Valeurs COURANTES du formulaire, lues après la réponse (pour détecter un écrasement : audit Victor W1). */
  getCurrent: () => DraftTarget;
  /** Applique la proposition au formulaire ; renvoie les champs effectivement remplis. */
  onApply: (draft: ProductDraft, mode: Mode) => DraftField[];
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [urlError, setUrlError] = useState("");

  const running = status.kind === "running";
  const canRun = ready && !running && (url.trim() !== "" || notes.trim().length >= 3);

  const apply = (draft: ProductDraft, mode: Mode) => setStatus(doneStatus(draft, onApply(draft, mode)));

  const run = async () => {
    const link = url.trim();
    if (link && !/^https:\/\/\S+$/i.test(link)) {
      setUrlError("Le lien doit commencer par https://");
      return;
    }
    setUrlError("");
    setStatus({ kind: "running" });
    setStatus(await runWriter(() => draftProductAction({ url: link, notes: notes.trim(), rayon }), getCurrent, onApply));
  };

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!ready}
          aria-describedby={ready ? undefined : `${id}-off`}
          className="min-h-11 cursor-pointer rounded-full border border-[#D6CFC0] bg-white px-4 text-[13px] font-semibold hover:bg-[#F4F1EA] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Rédiger avec l&apos;IA
        </button>
        {!ready && (
          <span id={`${id}-off`} className="text-xs text-[#4A443C]">
            L&apos;IA n&apos;est pas configurée (clé DEEPSEEK_API_KEY absente) : remplissez la fiche à la main.
          </span>
        )}
      </div>
    );
  }

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3 rounded-[14px] border border-[#E2DCCF] bg-white p-3.5">
      <div className="flex flex-col gap-1">
        <strong id={`${id}-title`} className="text-sm font-semibold">
          Rédiger avec l&apos;IA
        </strong>
        <span className="text-xs leading-[1.45] text-[#4A443C]">
          Donnez le lien d&apos;un site qui vend ce produit, vos notes, ou les deux. L&apos;IA remplit le formulaire sans rien enregistrer et
          marque « [à confirmer] » ce qu&apos;elle ne sait pas. Vos notes priment sur le lien.
        </span>
        <span className="rounded-[10px] bg-[#FBF1D9] px-3 py-2 text-xs leading-[1.45] text-[#141210]">{LINK_REMINDER}</span>
      </div>

      <label className={FIELD_LABEL}>
        Lien d&apos;un site qui vend ce produit (facultatif)
        <input
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setUrlError("");
          }}
          maxLength={2000}
          placeholder="https://…"
          autoComplete="off"
          spellCheck={false}
          className={inputClass(urlError)}
        />
        <span className={FIELD_ERR}>{urlError}</span>
      </label>

      <label className={FIELD_LABEL}>
        Vos notes (facultatif)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={WRITER_NOTES_MAX}
          placeholder="Ex. Gourde inox 750 ml, noire, bouchon en bambou, 26 cm de haut."
          className={`${inputClass()} resize-y leading-normal`}
        />
        <span className="text-xs font-normal text-[#4A443C]">{NOTES_HELP}</span>
      </label>

      {status.kind === "confirm" && (
        <div className="flex flex-col gap-2.5 rounded-[12px] bg-[#FBEFC9] p-3">
          <span className="text-[13px] leading-[1.45] text-[#141210]">
            Ces champs sont déjà remplis : {status.conflicts.map(DRAFT_FIELD_LABEL).join(", ")}. Que faire de la proposition ?
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => apply(status.draft, "fill-empty")}
              className="min-h-11 cursor-pointer rounded-full border-0 bg-[#141210] px-4 text-[13px] font-semibold text-[#F4F1EA] hover:bg-[#2C2823]"
            >
              Remplir seulement les champs vides
            </button>
            <button
              type="button"
              onClick={() => apply(status.draft, "replace")}
              className="min-h-11 cursor-pointer rounded-full border border-[#D6CFC0] bg-white px-4 text-[13px]"
            >
              Tout remplacer
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={run}
          disabled={!canRun}
          className="min-h-11 cursor-pointer rounded-full border-0 bg-[#141210] px-4 text-[13px] font-semibold text-[#F4F1EA] hover:bg-[#2C2823] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? "Rédaction…" : status.kind === "done" ? "Rédiger à nouveau" : "Rédiger"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={running}
          className="min-h-11 cursor-pointer rounded-full border border-[#D6CFC0] bg-transparent px-4 text-[13px] disabled:opacity-60"
        >
          Fermer
        </button>
      </div>

      <span aria-live="polite" className="text-[13px] leading-[1.45] text-[#4A443C]">
        {running
          ? "Rédaction… (10 à 30 secondes)"
          : status.kind === "done"
            ? status.filled
              ? `${status.filled} champ${status.filled > 1 ? "s" : ""} rempli${status.filled > 1 ? "s" : ""}${status.fromLink ? `, dont ${status.fromLink} à vérifier (lien lu)` : ""}${status.warned ? `, ${status.warned} avec un avertissement sous le champ` : ""}. Relisez avant d'enregistrer : rien n'est enregistré tant que vous ne cliquez pas sur « Enregistrer ».`
              : "Aucun champ vide à remplir : vos textes sont gardés."
            : ""}
      </span>

      {status.kind === "error" && (
        <p role="alert" className="m-0 rounded-[12px] bg-[#F6E1DA] px-3 py-2 text-[13px] leading-[1.45] text-[#9A3412]">
          {status.message}
        </p>
      )}
    </section>
  );
}
