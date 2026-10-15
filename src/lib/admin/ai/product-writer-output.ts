// Contrôles APRÈS génération du rédacteur IA des fiches produit. Module PUR (testé : tests/product-writer-output.test.ts).
//
// La page lue est une donnée NON FIABLE : elle peut demander au modèle de glisser un contact externe dans la fiche ou de
// vider `fromLink` (audit Raphaël 🟡2 / Zoé Z7). D'où, côté serveur et quelle que soit la réponse du modèle :
//  1. aucun lien, e-mail, pseudo ni numéro de téléphone ne sort dans un champ (le texte ne doit JAMAIS envoyer un client
//     vers un autre vendeur) ;
//  2. lien fourni → TOUS les champs remplis sont marqués « à vérifier » (Helena O1b) ;
//  3. avertissements pour l'admin : phrase recopiée de la page (Helena J1), marque du site lu (Helena J2).
import { DETAIL_KEYS, type DetailKey } from "@/lib/catalog/details";
import { ALL_DRAFT_FIELDS, draftValue, type DraftField, type DraftWarnings, type ProductDraft } from "./product-draft";
import { PHONE_RES } from "./scrub";

export const NEAR_COPY_WARNING = "Phrase très proche du site lu : reformulez-la.";
export const BRAND_WARNING = "Contient la marque du site lu : retirez-la, sauf si votre article est bien de cette marque.";
export const CONTACT_WARNING = "Lien, e-mail ou numéro retiré de la proposition : la fiche ne renvoie jamais vers un autre vendeur.";

/** Mots consécutifs partagés avec la page à partir desquels une phrase est jugée recopiée. */
export const NEAR_COPY_WORDS = 8;

// ───────────────────────── Contacts ─────────────────────────

const TLD =
  "com|net|org|info|biz|bj|fr|be|ch|ca|ci|sn|tg|bf|ng|gh|cm|ma|io|co|me|ly|gl|gg|tv|cc|eu|uk|us|shop|store|online|site|app|africa|xyz";
const CONTACT_SOURCES: RegExp[] = [
  /\bhttps?:\/\/\S+/i,
  /\bwww\.\S+/i,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  new RegExp(`\\b[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?)*\\.(?:${TLD})\\b(?![-.]?[a-z0-9])(?:\\/\\S*)?`, "i"),
  /(?<![\w.@])@[A-Za-z0-9_][A-Za-z0-9_.]{2,29}/, // pseudo de réseau social
  ...PHONE_RES,
];
const CONTACT_TESTS = CONTACT_SOURCES.map((r) => new RegExp(r.source, r.flags.replace("g", "")));
const CONTACT_GLOBAL = CONTACT_SOURCES.map((r) => new RegExp(r.source, r.flags.includes("g") ? r.flags : `${r.flags}g`));

/** Le texte contient-il un lien, un e-mail, un nom de domaine, un pseudo ou un numéro de téléphone ? */
export const hasContact = (s: string): boolean => CONTACT_TESTS.some((r) => r.test(s));

/** Retire les contacts d'un texte d'une ligne (nom, mot) : le reste est gardé, espaces et ponctuation orphelins nettoyés. */
function stripInline(s: string): string {
  let out = s;
  for (const re of CONTACT_GLOBAL) out = out.replace(re, " ");
  return out
    .replace(/\s+([,;:.!?])/g, "$1")
    .replace(/(?:\s*[,;:|–-]\s*)+$/g, "")
    .replace(/^[\s,;:.-]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Description : chaque PHRASE qui contient un contact est retirée (« Commandez sur WhatsApp au +229… » disparaît entière). */
function stripSentences(s: string): string {
  return s
    .split("\n")
    .map((line) => (hasContact(line) ? line.split(/(?<=[.!?…])\s+/).filter((p) => !hasContact(p)).join(" ") : line))
    .filter((line, i, all) => line.trim() !== "" || (i > 0 && all[i - 1].trim() !== ""))
    .join("\n")
    .trim();
}

/** Rubrique (une information par ligne) : chaque LIGNE qui contient un contact est retirée. */
const stripLines = (s: string) =>
  s
    .split("\n")
    .filter((l) => !hasContact(l))
    .join("\n")
    .trim();

/** Brouillon sans aucun contact ; `removed` = champs nettoyés. */
export function stripDraftContacts(draft: ProductDraft): { draft: ProductDraft; removed: DraftField[] } {
  const removed: DraftField[] = [];
  const clean = (f: DraftField, v: string, fn: (s: string) => string) => {
    if (!v || !hasContact(v)) return v;
    removed.push(f);
    return fn(v);
  };
  const details = { ...draft.details };
  const detailsEn = { ...draft.detailsEn };
  for (const k of DETAIL_KEYS) {
    const inline = k === "color" || k === "materials";
    details[k] = clean(`fr.${k}` as DraftField, details[k], inline ? stripInline : stripLines);
    detailsEn[k] = clean(`en.${k}` as DraftField, detailsEn[k], inline ? stripInline : stripLines);
  }
  const keyword = clean("keyword", draft.keyword, () => "");
  return {
    draft: {
      ...draft,
      name: clean("name", draft.name, stripInline),
      nameEn: clean("nameEn", draft.nameEn, stripInline),
      description: clean("description", draft.description, stripSentences),
      descriptionEn: clean("descriptionEn", draft.descriptionEn, stripSentences),
      keyword,
      details,
      detailsEn,
    },
    removed,
  };
}

/** Champs remplis du brouillon (ordre du formulaire). */
export const filledFields = (d: ProductDraft): DraftField[] => ALL_DRAFT_FIELDS.filter((f) => draftValue(d, f).trim() !== "");

// ───────────────────────── Recopie et marque ─────────────────────────

/** Mots normalisés : minuscules, sans accents ni ponctuation. */
export function normWords(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Suites de `n` mots consécutifs (ensemble). */
function shingles(words: string[], n: number): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) out.add(words.slice(i, i + n).join(" "));
  return out;
}

/** `text` partage-t-il au moins `n` mots consécutifs avec `page` (comparaison normalisée) ? */
export function sharesWordRun(text: string, page: string, n = NEAR_COPY_WORDS): boolean {
  const mine = normWords(text);
  if (mine.length < n) return false;
  const theirs = shingles(normWords(page), n);
  for (let i = 0; i + n <= mine.length; i++) if (theirs.has(mine.slice(i, i + n).join(" "))) return true;
  return false;
}

/** Valeurs de `brand` qui ne désignent pas une marque. */
const NOT_A_BRAND = new Set(["generic", "generique", "unbranded", "sans marque", "no brand", "none", "n a", "na", "autre", "other"]);

/** La marque (mots normalisés) apparaît-elle, mot entier, dans le texte ? */
function containsBrand(text: string, brand: string): boolean {
  const b = normWords(brand).join(" ");
  if (b.length < 2 || NOT_A_BRAND.has(b)) return false;
  return ` ${normWords(text).join(" ")} `.includes(` ${b} `);
}

// ───────────────────────── Assemblage ─────────────────────────

export type WriterContext = {
  /** Un lien a été lu (même si la page a peu de texte). */
  withLink: boolean;
  /** Texte de la page tel qu'extrait (avant masquage). */
  pageText: string;
  /** Marques déclarées par le JSON-LD de la page. */
  brands: readonly string[];
  /** Notes de l'admin (une marque qu'il y écrit est la sienne). */
  notes: string;
};

const add = (w: DraftWarnings, f: DraftField, msg: string) => {
  const list = (w[f] ??= []);
  if (!list.includes(msg)) list.push(msg);
};

/** Applique les contrôles 1 à 3 au brouillon lu dans la réponse du modèle. */
export function finalizeDraft(parsed: ProductDraft, ctx: WriterContext): ProductDraft {
  const { draft, removed } = stripDraftContacts(parsed);
  const warnings: DraftWarnings = {};
  for (const f of removed) add(warnings, f, CONTACT_WARNING);

  if (ctx.withLink && ctx.pageText) {
    for (const f of ["description", "descriptionEn"] as const) {
      if (draft[f] && sharesWordRun(draft[f], ctx.pageText)) add(warnings, f, NEAR_COPY_WARNING);
    }
  }
  if (ctx.withLink) {
    const brands = ctx.brands.filter((b) => !containsBrand(ctx.notes, b));
    for (const f of ["name", "nameEn", "description", "descriptionEn"] as const) {
      if (draft[f] && brands.some((b) => containsBrand(draft[f], b))) add(warnings, f, BRAND_WARNING);
    }
  }

  // Sans lien, rien ne vient du lien ; avec un lien, TOUT champ rempli est à vérifier (fromLink du modèle ignoré).
  const fromLink = ctx.withLink ? filledFields(draft) : [];
  const out: ProductDraft = { ...draft, fromLink };
  if (Object.keys(warnings).length) out.warnings = warnings;
  return out;
}

/** Clé de champ d'une rubrique (utilitaire de test et d'affichage). */
export const detailField = (k: DetailKey, en = false): DraftField => `${en ? "en" : "fr"}.${k}` as DraftField;
