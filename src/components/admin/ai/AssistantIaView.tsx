"use client";

import { useState, useTransition, type ReactNode } from "react";
import { analyzeSiteAction, deleteKbAction, draftKbAction, saveKbAction, setKbStateAction } from "@/app/admin/(panel)/assistant-ia/actions";
import type { AiMeta } from "@/lib/admin/ai/analyze";
import { ASSISTANT_KB_TTL_MIN, kbStateOf, type AdminKbRow, type KbListData, type KbState } from "@/lib/admin/ai/kb-types";
import type { Analysis, KbDraft } from "@/lib/admin/ai/schema";
import type { KbDoc } from "@/lib/settings/kb-search";
import { useToast } from "../settings/ui";
import { AnalysisPanel } from "./AnalysisPanel";
import { AskPanel } from "./AskPanel";
import { KbEditor, type EditorValue } from "./KbEditor";
import { KbList } from "./KbList";

type EditorState = { value: EditorValue; id: string | null; isPublished: boolean; fromAnalysis: number | null; heading: string; nonce?: number };

const EMPTY: EditorValue = { tag: "Livraison", title: "", text: "", keywords: "", source: "manual" };
const NETWORK = "Une erreur est survenue. Réessayez.";

function Banner({ tone, children }: { tone: "info" | "warn" | "error"; children: ReactNode }) {
  const style = tone === "error" ? "bg-[#F6E1DA] text-[#9A3412]" : tone === "warn" ? "bg-[#FBEFC9] text-[#4A443C]" : "bg-[#FFF4D6] text-[#8A5A00]";
  return (
    <div role={tone === "error" ? "alert" : "note"} className={`rounded-[14px] px-3.5 py-2.5 text-[13px] leading-[1.45] ${style}`}>
      {children}
    </div>
  );
}

/** Page « Assistant IA » : analyse du site, rédaction libre, et base de connaissances (brouillons → publication). */
export function AssistantIaView({ kb, productDocs, llmReady }: { kb: KbListData; productDocs: KbDoc[]; llmReady: boolean }) {
  const { show, node } = useToast();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<AdminKbRow[]>(kb.rows);
  const [analysis, setAnalysis] = useState<{ analysis: Analysis; meta: AiMeta } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [created, setCreated] = useState<Set<number>>(() => new Set());
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorError, setEditorError] = useState("");

  const canWrite = kb.connected && kb.draftsReady && !kb.failed;

  const upsertRow = (entry: AdminKbRow) => setRows((list) => (list.some((r) => r.id === entry.id) ? list.map((r) => (r.id === entry.id ? entry : r)) : [entry, ...list]));
  const markCreated = (i: number | null) => {
    if (i === null) return;
    setCreated((s) => new Set(s).add(i));
  };
  const openEditor = (e: EditorState) => {
    setEditorError("");
    setEditor({ ...e, nonce: Date.now() });
  };

  async function analyze() {
    setAnalyzing(true);
    setAnalysisError("");
    try {
      const res = await analyzeSiteAction();
      if (res.ok) {
        setAnalysis({ analysis: res.analysis, meta: res.meta });
        setCreated(new Set());
      } else setAnalysisError(res.message);
    } catch {
      setAnalysisError("L'analyse a été interrompue (délai dépassé ou connexion coupée). Réessayez.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function ask(request: string) {
    setAsking(true);
    setAskError("");
    try {
      const res = await draftKbAction(request);
      if (res.ok) {
        openEditor({ value: { ...res.draft, source: "ai" }, id: null, isPublished: false, fromAnalysis: null, heading: "Brouillon proposé par l'IA" });
      } else setAskError(res.message);
    } catch {
      setAskError(NETWORK);
    } finally {
      setAsking(false);
    }
  }

  function createDraft(d: KbDraft, i: number) {
    startTransition(async () => {
      try {
        const res = await saveKbAction({ ...d, source: "ai" });
        if (res.ok) {
          upsertRow(res.entry);
          markCreated(i);
          show("Brouillon créé : relisez-le puis publiez-le dans la base de connaissances.");
        } else show(res.message);
      } catch {
        show(NETWORK);
      }
    });
  }

  function save(publish: boolean) {
    if (!editor) return;
    const v = editor.value;
    if (v.title.trim().length < 3) return setEditorError("Titre trop court.");
    if (v.text.trim().length < 20) return setEditorError("Contenu trop court (20 caractères minimum).");
    startTransition(async () => {
      try {
        const res = await saveKbAction({ ...(editor.id ? { id: editor.id } : {}), tag: v.tag, title: v.title, text: v.text, keywords: v.keywords, source: v.source, publish });
        if (res.ok) {
          upsertRow(res.entry);
          markCreated(editor.fromAnalysis);
          setEditor(null);
          setEditorError("");
          show(kbStateOf(res.entry) === "published" ? `Fiche publiée. L'assistant du site l'utilise sous ${ASSISTANT_KB_TTL_MIN} minutes.` : "Brouillon enregistré. Il reste invisible des clients.");
        } else setEditorError(res.message);
      } catch {
        setEditorError(NETWORK);
      }
    });
  }

  function changeState(row: AdminKbRow, state: KbState) {
    startTransition(async () => {
      try {
        const res = await setKbStateAction(row.id, state);
        if (res.ok) {
          upsertRow(res.entry);
          show(
            state === "published"
              ? `Fiche publiée. L'assistant du site l'utilise sous ${ASSISTANT_KB_TTL_MIN} minutes.`
              : state === "draft"
                ? "Fiche repassée en brouillon : elle n'est plus utilisée."
                : "Fiche désactivée : elle n'est plus utilisée.",
          );
        } else show(res.message);
      } catch {
        show(NETWORK);
      }
    });
  }

  function remove(row: AdminKbRow) {
    startTransition(async () => {
      try {
        const res = await deleteKbAction(row.id);
        if (res.ok) {
          setRows((list) => list.filter((r) => r.id !== row.id));
          if (editor?.id === row.id) setEditor(null);
          show("Fiche supprimée.");
        } else show(res.message);
      } catch {
        show(NETWORK);
      }
    });
  }

  const editorNode = editor ? (
    <KbEditor
      key={editor.id ?? `new-${editor.nonce}`}
      value={editor.value}
      onChange={(value) => setEditor((e) => (e ? { ...e, value } : e))}
      onSave={save}
      onCancel={() => setEditor(null)}
      error={editorError}
      busy={pending}
      heading={editor.heading}
      isPublished={editor.isPublished}
    />
  ) : null;

  return (
    <div className="flex flex-col gap-5">
      {!kb.connected ? <Banner tone="info">Base non connectée (mode démo) : les fiches affichées sont des exemples et rien n&apos;est enregistré.</Banner> : null}
      {kb.failed ? <Banner tone="error">La base de connaissances n&apos;a pas pu être lue. Rechargez la page dans un instant.</Banner> : null}
      {kb.connected && !kb.failed && !kb.draftsReady ? (
        <Banner tone="warn">Brouillons pas encore activés : la migration 0022 doit être appliquée sur la base. En attendant, les fiches sont en lecture seule ici.</Banner>
      ) : null}
      {!llmReady ? (
        <Banner tone="warn">L&apos;IA n&apos;est pas configurée (variable DEEPSEEK_API_KEY absente) : l&apos;analyse et la rédaction sont indisponibles. La base de connaissances reste modifiable à la main.</Banner>
      ) : null}

      <AnalysisPanel
        llmReady={llmReady}
        running={analyzing}
        error={analysisError}
        result={analysis}
        created={created}
        canWrite={canWrite}
        busy={pending}
        onAnalyze={analyze}
        onCreateDraft={createDraft}
        onEditDraft={(d, i) => openEditor({ value: { ...d, source: "ai" }, id: null, isPublished: false, fromAnalysis: i, heading: "Fiche proposée par l'IA" })}
      />

      <AskPanel llmReady={llmReady} running={asking} error={askError} onAsk={ask} />

      <KbList
        rows={rows}
        productDocs={productDocs}
        busy={pending}
        canWrite={canWrite}
        editor={editorNode}
        editingId={editor?.id ?? null}
        onNew={() => openEditor({ value: EMPTY, id: null, isPublished: false, fromAnalysis: null, heading: "Nouvelle fiche" })}
        onEdit={(row) =>
          openEditor({
            value: { id: row.id, tag: row.tag, title: row.title, text: row.text, keywords: row.keywords, source: row.source },
            id: row.id,
            isPublished: kbStateOf(row) === "published",
            fromAnalysis: null,
            heading: "Modifier la fiche",
          })
        }
        onState={changeState}
        onDelete={remove}
      />
      {node}
    </div>
  );
}
