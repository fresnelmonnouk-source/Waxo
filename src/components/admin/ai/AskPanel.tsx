"use client";

import { useState } from "react";
import { btnDark, cardCls, fieldSmCls } from "../settings/ui";

const EXAMPLES = [
  "Rédige une fiche sur les retours hors Cotonou",
  "Une fiche sur le paiement à la livraison",
  "Que se passe-t-il si je commande après l'heure limite ?",
];

/** « Demandez à l'IA » : une demande libre → un brouillon de fiche, ouvert dans l'éditeur avant tout enregistrement. */
export function AskPanel({ llmReady, running, error, onAsk }: { llmReady: boolean; running: boolean; error: string; onAsk: (request: string) => void }) {
  const [request, setRequest] = useState("");
  const ok = request.trim().length >= 8;
  return (
    <section className={`${cardCls} gap-3`} aria-labelledby="ai-ask-title">
      <div className="flex max-w-[680px] flex-col gap-1">
        <h2 id="ai-ask-title" className="m-0 text-[17px] font-bold">
          Demandez à l&apos;IA
        </h2>
        <span className="text-[13px] leading-normal text-[#4A443C]">
          Décrivez la fiche voulue : l&apos;IA la rédige avec les seuls faits du site et marque « [à confirmer] » ce qu&apos;elle ne sait pas. Vous la relisez avant de l&apos;enregistrer. N&apos;y collez pas de données de client.
        </span>
      </div>
      <form
        className="flex flex-col gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok && !running) onAsk(request.trim());
        }}
      >
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          Votre demande
          <textarea value={request} onChange={(e) => setRequest(e.target.value)} rows={3} maxLength={600} placeholder="Ex. Rédige une fiche sur les retours hors Cotonou" className={`${fieldSmCls} resize-y leading-normal`} />
        </label>
        <div className="flex flex-wrap gap-1.5" aria-label="Exemples">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => setRequest(ex)} className="min-h-[36px] cursor-pointer rounded-full border border-[#D6CFC0] bg-transparent px-3 text-[12px] hover:bg-cream">
              {ex}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={!llmReady || running || !ok} className={`${btnDark} min-h-[44px] px-4 text-[13px]`}>
            {running ? "Rédaction en cours…" : "Rédiger la fiche"}
          </button>
          <span aria-live="polite" className="text-[13px] text-[#4A443C]">
            {running ? "Environ 10 à 20 secondes." : ""}
          </span>
        </div>
        {error ? (
          <p role="alert" className="m-0 rounded-xl bg-[#F6E1DA] px-3 py-2 text-[13px] leading-[1.45] text-[#9A3412]">
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
