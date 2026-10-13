import "server-only";
import { loadCorpusSources, buildCorpus } from "./corpus";
import { callLlmJson, type LlmJsonFail } from "./llm";
import { analysisSystemPrompt, analysisUserPrompt, draftSystemPrompt, draftUserPrompt } from "./prompts";
import { parseAnalysis, parseKbDraft, type Analysis, type KbDraft } from "./schema";
import { scrubText } from "./scrub";

/**
 * Orchestration de l'IA de l'admin : corpus (sans donnée personnelle) → DeepSeek (JSON en flux) → validation tolérante.
 * Budget de temps : la page déclare maxDuration = 60 s ; lecture du corpus ≈ 6 s max, génération bornée à 45 s.
 */

export const ANALYSIS_CFG = { maxTokens: 4096, deadlineMs: 45_000, corpusBudget: 60_000 } as const;
export const DRAFT_CFG = { maxTokens: 1000, deadlineMs: 30_000, corpusBudget: 40_000 } as const;

export type AiMeta = {
  ms: number;
  corpusChars: number;
  corpusTruncated: boolean;
  complete: boolean;
  repaired: boolean;
  dropped: number;
  usage: { prompt: number; completion: number } | null;
};

export type AiFailCode = "no_key" | "llm" | "timeout" | "unreadable";
export type AnalyzeOutcome = { ok: true; analysis: Analysis; meta: AiMeta } | { ok: false; code: AiFailCode };
export type DraftOutcome = { ok: true; draft: KbDraft; meta: AiMeta } | { ok: false; code: AiFailCode };

/** Journal SANS contenu : uniquement des compteurs, durées et codes (jamais le corpus, la demande ou la réponse). */
export function logAi(event: "analyze" | "draft", data: Record<string, number | boolean | string | null>): void {
  const safe: Record<string, number | boolean | string | null> = {};
  for (const [k, v] of Object.entries(data)) safe[k] = typeof v === "string" ? v.slice(0, 24).replace(/[^\w-]/g, "") : v;
  console.info(`[admin/ai] ${event} ${JSON.stringify(safe)}`);
}

const failCode = (f: LlmJsonFail): AiFailCode => (f.code === "no_key" ? "no_key" : f.code === "timeout" ? "timeout" : "llm");

export async function runAnalysis(): Promise<AnalyzeOutcome> {
  const t0 = Date.now();
  const src = await loadCorpusSources();
  const corpus = buildCorpus(src, { budget: ANALYSIS_CFG.corpusBudget });
  const shopName = src.settings?.brand.shopName ?? "";
  const res = await callLlmJson({
    system: analysisSystemPrompt(scrubText(shopName)),
    user: analysisUserPrompt(corpus.text),
    maxTokens: ANALYSIS_CFG.maxTokens,
    deadlineMs: ANALYSIS_CFG.deadlineMs,
    temperature: 0.2,
  });
  if (!res.ok) {
    logAi("analyze", { ok: false, code: res.code, status: res.status ?? null, ms: Date.now() - t0, corpusChars: corpus.chars });
    return { ok: false, code: failCode(res) };
  }
  const parsed = parseAnalysis(res.text);
  const meta: AiMeta = {
    ms: Date.now() - t0,
    corpusChars: corpus.chars,
    corpusTruncated: corpus.truncated,
    complete: res.complete,
    repaired: parsed?.report.repaired ?? false,
    dropped: parsed?.report.dropped ?? 0,
    usage: res.usage,
  };
  logAi("analyze", {
    ok: !!parsed,
    ms: meta.ms,
    corpusChars: meta.corpusChars,
    outChars: res.text.length,
    complete: meta.complete,
    repaired: meta.repaired,
    dropped: meta.dropped,
    issues: parsed?.analysis.issues.length ?? 0,
    topics: parsed?.analysis.missingTopics.length ?? 0,
    drafts: parsed?.analysis.kbDrafts.length ?? 0,
    promptTokens: res.usage?.prompt ?? null,
    completionTokens: res.usage?.completion ?? null,
  });
  if (!parsed) return { ok: false, code: "unreadable" };
  return { ok: true, analysis: parsed.analysis, meta };
}

export async function runDraft(request: string): Promise<DraftOutcome> {
  const t0 = Date.now();
  const src = await loadCorpusSources();
  const corpus = buildCorpus(src, { budget: DRAFT_CFG.corpusBudget });
  const res = await callLlmJson({
    system: draftSystemPrompt(scrubText(src.settings?.brand.shopName ?? "")),
    // La demande de l'admin passe aussi par le masquage (un nom ou un numéro de client collé par erreur ne part pas).
    user: draftUserPrompt(scrubText(request), corpus.text),
    maxTokens: DRAFT_CFG.maxTokens,
    deadlineMs: DRAFT_CFG.deadlineMs,
    temperature: 0.3,
  });
  if (!res.ok) {
    logAi("draft", { ok: false, code: res.code, status: res.status ?? null, ms: Date.now() - t0 });
    return { ok: false, code: failCode(res) };
  }
  const draft = parseKbDraft(res.text);
  const meta: AiMeta = {
    ms: Date.now() - t0,
    corpusChars: corpus.chars,
    corpusTruncated: corpus.truncated,
    complete: res.complete,
    repaired: false,
    dropped: draft ? 0 : 1,
    usage: res.usage,
  };
  logAi("draft", { ok: !!draft, ms: meta.ms, corpusChars: meta.corpusChars, outChars: res.text.length, complete: meta.complete, promptTokens: res.usage?.prompt ?? null, completionTokens: res.usage?.completion ?? null });
  if (!draft) return { ok: false, code: "unreadable" };
  return { ok: true, draft, meta };
}
