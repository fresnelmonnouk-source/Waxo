import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isLocale, siteOrigin } from "@/lib/auth/http";
import { RECOVERY_COOKIE } from "@/lib/auth/recovery";
import { withTimeout } from "@/lib/auth/timeout";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { createSessionClient } from "@/lib/supabase/server";

/**
 * Retour des liens envoyés par e-mail (confirmation d'inscription, réinitialisation) : échange du code PKCE contre une session,
 * puis redirection vers l'espace client. Lien invalide/expiré → page de connexion avec un message.
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

    if (kind === "recovery") {
      // Marque « session ouverte via un lien de réinitialisation » : l'ancien mot de passe n'est alors pas exigé (il est oublié).
      const store = await cookies();
      store.set(RECOVERY_COOKIE, data.user.id, { httpOnly: true, sameSite: "lax", secure: origin.startsWith("https"), path: "/api", maxAge: 15 * 60 });
      return go(`/${lang}/compte?tab=security&recovery=1`);
    }
    return go(`/${lang}/compte`);
  } catch {
    return go(`/${lang}/connexion?error=link`);
  }
}
