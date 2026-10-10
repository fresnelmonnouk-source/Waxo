// Outils NAVIGATEUR pour les photos du back-office : décodage, recadrage carré (canvas), redimensionnement ≤ 1200 px,
// encodage WebP (repli JPEG) qualité ~0,82, envoi vers /api/admin/upload. N'importer que depuis un composant client.
import { computeCropRect, outputSide, OUTPUT_QUALITY, type CropState } from "./crop";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "./signature";

/** Décode le fichier SANS passer par une URL blob/data (donc sans dépendre de la CSP img-src). */
export async function decodeImageFile(file: File): Promise<{ ok: true; bitmap: ImageBitmap } | { ok: false; message: string }> {
  if (!(ALLOWED_IMAGE_TYPES as string[]).includes(file.type)) {
    return { ok: false, message: "Choisissez une image JPG, PNG ou WebP." };
  }
  if (file.size > 25 * 1024 * 1024) return { ok: false, message: "Image trop lourde (25 Mo maximum avant recadrage)." };
  try {
    const bitmap = await createImageBitmap(file);
    if (bitmap.width < 50 || bitmap.height < 50) {
      bitmap.close();
      return { ok: false, message: "Image trop petite (50 px minimum)." };
    }
    return { ok: true, bitmap };
  } catch {
    return { ok: false, message: "Image illisible." };
  }
}

/** Dessine la fenêtre de recadrage dans un canvas carré et l'encode en WebP (repli JPEG). */
export async function cropToBlob(bitmap: ImageBitmap, view: number, state: CropState): Promise<Blob> {
  const rect = computeCropRect(bitmap.width, bitmap.height, view, state);
  const side = outputSide(rect.side);
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  ctx.fillStyle = "#ffffff"; // fond blanc pour les PNG transparents (JPEG n'a pas d'alpha)
  ctx.fillRect(0, 0, side, side);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, rect.sx, rect.sy, rect.side, rect.side, 0, 0, side, side);

  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), type, OUTPUT_QUALITY));
  let blob = await toBlob("image/webp");
  if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg"); // Safari ancien : pas d'encodage WebP
  if (!blob) throw new Error("encode_failed");
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error("too_large");
  return blob;
}

export type UploadResult = { ok: true; url: string } | { ok: false; message: string };

export async function uploadProductImage(blob: Blob): Promise<UploadResult> {
  const form = new FormData();
  const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
  form.append("file", blob, `photo.${ext}`);
  try {
    const res = await fetch("/api/admin/upload", { method: "POST", body: form });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; url?: string; message?: string } | null;
    if (res.ok && json?.ok && typeof json.url === "string") return { ok: true, url: json.url };
    return { ok: false, message: json?.message ?? "Envoi impossible. Réessayez." };
  } catch {
    return { ok: false, message: "Connexion perdue pendant l'envoi. Réessayez." };
  }
}
