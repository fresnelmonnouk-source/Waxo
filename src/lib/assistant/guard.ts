import { norm, numbersIn } from "./text";

/**
 * Garde-fou sur la sortie du modèle. Le LLM ne fait que la coquille conversationnelle : sa phrase est refusée
 * (et remplacée par le texte déterministe) si elle nomme un produit du catalogue, contient un nombre qui ne vient
 * pas du contexte fourni (prix, délai inventé…), un lien, une adresse e-mail ou si elle est vide ou trop longue.
 */
export const MAX_LLM_CHARS = 600;

export function cleanLlmText(raw: string): string {
  return raw
    .replace(/[*_`#>]+/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export type GuardContext = {
  /** Noms complets de tous les produits du catalogue. */
  productNames: string[];
  /** Nombres autorisés (chiffres seuls) : ceux du contexte fiable donné au modèle et du message du visiteur. */
  allowedNumbers: ReadonlySet<string>;
};

export function validateLlmText(raw: string, ctx: GuardContext): string | null {
  const text = cleanLlmText(raw);
  if (!text || text.length > MAX_LLM_CHARS) return null;
  const n = norm(text);
  if (/https?:|www\.|@|\.(com|bj|net|org)\b/.test(n)) return null;
  for (const name of ctx.productNames) {
    const nn = norm(name);
    if (nn.length >= 4 && n.includes(nn)) return null;
  }
  for (const num of numbersIn(text)) {
    if (!ctx.allowedNumbers.has(num)) return null;
  }
  return text;
}
