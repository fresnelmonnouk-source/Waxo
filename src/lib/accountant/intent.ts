// Compréhension du message du gérant : 100 % déterministe (regex), aucun LLM. Fonctions pures.
import { beninDate, cap, isMonthKey, prevMonthKey } from "./engine";
import { EXPENSE_LABELS } from "./types";
import type { ExpenseCat, ProductLite } from "./types";

export function norm(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[  ]/g, " ")
    .replace(/[’`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export const MAX_AMOUNT = 100_000_000;

/** Extrait un montant en F CFA : « 20 000 F », « 15k », « 15 mille », « 1,5 million »… Priorité aux nombres suivis d'une unité. */
export function parseAmount(text: string): number | null {
  const s = norm(text);
  const re = /(\d{1,3}(?:[ .]\d{3})+|\d+)(?:,(\d+))?\s*(fcfa|xof|cfa|f\b|k\b|mille\b|millions?\b)?/g;
  let first: number | null = null;
  for (const m of s.matchAll(re)) {
    let n = Number(m[1].replace(/[ .]/g, "") + (m[2] ? "." + m[2] : ""));
    const unit = m[3] ?? "";
    if (/^(k|mille)$/.test(unit)) n *= 1000;
    else if (/^million/.test(unit)) n *= 1_000_000;
    n = Math.round(n);
    if (!Number.isFinite(n) || n <= 0 || n > MAX_AMOUNT) continue;
    if (unit) return n;
    if (first == null) first = n;
  }
  return first;
}

export function detectCategory(s: string): ExpenseCat {
  if (/pub|facebook|insta|tiktok|sponsor|influen/.test(s)) return "pub";
  if (/livr|moto|zem|coursier|transport/.test(s)) return "livraison";
  if (/emball|carton|sachet/.test(s)) return "emballage";
  if (/loyer|electri|courant|\beau\b|internet/.test(s)) return "loyer";
  if (/salaire|paie\b|paye de|employe/.test(s)) return "salaire";
  if (/stock|reassort|fournisseur|achat/.test(s)) return "stock";
  return "autre";
}

const MONTH_RE: [RegExp, number][] = [
  [/janvier/, 1], [/fevrier/, 2], [/mars/, 3], [/avril/, 4], [/\bmai\b/, 5], [/\bjuin\b/, 6], [/juillet/, 7], [/\baout\b/, 8],
  [/septembre/, 9], [/octobre/, 10], [/novembre/, 11], [/decembre/, 12],
];

/** Mois cité dans la phrase (« en septembre », « mois dernier »), sinon null. `nowKey` = mois courant AAAA-MM. */
export function monthFromText(s: string, nowKey: string): string | null {
  if (/mois (dernier|precedent|passe)/.test(s)) return prevMonthKey(nowKey);
  const [ny, nm] = nowKey.split("-").map(Number);
  const yearMatch = s.match(/\b(20\d{2})\b/);
  for (const [re, m] of MONTH_RE) {
    if (!re.test(s)) continue;
    const y = yearMatch ? Number(yearMatch[1]) : m > nm ? ny - 1 : ny;
    const key = `${y}-${String(m).padStart(2, "0")}`;
    return isMonthKey(key) ? key : null;
  }
  return null;
}

export type Intent =
  | { kind: "add_expense"; amount: number; cat: ExpenseCat; label: string; date: string }
  | { kind: "set_cost"; amount: number; query: string }
  | { kind: "ads" | "margin" | "top" | "expenses" | "compare" | "advice" | "missing" | "summary" | "help" };

const ADD_VERB = /ajout|\bnote[rz]?\b|enregistr|\bpaye|depens|\bregle|achete|j'ai (verse|donne|sorti)|inscri/;
const COST_PHRASE = /(prix|cout) d'?achat|achat unitaire|me revient|me coute/;
const QUESTION = /\?\s*$|^(quel|quels|quelle|quelles|combien|est-ce|comment|pourquoi)\b/;

/** Déduit l'intention. `now` (ms) sert à résoudre « hier » en date calendaire (Bénin, UTC+1). */
export function parseIntent(text: string, now: number): Intent {
  const s = norm(text);
  const amount = parseAmount(text);

  if (amount && COST_PHRASE.test(s) && !QUESTION.test(s)) return { kind: "set_cost", amount, query: s };

  if (amount && ADD_VERB.test(s) && !QUESTION.test(s)) {
    const cat = detectCategory(s);
    const date = beninDate(now, /avant.?hier/.test(s) ? -2 : /\bhier\b/.test(s) ? -1 : 0);
    const label = cap(
      text
        .replace(/^\s*(ajoute[rz]?|note[rz]?|enregistre[rz]?)\s+/i, "")
        .replace(/\b(aujourd['’]?hui|avant[- ]?hier|hier)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60)
        .trim(),
    );
    return { kind: "add_expense", amount, cat, label: label || EXPENSE_LABELS[cat], date };
  }

  if (/\b(aide|help)\b|que sais-tu|que peux-tu|tu peux faire/.test(s)) return { kind: "help" };
  if (/compar|mois (dernier|precedent|passe)|par rapport|evolu|progress|\bvs\b/.test(s)) return { kind: "compare" };
  if (/conseil|que faire|ameliorer|recommand|astuce|optimis/.test(s)) return { kind: "advice" };
  if (/manque|sans prix|prix d'?achat|renseign/.test(s)) return { kind: "missing" };
  if (/rentab.*pub|publicit|\bpub\b|roas/.test(s)) return { kind: "ads" };
  if (/produit|rapporte|meilleur/.test(s)) return { kind: "top" };
  if (/depense|charges|categor|combien .*(pay|depens)/.test(s)) return { kind: "expenses" };
  if (/marge|benefice|profit|resultat/.test(s)) return { kind: "margin" };
  return { kind: "summary" };
}

/** Retrouve le produit cité (recouvrement de racines de 5 lettres entre la phrase et le nom). Ambiguïté = null. */
export function matchProduct(query: string, products: ProductLite[]): ProductLite | null {
  const q = norm(query);
  const stems = (t: string) => new Set(norm(t).split(/[^a-z0-9]+/).filter((w) => w.length >= 4).map((w) => w.slice(0, 5)));
  const qs = stems(q);
  let best: ProductLite | null = null;
  let bestScore = 0;
  let tie = false;
  for (const p of products) {
    let score = 0;
    for (const w of stems(p.name)) if (qs.has(w)) score += 1;
    if (norm(p.id) && new RegExp(`\\b${norm(p.id).replace(/[^a-z0-9]/g, "")}\\b`).test(q)) score += 1;
    if (score > bestScore) {
      best = p;
      bestScore = score;
      tie = false;
    } else if (score === bestScore && score > 0) tie = true;
  }
  return tie ? null : best;
}
