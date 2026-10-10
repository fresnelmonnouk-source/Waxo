import { fail, isLocale, json, clientIp, readJson, siteOrigin } from "@/lib/auth/http";
import { checkBot } from "@/lib/auth/bot-guard";
import { createSharedLimiter } from "@/lib/ratelimit";
import { withTimeout } from "@/lib/auth/timeout";
import { fieldErrors, signupSchema } from "@/lib/auth/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { createSessionClient } from "@/lib/supabase/server";

const limiter = createSharedLimiter({ name: "auth-signup-limiter", windowMs: 10 * 60_000, max: 6 });

/**
 * Inscription : prénom, nom, téléphone, e-mail, mot de passe ≥ 8.
 * Le rôle est TOUJOURS « client » (posé par le trigger SQL, jamais lu d'ici). Réponse identique que l'e-mail existe déjà ou non.
 */
export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return fail("invalid", 400);
  const verdict = checkBot(body);
  if (verdict === "honeypot") return json({ ok: true, status: "confirm" }); // le robot croit avoir réussi
  if (verdict === "tooFast") return fail("tooFast", 429);
  if (!(await limiter.hit(clientIp(req)))) return fail("rateLimited", 429);

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) return fail("invalid", 422, { fields: fieldErrors(parsed.error) });
  const v = parsed.data;
  if (!supabasePublicEnv()) return fail("unavailable", 503);

  const lang = isLocale(body.lang) ? body.lang : "fr";
  try {
    const sb = await createSessionClient();
    const { data, error } = await withTimeout(
      sb.auth.signUp({
        email: v.email,
        password: v.password,
        options: {
          emailRedirectTo: `${siteOrigin(req)}/api/auth/callback/${lang}/signup`,
          // `locale` : langue des e-mails de compte (modèles Supabase, voir scripts/gen-auth-emails.mjs).
          data: { first_name: v.firstName, last_name: v.lastName, phone: v.phone, locale: lang },
        },
      }),
      8000,
    );
    if (error) {
      if (error.code === "weak_password") return fail("invalid", 422, { fields: { password: "passWeak" } });
      if (error.code === "over_email_send_rate_limit" || error.status === 429) return fail("rateLimited", 429);
      if (error.code === "user_already_exists" || error.code === "email_exists") return json({ ok: true, status: "confirm" });
      const down = (error.status ?? 0) >= 500;
      return fail(down ? "unavailable" : "generic", down ? 503 : 400);
    }

    // Préférence newsletter : seulement pour un compte réellement créé (identities non vide), jamais pour un e-mail existant.
    const user = data.user;
    const fresh = !!user && Array.isArray(user.identities) && user.identities.length > 0;
    if (fresh && user && v.news) {
      try {
        const admin = createAdminClient();
        await admin.from("profiles").update({ news: true }).eq("id", user.id);
        await admin.from("newsletter_subs").upsert({ channel: "email", value: v.email, consent: true }, { onConflict: "channel,value", ignoreDuplicates: true });
      } catch {
        /* préférence non enregistrée : modifiable depuis « Mes informations » */
      }
    }
    return json({ ok: true, status: data.session ? "signedIn" : "confirm" });
  } catch {
    return fail("unavailable", 503);
  }
}
