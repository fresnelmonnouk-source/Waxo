import { watermarkedSrc } from "@/lib/media/product-images";

/**
 * Valeur CSS `url(...)` sûre pour une image de produit (chaîne entre guillemets, échappée) ; null si absente. Une photo du
 * bucket public est servie filigranée par /api/img (largeur de la liste blanche couvrant `width`, défaut 320 : vignettes).
 */
export function cssImage(url: string | null | undefined, width = 320): string | null {
  if (!url) return null;
  return `url(${JSON.stringify(watermarkedSrc(url, width))}) center/cover no-repeat`;
}

/** Fond de repli quand le produit n'a pas de couleur propre (valeur de la maquette). */
export const FALLBACK_BG = "#E9E2D3";
