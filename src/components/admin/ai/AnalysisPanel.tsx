"use client";

import { useEffect, useState } from "react";
import type { AiMeta } from "@/lib/admin/ai/analyze";
import type { Analysis, KbDraft, Severity } from "@/lib/admin/ai/schema";
import { btnDark, btnLine, cardCls } from "../settings/ui";

export const SEVERITY_UI: Record<Severity, { label: string; background: string; color: string; border: string }> = {
  critique: { label: "Critique", background: "#F6E1DA", color: "#9A3412", border: "#E8B4A3" },
  important: { label: "Important", background: "#FBEFC9", color: "#6B4700", border: "#EBD58E" },
  conseil: { label: "Conseil", background: "#E5EFE7", color: "#1F6B4A", border: "#B9D3C0" },
};

/** Compteur de secondes pendant l'analyse (l'IA met 20 à 45 s). */
function useElapsed(running: boolean): number {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t0 = Date.now();
    const id = setInterval(() => setS(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => {
      clearInterval(id);
      setS(0);
    };
  }, [running]);
  return s;
}

export function AnalysisPanel({
  llmReady,
  running,
  error,
  result,
  created,
  canWrite,
  busy,
  onAnalyze,
  onCreateDraft,
  onEditDraft,
}: {
  llmReady: boolean;
  running: boolean;
  error: string;
  result: { analysis: Analysis; meta: AiMeta } | null;
  /** Index des fiches proposées déjà créées en brouillon. */
  created: Set<number>;
  canWrite: boolean;
  busy: boolean;
  onAnalyze: () => void;
  onCreateDraft: (draft: KbDraft, index: number) => void;
  onEditDraft: (draft: KbDraft, index: number) => void;
}) {
  const elapsed = useElapsed(running);
  const a = result?.analysis;
  const counts = a ? { critique: a.issues.filter((i) => i.severity === "critique").length, important: a.issues.filter((i) => i.severity === "important").length, conseil: a.issues.filter((i) => i.severity === "conseil").length } : null;

  return (
    <section className={`${cardCls} gap-4`} aria-labelledby="ai-analyze-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-[680px] flex-col gap-1">
          <h2 id="ai-analyze-title" className="m-0 text-[17px] font-bold">
            Analyse du site
          </h2>
          <span className="text-[13px] leading-normal text-[#4A443C]">
            L&apos;IA relit vos réglages, vos pages d&apos;infos, la FAQ, les textes de l&apos;accueil, les produits, les campagnes et la base de connaissances. Elle signale les incohérences et les sujets oubliés, et propose des fiches. Aucune donnée de client n&apos;est envoyée : ni nom, ni téléphone, ni e-mail, ni message. 10 analyses par heure au plus.
          </span>
        </div>
        <button type="button" disabled={!llmReady || running} onClick={onAnalyze} className={`${btnDark} min-h-[46px] px-5 text-[14px]`}>
          {running ? `Analyse en cours… ${elapsed} s` : result ? "Relancer l'analyse" : "Analyser le site"}
        </button>
      </div>

      <div aria-live="polite" className="flex flex-col gap-2">
        {running ? <p className="m-0 text-[13px] text-[#4A443C]">Comptez 20 à 45 secondes. Vous pouvez rester sur la page, le résultat s&apos;affichera ici.</p> : null}
        {error ? (
          <p role="alert" className="m-0 rounded-xl bg-[#F6E1DA] px-3 py-2 text-[13px] leading-[1.45] text-[#9A3412]">
            {error}
          </p>
        ) : null}
      </div>

      {a && counts && result ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2 text-[13px]">
            {(["critique", "important", "conseil"] as const).map((s) => (
              <span key={s} className="rounded-full px-3 py-1 font-semibold" style={{ background: SEVERITY_UI[s].background, color: SEVERITY_UI[s].color }}>
                {counts[s]} {SEVERITY_UI[s].label.toLowerCase()}
                {counts[s] > 1 ? "s" : ""}
              </span>
            ))}
            <span className="rounded-full bg-[#F4F1EA] px-3 py-1">
              {a.missingTopics.length} sujet{a.missingTopics.length > 1 ? "s" : ""} manquant{a.missingTopics.length > 1 ? "s" : ""}
            </span>
            <span className="rounded-full bg-[#F4F1EA] px-3 py-1">
              {a.kbDrafts.length} fiche{a.kbDrafts.length > 1 ? "s" : ""} proposée{a.kbDrafts.length > 1 ? "s" : ""}
            </span>
          </div>
          {!result.meta.complete || result.meta.dropped > 0 ? (
            <p role="note" className="m-0 rounded-xl bg-[#FBEFC9] px-3 py-2 text-[13px] leading-[1.45] text-[#4A443C]">
              Réponse de l&apos;IA incomplète : tout ce qui était lisible est affiché ci-dessous
              {result.meta.dropped > 0 ? ` (${result.meta.dropped} élément${result.meta.dropped > 1 ? "s" : ""} écarté${result.meta.dropped > 1 ? "s" : ""})` : ""}. Relancez l&apos;analyse pour la suite.
            </p>
          ) : null}
          {result.meta.corpusTruncated ? (
            <p className="m-0 text-[12px] text-[#4A443C]">Le site est volumineux : certains textes longs ont été raccourcis avant l&apos;analyse.</p>
          ) : null}

          <div className="flex flex-col gap-2.5">
            <h3 className="m-0 text-[15px] font-bold">Points à corriger</h3>
            {a.issues.length === 0 ? <p className="m-0 text-[13px] text-[#4A443C]">Aucun problème relevé.</p> : null}
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {a.issues.map((it, i) => {
                const ui = SEVERITY_UI[it.severity];
                return (
                  <li key={i} className="flex flex-col gap-1.5 rounded-2xl border-[1.5px] bg-white p-3.5" style={{ borderColor: ui.border }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full px-2.5 py-[3px] text-[12px] font-bold" style={{ background: ui.background, color: ui.color }}>
                        {ui.label}
                      </span>
                      <span className="text-[13px] font-semibold text-[#2C2823]">{it.where}</span>
                    </div>
                    <p className="m-0 text-[14px] leading-normal">{it.problem}</p>
                    {it.suggestion ? (
                      <p className="m-0 text-[13px] leading-normal text-[#4A443C]">
                        <strong>À faire : </strong>
                        {it.suggestion}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          {a.missingTopics.length ? (
            <div className="flex flex-col gap-2">
              <h3 className="m-0 text-[15px] font-bold">Sujets que personne ne couvre</h3>
              <ul className="m-0 flex flex-col gap-1.5 pl-5 text-[14px] leading-normal">
                {a.missingTopics.map((t, i) => (
                  <li key={i}>
                    <strong>{t.topic}</strong>
                    {t.why ? <span className="text-[#4A443C]"> : {t.why}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {a.kbDrafts.length ? (
            <div className="flex flex-col gap-2.5">
              <h3 className="m-0 text-[15px] font-bold">Fiches proposées</h3>
              <p className="m-0 text-[13px] text-[#4A443C]">Une fiche créée ici reste un brouillon invisible des clients jusqu&apos;à ce que vous la publiiez dans la base de connaissances.</p>
              <div className="grid gap-2.5 md:grid-cols-2">
                {a.kbDrafts.map((d, i) => (
                  <article key={i} className="flex flex-col gap-2 rounded-2xl bg-[#FAF8F3] p-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-2.5 py-[3px] text-[12px] font-semibold">{d.tag}</span>
                      <strong className="text-[14px]">{d.title}</strong>
                    </div>
                    <p className="m-0 whitespace-pre-line text-[13px] leading-normal">{d.text}</p>
                    {d.keywords ? <p className="m-0 text-[12px] text-[#4A443C]">Mots-clés : {d.keywords}</p> : null}
                    {canWrite ? (
                      <div className="mt-auto flex flex-wrap gap-2">
                        {created.has(i) ? (
                          <span className="inline-flex min-h-[44px] items-center text-[13px] font-semibold text-[#1F6B4A]">Brouillon créé</span>
                        ) : (
                          <>
                            <button type="button" disabled={busy} onClick={() => onCreateDraft(d, i)} className={`${btnDark} min-h-[44px] px-4 text-[13px]`}>
                              Créer en brouillon
                            </button>
                            <button type="button" disabled={busy} onClick={() => onEditDraft(d, i)} className={`${btnLine} min-h-[44px] px-3.5 text-[13px]`}>
                              Modifier d&apos;abord
                            </button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
