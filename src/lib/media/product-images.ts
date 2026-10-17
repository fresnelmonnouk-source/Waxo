// Photos multiples d'un produit (migration 0024) : module PUR, partagé par le back-office (client), les server actions,
// le catalogue et la fiche produit. Aucune dépendance navigateur ni serveur. Testé (tests/product-images.test.ts).
//
// Règle : la PREMIÈRE photo est la photo principale (couverture). `products.image_url` vaut toujours `images[0]`.

import { WATERMARK_VERSION } from "./watermark-version";

/** Nombre maximal de photos par produit (même valeur que la contrainte SQL de 0024). */
export const MAX_PRODUCT_IMAGES = 8;

const clean = (u: unknown): u is string => typeof u === "string" && u.trim() !== "";

/**
 * Liste des photos à afficher : `images` (0024) si elle est renseignée, sinon la photo unique `image_url` (colonne absente,
 * migration pas encore appliquée, ou ancienne URL non reprise). Sans doublon, sans vide, 8 au plus.
 */
export function productImages(images: readonly unknown[] | null | undefined, imageUrl: string | null | undefined): string[] {
  const list = Array.isArray(images) ? images.filter(clean) : [];
  const source = list.length ? list : clean(imageUrl) ? [imageUrl] : [];
  return [...new Set(source)].slice(0, MAX_PRODUCT_IMAGES);
}

/** Déplace la photo `from` à la position `to` (bornée). Liste inchangée si `from` est hors limites. */
export function moveImage(list: readonly string[], from: number, to: number): string[] {
  if (!Number.isInteger(from) || from < 0 || from >= list.length) return [...list];
  const target = Math.max(0, Math.min(list.length - 1, Math.trunc(to)));
  const out = [...list];
  const [item] = out.splice(from, 1);
  out.splice(target, 0, item);
  return out;
}

/** Fait de la photo `index` la photo principale (elle passe en tête, l'ordre des autres est conservé). */
export const makeCover = (list: readonly string[], index: number) => moveImage(list, index, 0);

/** Retire la photo `index`. */
export function removeImageAt(list: readonly string[], index: number): string[] {
  return list.filter((_, i) => i !== index);
}

/** Places restantes avant la limite. */
export const remainingSlots = (list: readonly string[], max = MAX_PRODUCT_IMAGES) => Math.max(0, max - list.length);

/** Ajoute des photos en fin de liste, sans doublon ni dépassement de la limite. `dropped` = photos refusées (limite). */
export function appendImages(list: readonly string[], urls: readonly string[], max = MAX_PRODUCT_IMAGES): { list: string[]; dropped: number } {
  const out = [...list];
  let dropped = 0;
  for (const u of urls) {
    if (!clean(u) || out.includes(u)) continue;
    if (out.length >= max) dropped += 1;
    else out.push(u);
  }
  return { list: out, dropped };
}

/**
 * Erreur PostgREST « colonne `images` inconnue » : migration 0024 pas encore appliquée. Lecture → 42703 (colonne
 * inexistante) ; écriture → PGRST204 (colonne absente du cache de schéma). Le code se replie alors sur `image_url` seule.
 */
export function isMissingImagesColumn(e: { code?: string; message?: string } | null | undefined): boolean {
  if (!e) return false;
  if (e.code !== "42703" && e.code !== "PGRST204") return false;
  return /images/i.test(e.message ?? "images");
}

// ───────────────────────── Tailles servies : filigrane /api/img, sinon transformation Supabase (optionnelle) ─────────────────────────
// Toute photo du bucket public `products` est servie par la route /api/img (src/app/api/img/route.ts), qui y ajoute le
// filigrane « Wá xɔ » à la volée (cache CDN d'un an). Les ORIGINAUX restent propres dans Supabase Storage et dans l'admin.
// `NEXT_PUBLIC_IMAGE_WATERMARK=0` coupe le filigrane : on retombe sur l'ancien comportement ci-dessous.
// La transformation d'image de Supabase Storage (`/storage/v1/render/image/public/…?width=`) est une option PAYANTE
// (offre Pro). Elle n'est donc utilisée que si NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORM=1 ; sinon l'image d'origine
// (carrée, 1 200 px max, WebP) est servie telle quelle, sans `srcset`.

const OBJECT_SEGMENT = "/storage/v1/object/public/";
const RENDER_SEGMENT = "/storage/v1/render/image/public/";

/** Transformation activée (variable publique, lue au rendu). */
export const imageTransformEnabled = () => process.env.NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORM === "1";

/** URL redimensionnée par Supabase (`width` px, ratio conservé), ou null si l'URL n'est pas une URL publique du Storage. */
export function storageImageAt(url: string, width: number): string | null {
  const i = url.indexOf(OBJECT_SEGMENT);
  if (i < 0 || url.includes("?")) return null;
  return `${url.slice(0, i)}${RENDER_SEGMENT}${url.slice(i + OBJECT_SEGMENT.length)}?width=${Math.round(width)}&quality=75`;
}

/** Largeurs que /api/img accepte (liste blanche : borne le nombre de variantes mises en cache et le coût de calcul). */
export const WATERMARK_WIDTHS = [320, 480, 720, 1080, 1200] as const;

const BUCKET_PATH = "/storage/v1/object/public/products/";
/** Longueur maximale de l'URL source d'une photo (aussi vérifiée par la route). */
export const MAX_SOURCE_URL_LENGTH = 500;

/** Filigrane actif (défaut) ; `NEXT_PUBLIC_IMAGE_WATERMARK=0` le coupe. Variable publique, lue au rendu / à la compilation. */
export const watermarkEnabled = () => process.env.NEXT_PUBLIC_IMAGE_WATERMARK !== "0";

// Caractères interdits dans l'URL entière : ? # \ espaces, caractères de contrôle (dont l'octet nul), DEL.
const FORBIDDEN_IN_URL = /[?#\\\s\u0000-\u001f\u007f]/;
const SEGMENT_CHARS = /^[A-Za-z0-9._~%-]+$/;
// Dans un segment DÉCODÉ : « / », « \ », contrôles (donc %2f, %5c, %00 sont refusés).
const FORBIDDEN_IN_DECODED = /[/\\\u0000-\u001f\u007f]/;

/**
 * Valide l'URL publique d'une photo du bucket `products` et renvoie son URL canonique (reconstruite, pas la saisie), ou null.
 * Règles (partagées avec la route /api/img, qui en fait sa défense anti-SSRF) : https, hôte EXACT de NEXT_PUBLIC_SUPABASE_URL
 * (pas de port ni d'identifiants), chemin sous `/storage/v1/object/public/products/`, aucun `?`/`#`, aucun segment
 * `.`/`..`/vide (même encodé), aucun `\`, `%2f`, `%5c`, octet nul ni caractère de contrôle, 500 caractères au plus.
 */
export function parseBucketPhotoUrl(raw: unknown, supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): string | null {
  if (typeof raw !== "string" || !supabaseUrl || raw.length === 0 || raw.length > MAX_SOURCE_URL_LENGTH) return null;
  if (FORBIDDEN_IN_URL.test(raw)) return null;
  let host: string;
  try {
    const base = new URL(supabaseUrl);
    if (base.protocol !== "https:") return null;
    host = base.host;
  } catch {
    return null;
  }
  const prefix = `https://${host}${BUCKET_PATH}`;
  if (!raw.startsWith(prefix)) return null;
  const rest = raw.slice(prefix.length);
  if (!rest) return null;
  for (const seg of rest.split("/")) {
    if (!SEGMENT_CHARS.test(seg) || seg === "." || seg === "..") return null;
    let decoded: string;
    try {
      decoded = decodeURIComponent(seg);
    } catch {
      return null;
    }
    if (decoded === "." || decoded === ".." || FORBIDDEN_IN_DECODED.test(decoded)) return null;
  }
  return prefix + rest;
}

/** Plus petite largeur de la liste blanche qui couvre `width` (la plus grande si `width` la dépasse). */
export function snapWatermarkWidth(width: number): number {
  const w = Number.isFinite(width) ? width : 720;
  return WATERMARK_WIDTHS.find((x) => x >= w) ?? WATERMARK_WIDTHS[WATERMARK_WIDTHS.length - 1];
}

/** `/api/img?...` d'une photo du bucket (sans tenir compte de l'interrupteur), ou null si l'URL n'est pas du bucket. */
function watermarkUrl(url: string | null | undefined, width: number, supabaseUrl?: string): string | null {
  const clean = parseBucketPhotoUrl(url, supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!clean) return null;
  return `/api/img?u=${encodeURIComponent(clean)}&w=${snapWatermarkWidth(width)}&v=${WATERMARK_VERSION}`;
}

/**
 * URL servie d'une photo : `/api/img?...` (filigrane, largeur arrondie à la liste blanche) pour une photo du bucket public
 * `products` ; TOUTE autre valeur (démo, externe, vide, interrupteur coupé) est renvoyée inchangée.
 */
export function watermarkedSrc(url: string, width: number, enabled?: boolean, supabaseUrl?: string): string;
export function watermarkedSrc(url: string | null | undefined, width: number, enabled?: boolean, supabaseUrl?: string): string | null;
export function watermarkedSrc(url: string | null | undefined, width: number, enabled: boolean = watermarkEnabled(), supabaseUrl?: string): string | null {
  if (!url) return null;
  return (enabled && watermarkUrl(url, width, supabaseUrl)) || url;
}

/** Largeurs proposées au navigateur (carte mobile 2×, carte bureau, fiche, fiche 2×). */
export const SRCSET_WIDTHS = [320, 480, 720, 1080] as const;

/**
 * `src` + `srcset` d'une photo. Photo du bucket (filigrane actif, défaut) : `src` = 720 px (repli des anciens navigateurs)
 * et `srcset` sur SRCSET_WIDTHS, via /api/img. Sinon : ancien comportement (transformation Supabase si activée, ou URL
 * d'origine sans `srcset`). Une URL hors bucket est toujours renvoyée telle quelle.
 */
export function imageSources(
  url: string,
  enabled: boolean = imageTransformEnabled(),
  widths: readonly number[] = SRCSET_WIDTHS,
  watermark: boolean = watermarkEnabled(),
  supabaseUrl?: string,
): { src: string; srcSet?: string } {
  if (watermark) {
    const src = watermarkUrl(url, 720, supabaseUrl);
    if (src) return { src, srcSet: widths.map((w) => `${watermarkUrl(url, w, supabaseUrl)} ${snapWatermarkWidth(w)}w`).join(", ") };
  }
  if (!enabled) return { src: url };
  const parts = widths.map((w) => [storageImageAt(url, w), w] as const);
  if (parts.some(([u]) => !u)) return { src: url };
  return { src: storageImageAt(url, 720) ?? url, srcSet: parts.map(([u, w]) => `${u} ${w}w`).join(", ") };
}
