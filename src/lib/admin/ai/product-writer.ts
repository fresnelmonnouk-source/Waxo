import "server-only";
import { fetchPageText, FETCH_MESSAGES, type FetchDeps, type FetchFailCode } from "./fetch-page";
import { callLlmJson, type LlmJsonResult } from "./llm";
import type { ProductDraft } from "./product-draft";
import { PRODUCT_WRITER_SYSTEM, productWriterUserPrompt } from "./product-writer-prompt";
import { finalizeDraft } from "./product-writer-output";
import { parseProductDraft } from "./product-writer-schema";
import { scrubWriterText } from "./scrub";

/**
 * Rédacteur IA des fiches produit : (lien → texte de la page) + notes + rayon → DeepSeek (JSON en flux) → lecture tolérante.
 * Rien n'est enregistré : la proposition remplit le formulaire, l'admin relit puis enregistre.
 *
 * Budget de temps (la page /admin/produits déclare maxDuration = 60 s) : lecture du lien 8 s max, génération 40 s max.
 * max_tokens : le plus gros cas (2 descriptions de 120 mots, 2 × 6 rubriques dont 12 lignes de caractéristiques, noms,
 * fromLink) tient vers 2 500 jetons ; 4 096 laisse de la marge (une réponse coupée = JSON tronqué, récupéré quand même).
 */
export const WRITER_CFG = { maxTokens: 4096, deadlineMs: 40_000, temperature: 0.3 } as const;

export type WriterMeta = {
  ms: number;
  pageChars: number;
  pageTruncated: boolean;
  complete: boolean;
  repaired: boolean;
  dropped: number;
  usage: { prompt: number; completion: number } | null;
};

export type WriterFailCode = "no_key" | "llm" | "timeout" | "unreadable" | `page_${FetchFailCode}`;
export type WriterOutcome = { ok: true; draft: ProductDraft; meta: WriterMeta } | { ok: false; code: WriterFailCode; message?: string };

export type WriterInput = { url: string | null; notes: string; rayon: string };
export type WriterDeps = { fetch?: FetchDeps; callLlm?: typeof callLlmJson };

/** Journal SANS contenu (ni lien, ni notes, ni page, ni réponse) : compteurs, durées, codes. */
function logWriter(data: Record<string, number | boolean | string | null>): void {
  const safe: Record<string, number | boolean | string | null> = {};
  for (const [k, v] of Object.entries(data)) safe[k] = typeof v === "string" ? v.slice(0, 24).replace(/[^\w-]/g, "") : v;
  console.info(`[admin/ai] product-writer ${JSON.stringify(safe)}`);
}

/** Caractères invisibles retirés, chevrons pleine largeur ramenés à « < > ». */
const unhide = (s: string) => s.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").replace(/\uFF1C/g, "<").replace(/\uFF1E/g, ">");

const llmFail = (r: Extract<LlmJsonResult, { ok: false }>): WriterFailCode => (r.code === "no_key" ? "no_key" : r.code === "timeout" ? "timeout" : "llm");

export async function runProductWriter(input: WriterInput, deps: WriterDeps = {}): Promise<WriterOutcome> {
  const t0 = Date.now();
  let page = "";
  let brands: readonly string[] = [];
  let pageTruncated = false;
  if (input.url) {
    const fetched = await fetchPageText(input.url, deps.fetch);
    if (!fetched.ok) {
      logWriter({ ok: false, code: `page_${fetched.code}`, status: fetched.status ?? null, ms: Date.now() - t0 });
      return { ok: false, code: `page_${fetched.code}`, message: FETCH_MESSAGES[fetched.code] };
    }
    page = fetched.page.text;
    brands = fetched.page.brands ?? [];
    pageTruncated = fetched.page.truncated || fetched.cut;
  }

  // Seconde barrière avant l'envoi au modèle : e-mails, secrets et numéros de forme téléphone masqués (les tailles et
  // listes de compatibilité restent : audit Zoé Z3) ; caractères invisibles et chevrons pleine largeur ramenés à la forme
  // simple, pour que la neutralisation des balises NOTES / PAGE / RAYON s'applique aussi à leurs imitations.
  const prep = (s: string) => scrubWriterText(unhide(s));
  const res = await (deps.callLlm ?? callLlmJson)({
    system: PRODUCT_WRITER_SYSTEM,
    user: productWriterUserPrompt({ notes: prep(input.notes), page: prep(page), rayon: prep(input.rayon) }),
    maxTokens: WRITER_CFG.maxTokens,
    deadlineMs: WRITER_CFG.deadlineMs,
    temperature: WRITER_CFG.temperature,
  });
  if (!res.ok) {
    logWriter({ ok: false, code: res.code, status: res.status ?? null, ms: Date.now() - t0, pageChars: page.length });
    return { ok: false, code: llmFail(res) };
  }
  const parsed = parseProductDraft(res.text);
  const meta: WriterMeta = {
    ms: Date.now() - t0,
    pageChars: page.length,
    pageTruncated,
    complete: res.complete,
    repaired: parsed?.report.repaired ?? false,
    dropped: parsed?.report.dropped ?? 0,
    usage: res.usage,
  };
  logWriter({
    ok: !!parsed,
    ms: meta.ms,
    withLink: !!input.url,
    pageChars: meta.pageChars,
    notesChars: input.notes.length,
    outChars: res.text.length,
    complete: meta.complete,
    repaired: meta.repaired,
    dropped: meta.dropped,
    fromLinkDeclared: parsed?.draft.fromLink.length ?? 0,
    promptTokens: res.usage?.prompt ?? null,
    completionTokens: res.usage?.completion ?? null,
  });
  if (!parsed) return { ok: false, code: "unreadable" };
  // Contrôles de sortie (le modèle a lu une page non fiable) : contacts retirés, champs « à vérifier » décidés ICI (pas par
  // le modèle), avertissements « phrase recopiée » et « marque du site lu ».
  const draft = finalizeDraft(parsed.draft, { withLink: !!input.url, pageText: page, brands, notes: input.notes });
  return { ok: true, draft, meta };
}
