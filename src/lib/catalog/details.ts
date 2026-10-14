// Rubriques facultatives d'une fiche produit (migration 0025) : module PUR, partagé par le back-office (client), les server
// actions, le catalogue et la fiche produit. Testé (tests/product-details.test.ts).
//
// Règle d'affichage : une rubrique vide n'apparaît pas (ni son titre). Saisie = une information par ligne.

export const DETAIL_KEYS = ["color", "materials", "specs", "highlights", "uses", "care"] as const;
export type DetailKey = (typeof DETAIL_KEYS)[number];
export type ProductDetails = Record<DetailKey, string>;

/** Longueurs maximales (mêmes valeurs que les contraintes CHECK de 0025). */
export const DETAIL_MAX: Record<DetailKey, number> = {
  color: 200,
  materials: 200,
  specs: 3000,
  highlights: 3000,
  uses: 3000,
  care: 3000,
};

/** Couleur et matériaux : une ligne courte, affichée sous la description. Les autres : bloc « Détails » sous la photo. */
export const INLINE_DETAILS = ["color", "materials"] as const satisfies readonly DetailKey[];
export const BLOCK_DETAILS = ["specs", "highlights", "uses", "care"] as const satisfies readonly DetailKey[];

export const EMPTY_DETAILS: ProductDetails = { color: "", materials: "", specs: "", highlights: "", uses: "", care: "" };

/** Normalise une saisie : fins de ligne unifiées, espaces de bord retirés, lignes vides consécutives réduites. */
export function cleanDetail(text: unknown): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Lit une ligne de base (colonnes absentes avant 0025 → vide). */
export function detailsFrom(row: Partial<Record<DetailKey, unknown>> | null | undefined): ProductDetails {
  const out = { ...EMPTY_DETAILS };
  if (!row) return out;
  for (const k of DETAIL_KEYS) out[k] = cleanDetail(row[k]);
  return out;
}

/** Rubrique par rubrique : la version de la langue demandée, sinon la version française (même repli que le nom). */
export function mergeDetails(primary: ProductDetails | null | undefined, fallback: ProductDetails | null | undefined): ProductDetails {
  const out = { ...EMPTY_DETAILS };
  for (const k of DETAIL_KEYS) out[k] = primary?.[k] || fallback?.[k] || "";
  return out;
}

export const hasAnyDetail = (d: ProductDetails, keys: readonly DetailKey[] = DETAIL_KEYS) => keys.some((k) => d[k] !== "");

/** Éléments d'une rubrique : une ligne = un élément ; puces saisies à la main (« - », « • », « * ») retirées. */
export function detailLines(text: string): string[] {
  return cleanDetail(text)
    .split("\n")
    .map((l) => l.replace(/^[-•*·]\s*/, "").trim())
    .filter(Boolean);
}

export type SpecRow = { label: string | null; value: string };

/** Caractéristiques techniques : « Contenance : 750 ml » → libellé + valeur ; une ligne sans « : » reste une valeur seule. */
export function specRows(text: string): SpecRow[] {
  return detailLines(text).map((line) => {
    const i = line.indexOf(":");
    const label = i > 0 ? line.slice(0, i).trim() : "";
    const value = i > 0 ? line.slice(i + 1).trim() : "";
    return label && value && label.length <= 60 ? { label, value } : { label: null, value: line };
  });
}
