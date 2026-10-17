import "server-only";
import sharp from "sharp";
import { WATERMARK_LOGO_PNG_BASE64 } from "./watermark-logo";

// Filigrane des photos de la boutique : le logo « Wá xɔ » très transparent, répété en diagonale sur toute la photo.
// Les ORIGINAUX restent propres dans Supabase Storage ; ce module est appelé par la route /api/img au moment de servir
// l'image. Toutes les mesures sont RELATIVES à la largeur de l'image : le rendu est identique en miniature et en grand.

export { WATERMARK_VERSION } from "./watermark-version";

/** Largeur minimale/maximale acceptées en entrée de `applyWatermark` (la route n'en sert que cinq, voir product-images.ts). */
const MIN_WIDTH = 16;
const MAX_WIDTH = 4096;

// Style (aperçu validé : docs/design/filigrane-apercu.png, 3e vignette).
const LOGO_WIDTH = 0.18; // largeur du logo / largeur de l'image
const ANGLE = -28; // degrés
const GAP_X = 0.07; // espace horizontal entre deux logos / largeur de l'image
const GAP_Y = 0.09; // espace vertical
const INK_OPACITY = 0.16; // logo encre (visible sur fond clair)
// Sur fond sombre l'encre disparaît : un liseré clair, flou et très léger passe SOUS l'encre (invisible sur fond clair).
const HALO_OPACITY = 0.28;
const HALO_BLUR = 0.0035; // écart-type du flou / largeur de l'image
const WEBP_QUALITY = 80;
/** Plafond de pixels décodés (protège la mémoire de la fonction : une photo hostile de 50 000 × 50 000 px est refusée). */
const MAX_INPUT_PIXELS = 40_000_000;

type Tile = { buffer: Buffer; width: number; height: number };

/** Une tuile : logo (liseré clair + encre) incliné, sur fond transparent. */
async function buildTile(imageWidth: number): Promise<Tile> {
  const logoW = Math.max(24, Math.round(imageWidth * LOGO_WIDTH));
  const margin = Math.max(2, Math.ceil(imageWidth * HALO_BLUR * 4));
  const logo = await sharp(Buffer.from(WATERMARK_LOGO_PNG_BASE64, "base64"))
    .resize({ width: logoW })
    .ensureAlpha()
    .extend({ top: margin, bottom: margin, left: margin, right: margin, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = logo.info;

  const ink = await sharp(logo.data).linear([1, 1, 1, INK_OPACITY], [0, 0, 0, 0]).png().toBuffer();
  // Deux étapes séparées : dans un même pipeline sharp, `linear` s'appliquerait avant l'extraction du canal alpha.
  const alphaRaw = await sharp(logo.data).extractChannel("alpha").raw().toBuffer();
  const haloAlpha = await sharp(alphaRaw, { raw: { width, height, channels: 1 } })
    .blur(Math.max(0.5, imageWidth * HALO_BLUR))
    .linear(HALO_OPACITY, 0)
    .raw()
    .toBuffer();
  const halo = await sharp({ create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .joinChannel(haloAlpha, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();

  const flat = await sharp(halo).composite([{ input: ink }]).png().toBuffer();
  const rotated = await sharp(flat)
    .rotate(ANGLE, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { buffer: rotated.data, width: rotated.info.width, height: rotated.info.height };
}

/** Positions des tuiles (décalées une rangée sur deux), y compris celles qui débordent : le motif couvre toute la photo. */
function tilePositions(w: number, h: number, tile: Tile): { left: number; top: number }[] {
  const stepX = tile.width + Math.round(w * GAP_X);
  const stepY = tile.height + Math.round(w * GAP_Y);
  const out: { left: number; top: number }[] = [];
  for (let row = 0, y = -Math.round(tile.height / 2); y < h; row += 1, y += stepY) {
    const shift = row % 2 ? Math.round(stepX / 2) : 0;
    for (let x = -stepX + shift; x < w; x += stepX) {
      // Une tuile entièrement hors cadre est inutile ; les autres sont rognées par le compositeur.
      if (x + tile.width <= 0 || y + tile.height <= 0) continue;
      out.push({ left: x, top: y });
    }
  }
  return out;
}

/**
 * Photo redimensionnée à `width` px au plus (ratio conservé, jamais agrandie), filigranée, en WebP (qualité 80). Le canal
 * alpha des PNG/WebP détourés est conservé. Même entrée + même largeur = même sortie (reproductible).
 * Lève une erreur si l'entrée n'est pas une image décodable : l'appelant (route) bascule alors vers l'original.
 */
export async function applyWatermark(input: Buffer, width: number): Promise<Buffer> {
  const target = Math.round(width);
  if (!Number.isFinite(target) || target < MIN_WIDTH || target > MAX_WIDTH) throw new RangeError("watermark: largeur hors limites");
  const base = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
    .rotate() // applique l'orientation EXIF (photos de téléphone)
    .resize({ width: target, withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = base.info;
  const hasAlpha = (await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata()).hasAlpha === true;

  const tile = await buildTile(w);
  const layer = tilePositions(w, h, tile).map((p) => ({ input: tile.buffer, left: p.left, top: p.top }));
  let img = sharp(base.data, { raw: { width: w, height: h, channels: 4 } }).composite(layer);
  if (!hasAlpha) img = img.removeAlpha();
  return img.webp({ quality: WEBP_QUALITY, alphaQuality: 90 }).toBuffer();
}
