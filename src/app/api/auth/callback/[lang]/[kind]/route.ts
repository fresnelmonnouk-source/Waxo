import { NextResponse } from "next/server";
import { isLocale, siteOrigin } from "@/lib/auth/http";
import { finishEmailLink } from "@/lib/auth/email-link";
import { withTimeout } from "@/lib/auth/timeout";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { createSessionClient } from "@/lib/supabase/server";

/**
 * Retour des liens Supabase au format PKCE (?code=…) : échange du code contre une session, puis redirection vers l'espace client.
 * Les modèles d'e-mails actuels passent par /api/auth/confirm ; cette route reste pour les liens déjà envoyés.
 * Lien invalide/expiré → page de connexion avec un message.
 * À autoriser dans Supabase (Auth → URL Configuration) : https://<site>/api/auth/callback/**
 */
export async function GET(req: Request, ctx: { params: Promise<{ lang: string; kind: string }> }) {
  const { lang: rawLang, kind } = await ctx.params;
  const lang = isLocale(rawLang) ? rawLang : "fr";
  const origin = siteOrigin(req);
  const go = (path: string) => NextResponse.redirect(new URL(path, origin), 303);

  const code = new URL(req.url).searchParams.get("code");
  if (!code || !supabasePublicEnv()) return go(`/${lang}/connexion?error=link`);

  try {
    const sb = await createSessionClient();
    const { data, error } = await withTimeout(sb.auth.exchangeCodeForSession(code), 8000);
    if (error || !data.user) return go(`/${lang}/connexion?error=link`);
    return await finishEmailLink(data.user.id, kind === "recovery", lang, origin);
  } catch {
    return go(`/${lang}/connexion?error=link`);
  }
}
