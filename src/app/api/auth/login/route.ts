import { fail, json, clientIp, readJson } from "@/lib/auth/http";
import { resolveEmail } from "@/lib/auth/identify";
import { createSharedLimiter } from "@/lib/ratelimit";
import { withTimeout } from "@/lib/auth/timeout";
import { fieldErrors, lockKey, loginSchema } from "@/lib/auth/validation";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { createSessionClient } from "@/lib/supabase/server";

/**
 * Verrous (audit Raphaël M2) : un verrou par identifiant SEUL permettait de bloquer le compte d'un tiers (et de l'admin)
 * avec 8 essais depuis n'importe où. Désormais :
 *  - par IP : 20 essais / 10 min, tous comptes confondus ;
 *  - par identifiant ET IP : 8 essais / 10 min (le verrou « normal ») ;
 *  - par identifiant, toutes IP : 40 essais / heure, frein contre la force brute distribuée (bloquer un tiers coûte
 *    désormais 40 requêtes pour 1 h, au lieu de 8 pour 10 min ; Supabase limite aussi /auth/v1/token de son côté).
 */
const ipLimiter = createSharedLimiter({ name: "auth-login-ipLimiter", windowMs: 10 * 60_000, max: 20 });
const idIpLimiter = createSharedLimiter({ name: "auth-login-idIpLimiter", windowMs: 10 * 60_000, max: 8 });
const idLimiter = createSharedLimiter({ name: "auth-login-idGlobal", windowMs: 60 * 60_000, max: 40 });

/**
 * Connexion par e-mail OU téléphone + mot de passe. Un seul message d'échec (`invalidCredentials`) pour
 * « compte inconnu » et « mot de passe faux » : aucune énumération de comptes.
 */
export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return fail("invalid", 400);
  if (typeof body.website === "string" && body.website.trim() !== "") return fail("invalidCredentials", 401); // champ piège
  const ip = clientIp(req);
  if (!(await ipLimiter.hit(ip))) return fail("rateLimited", 429);

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return fail("invalid", 422, { fields: fieldErrors(parsed.error) });
  const { id, password } = parsed.data;
  const key = lockKey(id);
  if (!(await idIpLimiter.hit(`${key}|${ip}`))) return fail("rateLimited", 429);
  if (!(await idLimiter.hit(key))) return fail("rateLimited", 429);
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
