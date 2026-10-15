// Lecture TOLÉRANTE de la réponse du rédacteur IA des fiches produit. Module pur.
// Champ par champ : un champ illisible est vidé (et compté), pas toute la réponse ; JSON tronqué → tête valide récupérée
// (parseLenient). Toutes les limites du formulaire sont appliquées ici (le serveur re-valide de toute façon à l'enregistrement).
import { z } from "zod";
import { DETAIL_KEYS, DETAIL_MAX, EMPTY_DETAILS, cleanDetail, type DetailKey, type ProductDetails } from "@/lib/catalog/details";
import { parseLenient, tidy } from "./schema";
import type { DraftField, ProductDraft } from "./product-draft";

/** Limites (mêmes valeurs que validateProductForm et les champs du tiroir). */
export const DRAFT_LIMITS = {
  name: 120,
  description: 2000,
  keyword: 40,
  /** Lignes au plus par rubrique (consignes du prompt). */
  lines: { specs: 12, highlights: 5, uses: 5, care: 5 } as Partial<Record<DetailKey, number>>,
} as const;

/** Rubriques sur une seule ligne. */
const INLINE: readonly DetailKey[] = ["color", "materials"];

/** Retire le markdown courant (gras, titres, code) : le prompt l'interdit, on nettoie quand même. */
const unmark = (s: string) =>
  s
    .replace(/\*\*|__|`+/g, "")
    .replace(/^#{1,6}\s+/gm, "");

/** Coupe à `max` caractères, de préférence sur une fin de mot. */
export function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.search(/\s\S*$/);
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:]+$/, "");
}

const asText = (x: unknown): string | null => {
  if (typeof x === "string") return x;
  if (Array.isArray(x) && x.every((i) => typeof i === "string" || typeof i === "number")) return x.join("\n");
  if (typeof x === "number") return String(x);
  return null;
};

/** Texte d'une ligne (nom) ou de plusieurs (description). null = valeur illisible (ni chaîne, ni liste de chaînes). */
function textField(x: unknown, max: number, singleLine: boolean): string | null {
  if (x === undefined || x === null) return "";
  const raw = asText(x);
  if (raw === null) return null;
  let s = tidy(unmark(raw));
  if (singleLine) s = s.replace(/\s*\n+\s*/g, " ");
  return clip(s.replace(/[ \t]{2,}/g, " ").trim(), max);
}

/** Rubrique : une information par ligne, puces retirées, nombre de lignes et longueur bornés. */
function detailField(k: DetailKey, x: unknown): string | null {
  if (x === undefined || x === null) return "";
  const raw = asText(x);
  if (raw === null) return null;
  const lines = cleanDetail(tidy(unmark(raw)))
    .split("\n")
    .map((l) => l.replace(/^(?:[-•*·]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
  if (INLINE.includes(k)) return clip(lines.join(", "), DETAIL_MAX[k]);
  const max = DRAFT_LIMITS.lines[k] ?? 12;
  const out: string[] = [];
  let len = 0;
  for (const l of lines.slice(0, max)) {
    const add = (out.length ? 1 : 0) + l.length;
    if (len + add > DETAIL_MAX[k]) break;
    out.push(l);
    len += add;
  }
  return out.join("\n");
}

/** Mot affiché sans photo : un seul mot, minuscules, 40 caractères au plus. */
function keywordField(x: unknown): string {
  const raw = asText(x);
  if (!raw) return "";
  const word = tidy(raw)
    .toLowerCase()
    .match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/u)?.[0];
  return (word ?? "").slice(0, DRAFT_LIMITS.keyword);
}

const objectOf = (x: unknown): Record<string, unknown> => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {});

function detailsOf(x: unknown, report: { dropped: number }): ProductDetails {
  const o = objectOf(x);
  const out: ProductDetails = { ...EMPTY_DETAILS };
  const alias: Partial<Record<DetailKey, string[]>> = { color: ["colour", "couleur"], materials: ["material", "matieres", "matériaux"] };
  for (const k of DETAIL_KEYS) {
    const v = o[k] ?? alias[k]?.map((a) => o[a]).find((y) => y !== undefined);
    const t = detailField(k, v);
    if (t === null) report.dropped++;
    out[k] = t ?? "";
  }
  return out;
}

// ───────────────────────── fromLink ─────────────────────────

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z.]/g, "");

const DETAIL_ALIAS: Record<string, DetailKey> = {
  color: "color",
  colour: "color",
  colors: "color",
  couleur: "color",
  materials: "materials",
  material: "materials",
  matieres: "materials",
  materiaux: "materials",
  specs: "specs",
  spec: "specs",
  highlights: "highlights",
  uses: "uses",
  care: "care",
};

const fromLinkSchema = z.union([z.array(z.unknown()), z.string()]).transform((v) => (Array.isArray(v) ? v : v.split(/[,;\n]+/)));

/**
 * Normalise la liste `fromLink` vers les champs du formulaire. Une rubrique sans langue (« specs ») vaut pour les deux
 * langues ; « detailsFr » seul = toutes les rubriques françaises. Seuls les champs effectivement remplis sont gardés.
 */
export function normalizeFromLink(raw: unknown, draft: Omit<ProductDraft, "fromLink">): DraftField[] {
  const parsed = fromLinkSchema.safeParse(raw);
  if (!parsed.success) return [];
  const out = new Set<DraftField>();
  const addDetail = (k: DetailKey, langs: ("fr" | "en")[]) => langs.forEach((l) => out.add(`${l}.${k}`));
  for (const item of parsed.data) {
    if (typeof item !== "string") continue;
    const t = norm(item);
    if (!t) continue;
    if (t === "namefr" || t === "name" || t === "nom" || t === "nomfr") out.add("name");
    else if (t === "nameen" || t === "nomen") out.add("nameEn");
    else if (t === "descriptionfr" || t === "description") out.add("description");
    else if (t === "descriptionen") out.add("descriptionEn");
    else if (t === "word" || t === "keyword" || t === "mot") out.add("keyword");
    else if (t === "details" || t === "rubriques") DETAIL_KEYS.forEach((k) => addDetail(k, ["fr", "en"]));
    else if (t === "detailsfr") DETAIL_KEYS.forEach((k) => addDetail(k, ["fr"]));
    else if (t === "detailsen") DETAIL_KEYS.forEach((k) => addDetail(k, ["en"]));
    else {
      // « detailsFr.specs », « fr.specs », « specsFr », « specs_fr » (déjà réduit à « specsfr »), « specs ».
      const m = t.match(/^(?:details(fr|en)\.|(fr|en)\.)?([a-z]+?)(fr|en)?$/);
      const key = m ? DETAIL_ALIAS[m[3]] : undefined;
      if (!m || !key) continue;
      const lang = (m[1] || m[2] || m[4]) as "fr" | "en" | undefined;
      addDetail(key, lang ? [lang] : ["fr", "en"]);
    }
  }
  const filled = (f: DraftField): boolean => {
    if (f.startsWith("fr.")) return draft.details[f.slice(3) as DetailKey] !== "";
    if (f.startsWith("en.")) return draft.detailsEn[f.slice(3) as DetailKey] !== "";
    return draft[f as "name" | "nameEn" | "description" | "descriptionEn" | "keyword"] !== "";
  };
  return [...out].filter(filled);
}

// ───────────────────────── Lecture de la réponse ─────────────────────────

export type DraftParseReport = { repaired: boolean; dropped: number };

/** null = rien d'exploitable (JSON illisible, ou aucun champ rempli). */
export function parseProductDraft(raw: string): { draft: ProductDraft; report: DraftParseReport } | null {
  const parsed = parseLenient(raw);
  if (!parsed || !parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)) return null;
  const root = objectOf(parsed.value);
  const o = root.fiche && typeof root.fiche === "object" ? objectOf(root.fiche) : root;
  const report: DraftParseReport = { repaired: parsed.repaired, dropped: 0 };
  const field = (x: unknown, max: number, single: boolean) => {
    const t = textField(x, max, single);
    if (t === null) report.dropped++;
    return t ?? "";
  };
  const base = {
    name: field(o.nameFr ?? o.name ?? o.nom, DRAFT_LIMITS.name, true),
    nameEn: field(o.nameEn, DRAFT_LIMITS.name, true),
    description: field(o.descriptionFr ?? o.description, DRAFT_LIMITS.description, false),
    descriptionEn: field(o.descriptionEn, DRAFT_LIMITS.description, false),
    keyword: keywordField(o.word ?? o.keyword ?? o.mot),
    details: detailsOf(o.detailsFr ?? o.details, report),
    detailsEn: detailsOf(o.detailsEn, report),
  };
  const any =
    base.name || base.nameEn || base.description || base.descriptionEn || DETAIL_KEYS.some((k) => base.details[k] || base.detailsEn[k]);
  if (!any) return null;
  return { draft: { ...base, fromLink: normalizeFromLink(o.fromLink, base) }, report };
}
