// Proposition du rédacteur IA pour une fiche produit, et son application au formulaire. Module PUR (client + serveur).
// La proposition REMPLIT le formulaire, elle n'enregistre rien : l'admin relit puis enregistre normalement.
import { DETAIL_KEYS, type DetailKey, type ProductDetails } from "@/lib/catalog/details";

/** Longueur maximale des notes de l'admin (champ « Vos notes » et server action). */
export const WRITER_NOTES_MAX = 4000;

/** Champ du formulaire rempli par l'IA. Rubriques : `fr.specs`, `en.specs`… */
export type DraftField = "name" | "nameEn" | "description" | "descriptionEn" | "keyword" | `fr.${DetailKey}` | `en.${DetailKey}`;

export type ProductDraft = {
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  keyword: string;
  details: ProductDetails;
  detailsEn: ProductDetails;
  /**
   * Champs à vérifier car un lien a été lu : mention « vient du lien, à vérifier ». Avec un lien, le serveur y met TOUS
   * les champs remplis (la liste déclarée par le modèle n'est pas fiable : audit Zoé Z7 / Helena O1b).
   */
  fromLink: DraftField[];
  /** Avertissements par champ, contrôlés après génération (phrase recopiée, marque du site lu, contact retiré). */
  warnings?: DraftWarnings;
};

export type DraftWarnings = Partial<Record<DraftField, string[]>>;

/** Partie du formulaire produit touchée par l'IA (mêmes noms que ProductFormValues). */
export type DraftTarget = {
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  keyword: string;
  details: ProductDetails;
  detailsEn: ProductDetails;
};

const DETAIL_LABEL: Record<DetailKey, string> = {
  color: "Couleur",
  materials: "Matériaux",
  specs: "Caractéristiques techniques",
  highlights: "Points forts",
  uses: "Utilisations possibles",
  care: "Conseils d'utilisation et d'entretien",
};

export const DRAFT_FIELD_LABEL = (f: DraftField): string => {
  switch (f) {
    case "name":
      return "Nom";
    case "nameEn":
      return "Nom anglais";
    case "description":
      return "Description";
    case "descriptionEn":
      return "Description anglaise";
    case "keyword":
      return "Mot affiché sans photo";
    default: {
      const [lang, key] = f.split(".") as ["fr" | "en", DetailKey];
      return lang === "en" ? `${DETAIL_LABEL[key]} (anglais)` : DETAIL_LABEL[key];
    }
  }
};

/** Valeur d'un champ du formulaire (rubriques comprises). */
export function draftValue(t: DraftTarget, f: DraftField): string {
  if (f.startsWith("fr.")) return t.details[f.slice(3) as DetailKey] ?? "";
  if (f.startsWith("en.")) return t.detailsEn[f.slice(3) as DetailKey] ?? "";
  return t[f as "name" | "nameEn" | "description" | "descriptionEn" | "keyword"] ?? "";
}

export const ALL_DRAFT_FIELDS: DraftField[] = [
  "name",
  "description",
  "keyword",
  ...DETAIL_KEYS.map((k) => `fr.${k}` as DraftField),
  "nameEn",
  "descriptionEn",
  ...DETAIL_KEYS.map((k) => `en.${k}` as DraftField),
];

/** Champs que la proposition remplirait ALORS qu'ils contiennent déjà un texte différent (confirmation avant écrasement). */
export function draftConflicts(current: DraftTarget, draft: DraftTarget): DraftField[] {
  return ALL_DRAFT_FIELDS.filter((f) => {
    const now = draftValue(current, f).trim();
    const next = draftValue(draft, f).trim();
    return next !== "" && now !== "" && now !== next;
  });
}

/**
 * Applique la proposition. « replace » : chaque champ proposé (non vide) remplace la saisie ; « fill-empty » : seuls les
 * champs encore vides sont remplis. Un champ que l'IA laisse vide ne touche JAMAIS la saisie de l'admin.
 * Renvoie aussi la liste des champs effectivement remplis.
 */
export function applyDraft<T extends DraftTarget>(current: T, draft: DraftTarget, mode: "replace" | "fill-empty"): { values: T; filled: DraftField[] } {
  const values: T = { ...current, details: { ...current.details }, detailsEn: { ...current.detailsEn } };
  const filled: DraftField[] = [];
  for (const f of ALL_DRAFT_FIELDS) {
    const next = draftValue(draft, f);
    if (!next.trim()) continue;
    if (mode === "fill-empty" && draftValue(current, f).trim() !== "") continue;
    if (f.startsWith("fr.")) values.details[f.slice(3) as DetailKey] = next;
    else if (f.startsWith("en.")) values.detailsEn[f.slice(3) as DetailKey] = next;
    else (values as DraftTarget)[f as "name" | "nameEn" | "description" | "descriptionEn" | "keyword"] = next;
    filled.push(f);
  }
  return { values, filled };
}
