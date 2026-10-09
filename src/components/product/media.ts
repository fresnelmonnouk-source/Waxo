/** Valeur CSS `url(...)` sûre pour une image de produit (chaîne entre guillemets, échappée) ; null si absente. */
export function cssImage(url: string | null | undefined): string | null {
  if (!url) return null;
  return `url(${JSON.stringify(url)}) center/cover no-repeat`;
}

/** Fond de repli quand le produit n'a pas de couleur propre (valeur de la maquette). */
export const FALLBACK_BG = "#E9E2D3";
