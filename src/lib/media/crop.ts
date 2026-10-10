// Mathématiques du recadrage carré (module pur, testé). Aucune dépendance navigateur.
//
// Modèle : une fenêtre carrée de côté `view` (px écran). L'image est affichée en « cover » (le petit côté remplit la fenêtre)
// puis multipliée par `zoom` (≥ 1). `panX/panY` = décalage du CENTRE de l'image par rapport au centre de la fenêtre (px écran).

export const MAX_OUTPUT_SIDE = 1200; // px
export const OUTPUT_QUALITY = 0.82;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export type CropState = { zoom: number; panX: number; panY: number };
export type CropRect = { sx: number; sy: number; side: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Échelle écran de l'image (px écran par px image). */
export function displayScale(imgW: number, imgH: number, view: number, zoom: number): number {
  return (view / Math.min(imgW, imgH)) * clamp(zoom, MIN_ZOOM, MAX_ZOOM);
}

/** Ramène le décalage dans les limites : l'image couvre toujours entièrement la fenêtre. */
export function clampPan(imgW: number, imgH: number, view: number, state: CropState): CropState {
  const zoom = clamp(state.zoom, MIN_ZOOM, MAX_ZOOM);
  const scale = displayScale(imgW, imgH, view, zoom);
  const maxX = Math.max(0, (imgW * scale - view) / 2);
  const maxY = Math.max(0, (imgH * scale - view) / 2);
  return { zoom, panX: clamp(state.panX, -maxX, maxX), panY: clamp(state.panY, -maxY, maxY) };
}

/** Rectangle source (px image) correspondant à la fenêtre. */
export function computeCropRect(imgW: number, imgH: number, view: number, state: CropState): CropRect {
  const s = clampPan(imgW, imgH, view, state);
  const scale = displayScale(imgW, imgH, view, s.zoom);
  const side = Math.min(view / scale, imgW, imgH);
  const sx = clamp(imgW / 2 - side / 2 - s.panX / scale, 0, imgW - side);
  const sy = clamp(imgH / 2 - side / 2 - s.panY / scale, 0, imgH - side);
  return { sx, sy, side };
}

/** Côté de l'image finale : jamais agrandie, jamais au-delà de 1200 px. */
export function outputSide(sourceSide: number, max = MAX_OUTPUT_SIDE): number {
  return Math.max(1, Math.min(Math.floor(sourceSide), max));
}
