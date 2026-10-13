import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { isLocale, sameSiteRequest, siteOrigin } from "@/lib/auth/http";
import { finishEmailLink } from "@/lib/auth/email-link";
import { renderConfirmPage, type ConfirmType } from "@/lib/auth/confirm-page";
import { withTimeout } from "@/lib/auth/timeout";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { createSessionClient } from "@/lib/supabase/server";

/**
 * Liens des e-mails de compte (modèles Supabase, voir scripts/gen-auth-emails.mjs) :
 * https://www.waxo.boutique/api/auth/confirm?token_hash=…&type=…&lang=…
 * Le lien affiché porte le domaine de la boutique (et non supabase.co) : meilleure délivrabilité, lien qui inspire confiance.
 * Contrairement au code PKCE, le token_hash fonctionne aussi quand l'e-mail est ouvert sur un autre appareil ou navigateur.
 *
 * Audit Raphaël F1 (login CSRF) : le GET n'ouvre PLUS de session. Il affiche une page intermédiaire (même URL, liens
 * existants inchangés) dont le bouton POSTe le jeton ; le POST n'est accepté que depuis le site lui-même
 * (Sec-Fetch-Site / Origin). Si une AUTRE session était ouverte dans ce navigateur, la session du lien est refermée.
 */
const TYPES = new Set<EmailOtpType>(["email", "signup", "recovery", "invite", "magiclink", "email_change"]);
const TOKEN_MAX = 512;

type Parsed = { lang: "fr" | "en"; tokenHash: string | null; type: EmailOtpType | null };

function parse(get: (k: string) => string | null): Parsed {
  const rawLang = get("lang");
  const lang = rawLang && isLocale(rawLang) ? rawLang : "fr";
  const tokenHash = get("token_hash");
  const type = get("type") as EmailOtpType | null;
  return {
    lang,
    tokenHash: tokenHash && tokenHash.length <= TOKEN_MAX ? tokenHash : null,
    type: type && TYPES.has(type) ? type : null,
  };
}

const redirect = (origin: string, path: string) => NextResponse.redirect(new URL(path, origin), 303);

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const { lang, tokenHash, type } = parse((k) => params.get(k));
  const origin = siteOrigin(req);
  if (!tokenHash || !type || !supabasePublicEnv()) return redirect(origin, `/${lang}/connexion?error=link`);
  return new Response(renderConfirmPage({ lang, type: type as ConfirmType, tokenHash }), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      // Le jeton est dans l'URL : il ne doit jamais partir dans un Referer.
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export async function POST(req: Request) {
  const origin = siteOrigin(req);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return redirect(origin, "/fr/connexion?error=link");
  }
  const field = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : null;
  };
  const { lang, tokenHash, type } = parse(field);
  const fail = () => redirect(origin, `/${lang}/connexion?error=link`);
  if (!sameSiteRequest(req, [origin, new URL(req.url).origin])) return fail();
  if (!tokenHash || !type || !supabasePublicEnv()) return fail();

  try {
    const sb = await createSessionClient();
    // Session déjà ouverte dans ce navigateur (avant le lien) : on la note pour détecter un changement de compte.
    let before: string | null = null;
    try {
      const { data } = await withTimeout(sb.auth.getUser(), 2000);
      before = data.user?.id ?? null;
    } catch {
      before = null;
    }
    const { data, error } = await withTimeout(sb.auth.verifyOtp({ type, token_hash: tokenHash }), 8000);
    if (error || !data.user) return fail();
    if (before && before !== data.user.id) {
      // Le lien appartient à un AUTRE compte que celui déjà connecté (lien transmis par un tiers) : on ne bascule pas.
      await withTimeout(sb.auth.signOut({ scope: "local" }), 3000).catch(() => undefined);
      return redirect(origin, `/${lang}/connexion?error=link`);
    }
    // Invitation : le compte n'a pas encore de mot de passe → même parcours que la réinitialisation.
    return await finishEmailLink(data.user.id, type === "recovery" || type === "invite", lang, origin);
  } catch {
    return fail();
  }
}
