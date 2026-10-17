import { MAX_SOURCE_URL_LENGTH, WATERMARK_WIDTHS, parseBucketPhotoUrl } from "@/lib/media/product-images";
import { WATERMARK_VERSION, applyWatermark } from "@/lib/media/watermark";

// GET /api/img?u=<URL publique Supabase de la photo>&w=<largeur>&v=<version du filigrane>
// Sert une photo du bucket public `products` AVEC le filigrane « Wá xɔ » (les originaux restent propres dans le Storage).
// Route PUBLIQUE (photos publiques, ni cookie ni session : exclue du proxy) ; cache CDN d'un an, l'URL étant « immuable »
// (même u + w + v = même image ; changer le style = incrémenter WATERMARK_VERSION).
//
// Sécurité (la route télécharge une URL fournie par le client : risque SSRF) :
//  - `u` doit être une URL https de l'hôte EXACT de NEXT_PUBLIC_SUPABASE_URL, sous /storage/v1/object/public/products/
//    (parseBucketPhotoUrl : pas de `..` même encodé, pas de ?/#, 500 caractères au plus) ; l'URL téléchargée est
//    RECONSTRUITE à partir de cette validation ;
//  - `w` dans une liste blanche ; paramètres inconnus ou répétés refusés (pas de variantes de cache illimitées) ;
//  - téléchargement borné : 8 s, 8 Mo (flux coupé), redirections interdites, image/* seulement (SVG exclu) ;
//  - décodage borné (limitInputPixels dans applyWatermark).
// Fail-open : si le traitement échoue, 302 vers l'original (sans cache) : la boutique ne doit jamais casser.

export const runtime = "nodejs";
export const maxDuration = 20;

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_PARAMS = new Set(["u", "w", "v"]);
const NO_STORE = { "Cache-Control": "no-store" } as const;
const IMMUTABLE = "public, max-age=31536000, s-maxage=31536000, immutable";

const text = (status: number, body: string, headers: Record<string, string> = NO_STORE) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", ...headers } });

/** Panne côté serveur : la boutique garde ses photos (originales) ; rien n'est mis en cache. Journal sans contenu. */
function failOpen(source: string, reason: string, err?: unknown): Response {
  console.error(`[api/img] ${reason}${err instanceof Error ? ` (${err.name})` : ""}`);
  return new Response(null, { status: 302, headers: { Location: source, ...NO_STORE } });
}

/** Lit le corps en s'arrêtant (et en annulant le flux) au-delà de MAX_BYTES ; null si trop gros. */
async function readCapped(res: Response): Promise<Buffer | null> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    await res.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  for (const key of params.keys()) if (!ALLOWED_PARAMS.has(key)) return text(400, "bad request");
  const one = (name: string) => {
    const all = params.getAll(name);
    return all.length === 1 ? all[0] : null;
  };

  const rawU = one("u");
  if (rawU === null || rawU.length > MAX_SOURCE_URL_LENGTH) return text(400, "bad request");
  const source = parseBucketPhotoUrl(rawU);
  if (!source) return text(400, "bad request");

  const rawW = one("w");
  const width = rawW !== null && /^\d{3,4}$/.test(rawW) ? Number(rawW) : NaN;
  if (!(WATERMARK_WIDTHS as readonly number[]).includes(width)) return text(400, "bad request");

  // Version absente ou périmée (page en cache d'avant un changement de style) : on renvoie vers l'URL courante, pour ne
  // jamais servir ni stocker de variante sous une version arbitraire.
  const version = one("v");
  if (version !== WATERMARK_VERSION) {
    if (version !== null && !/^[A-Za-z0-9]{1,8}$/.test(version)) return text(400, "bad request");
    const location = `/api/img?u=${encodeURIComponent(source)}&w=${width}&v=${WATERMARK_VERSION}`;
    return new Response(null, { status: 307, headers: { Location: location, "Cache-Control": "public, max-age=300" } });
  }

  let upstream: Response;
  try {
    upstream = await fetch(source, {
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "image/*" },
    });
  } catch (err) {
    return failOpen(source, "téléchargement impossible", err);
  }

  // Supabase répond 404, ou 400 avec un corps « not_found », pour un objet public absent.
  if (upstream.status === 404 || upstream.status === 400) {
    await upstream.body?.cancel().catch(() => undefined);
    return text(404, "not found");
  }
  if (!upstream.ok) {
    await upstream.body?.cancel().catch(() => undefined);
    return failOpen(source, `source en erreur (${upstream.status})`);
  }

  const type = (upstream.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!type.startsWith("image/") || type.startsWith("image/svg")) {
    await upstream.body?.cancel().catch(() => undefined);
    return text(415, "unsupported media type");
  }

  let original: Buffer | null;
  try {
    original = await readCapped(upstream);
  } catch (err) {
    return failOpen(source, "lecture interrompue", err);
  }
  if (!original) return failOpen(source, "image trop lourde");

  try {
    const out = await applyWatermark(original, width);
    return new Response(new Uint8Array(out), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": IMMUTABLE,
        // Une seule représentation par URL (toujours WebP) : seule la compression de transport varie.
        Vary: "Accept-Encoding",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return failOpen(source, "filigrane impossible", err);
  }
}
