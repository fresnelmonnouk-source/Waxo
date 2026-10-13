import { z } from "zod";
import { KB_TAGS } from "@/lib/settings/kb-search";

// Sorties JSON de DeepSeek pour l'IA de l'admin : validation Zod ÉLÉMENT PAR ÉLÉMENT (un élément invalide est écarté, pas
// toute la réponse) et récupération d'un JSON tronqué (max_tokens atteint ou délai dépassé). Module pur.

export const SEVERITIES = ["critique", "important", "conseil"] as const;
export type Severity = (typeof SEVERITIES)[number];

const SEVERITY_ALIASES: Record<string, Severity> = {
  critique: "critique",
  critical: "critique",
  bloquant: "critique",
  important: "important",
  majeur: "important",
  high: "important",
  conseil: "conseil",
  suggestion: "conseil",
  mineur: "conseil",
  low: "conseil",
};

/** Pas de tiret cadratin dans nos textes : « a — b » devient « a, b ». */
export function tidy(s: string): string {
  return s
    .replace(/\s*—\s*/g, ", ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const text = (max: number, min = 1) =>
  z
    .string()
    .transform(tidy)
    .pipe(z.string().min(min).max(max));

const severity = z
  .string()
  .transform((s) => SEVERITY_ALIASES[s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")])
  .pipe(z.enum(SEVERITIES));

export const issueSchema = z.object({
  severity,
  where: text(160),
  problem: text(700, 5),
  suggestion: text(700).optional().default(""),
});
export type Issue = z.infer<typeof issueSchema>;

export const missingTopicSchema = z.object({ topic: text(160, 3), why: text(500).optional().default("") });
export type MissingTopic = z.infer<typeof missingTopicSchema>;

const tagSchema = z
  .string()
  .transform((t) => (KB_TAGS as readonly string[]).find((k) => k.toLowerCase() === t.trim().toLowerCase()) ?? "Autre")
  .pipe(z.enum(KB_TAGS));

const keywordsSchema = z
  .union([z.string(), z.array(z.string())])
  .transform((k) => (Array.isArray(k) ? k.join(" ") : k).replace(/[,;]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 300));

/** Même bornes que l'éditeur de fiches (reglages/actions.ts) : titre 3-120, texte 20-2000, mots-clés 300. */
export const kbDraftSchema = z.object({
  tag: tagSchema.catch("Autre"),
  title: text(120, 3),
  text: text(2000, 20),
  keywords: keywordsSchema.catch(""),
});
export type KbDraft = z.infer<typeof kbDraftSchema>;

export type Analysis = { issues: Issue[]; missingTopics: MissingTopic[]; kbDrafts: KbDraft[] };
export type ParseReport = { repaired: boolean; dropped: number };

export const LIMITS = { issues: 15, missingTopics: 10, kbDrafts: 8 } as const;

// ───────────────────────── Récupération d'un JSON tronqué ─────────────────────────

/** Isole l'objet JSON d'une réponse (blocs ```json, texte autour). */
export function extractJsonText(raw: string): string | null {
  const s = String(raw ?? "").replace(/```(?:json)?/gi, "");
  const start = s.indexOf("{");
  return start < 0 ? null : s.slice(start);
}

/**
 * Parse un JSON, ou à défaut sa plus longue tête valide : on coupe après le dernier `}` / `]` / chaîne complète
 * (hors chaînes), on referme les conteneurs ouverts, et on retente en reculant. Renvoie null si rien n'est récupérable.
 */
export function parseLenient(raw: string): { value: unknown; repaired: boolean } | null {
  const s = extractJsonText(raw);
  if (s === null) return null;
  try {
    return { value: JSON.parse(s), repaired: false };
  } catch {
    /* réparation ci-dessous */
  }
  // Points de coupe sûrs : juste après la fermeture d'un conteneur ou d'une chaîne valeur, avec la pile à cet endroit.
  const cuts: { at: number; stack: string }[] = [];
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') {
        inStr = false;
        cuts.push({ at: i + 1, stack: stack.join("") });
      }
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" || c === "]") {
      stack.pop();
      cuts.push({ at: i + 1, stack: stack.join("") });
    }
  }
  const closer = (st: string) =>
    st
      .split("")
      .reverse()
      .map((o) => (o === "{" ? "}" : "]"))
      .join("");
  let tries = 0;
  for (let k = cuts.length - 1; k >= 0 && tries < 400; k--, tries++) {
    const { at, stack: st } = cuts[k];
    const head = s.slice(0, at).replace(/,\s*$/, "");
    try {
      return { value: JSON.parse(head + closer(st)), repaired: true };
    } catch {
      /* point de coupe suivant (ex. clé orpheline « "text" ») */
    }
  }
  return null;
}

function validItems<T>(raw: unknown, schema: z.ZodType<T>, max: number, report: ParseReport): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const item of raw) {
    const r = schema.safeParse(item);
    if (r.success && out.length < max) out.push(r.data);
    else report.dropped++;
  }
  return out;
}

const RANK: Record<Severity, number> = { critique: 0, important: 1, conseil: 2 };

/** Analyse du site : tout ce qui est valide est gardé, le reste compté dans `dropped`. null = rien d'exploitable. */
export function parseAnalysis(raw: string): { analysis: Analysis; report: ParseReport } | null {
  const parsed = parseLenient(raw);
  if (!parsed || !parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)) return null;
  const o = parsed.value as Record<string, unknown>;
  const report: ParseReport = { repaired: parsed.repaired, dropped: 0 };
  const analysis: Analysis = {
    issues: validItems(o.issues, issueSchema, LIMITS.issues, report).sort((a, b) => RANK[a.severity] - RANK[b.severity]),
    missingTopics: validItems(o.missingTopics, missingTopicSchema, LIMITS.missingTopics, report),
    kbDrafts: validItems(o.kbDrafts, kbDraftSchema, LIMITS.kbDrafts, report),
  };
  if (!analysis.issues.length && !analysis.missingTopics.length && !analysis.kbDrafts.length && !("issues" in o)) return null;
  return { analysis, report };
}

/** Fiche rédigée à la demande : un objet (ou `{ draft: {...} }`). */
export function parseKbDraft(raw: string): KbDraft | null {
  const parsed = parseLenient(raw);
  if (!parsed || !parsed.value || typeof parsed.value !== "object") return null;
  const v = parsed.value as Record<string, unknown>;
  const candidate = v.draft && typeof v.draft === "object" ? v.draft : v;
  const r = kbDraftSchema.safeParse(candidate);
  return r.success ? r.data : null;
}
