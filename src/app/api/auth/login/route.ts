import { fail, json, clientIp, readJson } from "@/lib/auth/http";
import { resolveEmail } from "@/lib/auth/identify";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { withTimeout } from "@/lib/auth/timeout";
import { fieldErrors, loginSchema } from "@/lib/auth/validation";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { createSessionClient } from "@/lib/supabase/server";

const ipLimiter = createRateLimiter({ windowMs: 10 * 60_000, max: 20 });
const idLimiter = createRateLimiter({ windowMs: 10 * 60_000, max: 8 });

/**
 * Connexion par e-mail OU téléphone + mot de passe. Un seul message d'échec (`invalidCredentials`) pour
 * « compte inconnu » et « mot de passe faux » : aucune énumération de comptes.
 */
export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return fail("invalid", 400);
  if (typeof body.website === "string" && body.website.trim() !== "") return fail("invalidCredentials", 401); // champ piège
  if (!ipLimiter.hit(clientIp(req))) return fail("rateLimited", 429);

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return fail("invalid", 422, { fields: fieldErrors(parsed.error) });
  const { id, password } = parsed.data;
  if (!idLimiter.hit(id.toLowerCase())) return fail("rateLimited", 429);
  if (!supabasePublicEnv()) return fail("unavailable", 503);

  try {
    const email = await resolveEmail(id);
    if (!email) return fail("invalidCredentials", 401);
    const sb = await createSessionClient();
    const { error } = await withTimeout(sb.auth.signInWithPassword({ email, password }), 6000);
    if (error) {
      if (error.code === "email_not_confirmed") return fail("emailNotConfirmed", 403);
      if ((error.status ?? 0) >= 500 || error.name === "AuthRetryableFetchError") return fail("unavailable", 503);
      return fail("invalidCredentials", 401);
    }
    return json({ ok: true });
  } catch {
    return fail("unavailable", 503);
  }
}
