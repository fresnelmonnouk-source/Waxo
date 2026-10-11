import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { isLocale, siteOrigin } from "@/lib/auth/http";
import { finishEmailLink } from "@/lib/auth/email-link";
import { withTimeout } from "@/lib/auth/timeout";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { createSessionClient } from "@/lib/supabase/server";

/**
 * Liens des e-mails de compte (modèles Supabase, voir scripts/gen-auth-emails.mjs) :
 * https://www.waxo.boutique/api/auth/confirm?token_hash=…&type=…&lang=…
 * Le lien affiché porte le domaine de la boutique (et non supabase.co) : meilleure délivrabilité, lien qui inspire confiance.
 * Contrairement au code PKCE, le token_hash fonctionne aussi quand l'e-mail est ouvert sur un autre appareil ou navigateur.
 */
const TYPES = new Set<EmailOtpType>(["email", "signup", "recovery", "invite", "magiclink", "email_change"]);

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const rawLang = params.get("lang");
  const lang = rawLang && isLocale(rawLang) ? rawLang : "fr";
  const origin = siteOrigin(req);
  const go = (path: string) => NextResponse.redirect(new URL(path, origin), 303);

  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  if (!tokenHash || !type || !TYPES.has(type) || !supabasePublicEnv()) return go(`/${lang}/connexion?error=link`);

  try {
    const sb = await createSessionClient();
    const { data, error } = await withTimeout(sb.auth.verifyOtp({ type, token_hash: tokenHash }), 8000);
    if (error || !data.user) return go(`/${lang}/connexion?error=link`);
    // Invitation : le compte n'a pas encore de mot de passe → même parcours que la réinitialisation.
    return await finishEmailLink(data.user.id, type === "recovery" || type === "invite", lang, origin);
  } catch {
    return go(`/${lang}/connexion?error=link`);
  }
}
