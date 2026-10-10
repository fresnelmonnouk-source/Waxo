import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { IMAGE_EXT, MAX_UPLOAD_BYTES, detectImageType } from "@/lib/media/signature";

// POST /api/admin/upload — photo produit/pack déjà recadrée côté navigateur. Admin seulement.
// Contrôles : taille ≤ 5 Mo, type vérifié par SIGNATURE d'octets (jpeg/png/webp), nom généré (jamais celui du client).
// Stockage : bucket public `products` (migration 0003) ; seule la clé service_role écrit.

export const runtime = "nodejs";

const BUCKET = "products";
const json = (body: Record<string, unknown>, status: number) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  const admin = await assertAdmin();
  if (!admin) return json({ ok: false, code: "unauthorized", message: "Session expirée. Reconnectez-vous." }, 401);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: false, code: "unavailable", message: "Base non connectée (mode démo)." }, 503);
  }

  // Refus rapide avant de lire le corps (marge pour l'enveloppe multipart).
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    return json({ ok: false, code: "too_large", message: "Image trop lourde (5 Mo maximum)." }, 413);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, code: "invalid", message: "Envoi invalide." }, 400);
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return json({ ok: false, code: "invalid", message: "Aucune image reçue." }, 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return json({ ok: false, code: "too_large", message: "Image trop lourde (5 Mo maximum)." }, 413);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) {
    return json({ ok: false, code: "bad_type", message: "Format refusé : JPG, PNG ou WebP uniquement." }, 415);
  }

  const now = new Date();
  const path = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${IMAGE_EXT[type]}`;

  try {
    const sb = createAdminClient();
    const { error } = await sb.storage.from(BUCKET).upload(path, bytes, {
      contentType: type, // le type VÉRIFIÉ, pas celui déclaré par le client
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) {
      console.error("[admin/upload] storage", error.message.slice(0, 120));
      return json({ ok: false, code: "error", message: "Envoi impossible. Le stockage d'images est-il créé (migration 0003) ?" }, 502);
    }
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    return json({ ok: true, url: data.publicUrl, type, size: bytes.length }, 200);
  } catch {
    return json({ ok: false, code: "error", message: "Envoi impossible. Réessayez." }, 502);
  }
}
