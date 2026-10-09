import { checkBot } from "@/lib/auth/bot-guard";
import { clientIp, fail, json, readJson } from "@/lib/auth/http";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { withTimeout } from "@/lib/auth/timeout";
import { matchTrack, TRACK_NOT_FOUND, type TrackRow } from "@/lib/auth/track";
import { fieldErrors, trackSchema } from "@/lib/auth/validation";
import { createAdminClient } from "@/lib/supabase/admin";

const ipLimiter = createRateLimiter({ windowMs: 10 * 60_000, max: 15 });
const numberLimiter = createRateLimiter({ windowMs: 10 * 60_000, max: 8 });

/**
 * Suivi invité : numéro WX-… + (e-mail OU téléphone) de la commande.
 * Numéro inconnu et contact erroné donnent EXACTEMENT la même réponse (404 « notFound ») : pas d'énumération de commandes.
 * Ne renvoie que statut, lignes, total et date.
 */
export async function POST(req: Request) {
  const body = await readJson(req, 4_000);
  if (!body) return fail("invalid", 400);
  const verdict = checkBot(body);
  if (verdict === "honeypot") return json(TRACK_NOT_FOUND, 404);
  if (verdict === "tooFast") return fail("tooFast", 429);
  if (!ipLimiter.hit(clientIp(req))) return fail("rateLimited", 429);

  const parsed = trackSchema.safeParse(body);
  if (!parsed.success) return fail("invalid", 422, { fields: fieldErrors(parsed.error) });
  const { number, contact } = parsed.data;
  if (!numberLimiter.hit(number)) return fail("rateLimited", 429);

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return fail("unavailable", 503);
  }
  try {
    const { data, error } = await withTimeout(
      admin
        .from("orders")
        .select("number,status,created_at,total,phone,email,order_items(name,qty,unit_price)")
        .eq("number", number)
        .maybeSingle(),
    );
    if (error) return fail("unavailable", 503);
    const view = matchTrack((data as TrackRow | null) ?? null, contact);
    return view ? json({ ok: true, order: view }) : json(TRACK_NOT_FOUND, 404);
  } catch {
    return fail("unavailable", 503);
  }
}
