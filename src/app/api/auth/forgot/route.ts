import { fail, isLocale, json, clientIp, readJson, siteOrigin } from "@/lib/auth/http";
import { checkBot } from "@/lib/auth/bot-guard";
import { resolveEmail } from "@/lib/auth/identify";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { withTimeout } from "@/lib/auth/timeout";
import { fieldErrors, forgotSchema } from "@/lib/auth/validation";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { createSessionClient } from "@/lib/supabase/server";

const ipLimiter = createRateLimiter({ windowMs: 10 * 60_000, max: 6 });
const idLimiter = createRateLimiter({ windowMs: 60 * 60_000, max: 3 });

/** Lien de réinitialisation. Réponse identique que le compte existe ou non. */
export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return fail("invalid", 400);
  const verdict = checkBot(body);
  if (verdict === "honeypot") return json({ ok: true });
  if (verdict === "tooFast") return fail("tooFast", 429);
  if (!ipLimiter.hit(clientIp(req))) return fail("rateLimited", 429);

  const parsed = forgotSchema.safeParse(body);
  if (!parsed.success) return fail("invalid", 422, { fields: fieldErrors(parsed.error) });
  if (!supabasePublicEnv()) return fail("unavailable", 503);
  // Limite par identifiant : sans cela, on pourrait inonder la boîte d'une personne. Silencieux (même réponse).
  if (!idLimiter.hit(parsed.data.id.toLowerCase())) return json({ ok: true });

  const lang = isLocale(body.lang) ? body.lang : "fr";
  try {
    const email = await resolveEmail(parsed.data.id);
    if (email) {
      const sb = await createSessionClient();
      await withTimeout(sb.auth.resetPasswordForEmail(email, { redirectTo: `${siteOrigin(req)}/api/auth/callback/${lang}/recovery` }), 8000);
    }
  } catch {
    /* on ne révèle rien : réponse neutre */
  }
  return json({ ok: true });
}
