import "server-only";
import { cleanOrigin } from "@/lib/origin";
import { clientIp as ipFromHeaders } from "@/lib/checkout/rate-limit";

/** Réponse JSON jamais mise en cache (données de session / formulaires). */
export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Erreur générique : jamais de détail interne vers le client. */
export const fail = (code: string, status: number, extra?: Record<string, unknown>) =>
  json({ ok: false, code, ...extra }, status);

export function clientIp(req: Request): string {
  return ipFromHeaders(req.headers);
}

/** Corps JSON borné (20 Ko par défaut). Renvoie null si illisible ou trop gros. */
export async function readJson(req: Request, maxBytes = 20_000): Promise<Record<string, unknown> | null> {
  try {
    const text = await req.text();
    if (text.length > maxBytes) return null;
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Origine publique du site (liens des e-mails d'authentification). Jamais lue depuis l'en-tête Origin (falsifiable). */
export function siteOrigin(req: Request): string {
  const env = cleanOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (env) return env;
  return new URL(req.url).origin;
}

export function isLocale(v: unknown): v is "fr" | "en" {
  return v === "fr" || v === "en";
}
