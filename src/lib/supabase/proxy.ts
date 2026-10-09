import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { supabasePublicEnv } from "./env";

type CookieToSet = { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] };

const AUTH_COOKIE = /^sb-.*-auth-token/;
const REFRESH_TIMEOUT_MS = 3000;

/**
 * Rafraîchit la session Supabase AVANT de construire la réponse (les RSC liront alors le cookie frais),
 * puis recopie les cookies rafraîchis sur la réponse produite par `build`.
 * Sans cookie de session ou sans variables d'environnement : aucun appel réseau.
 */
export async function withSession(
  request: NextRequest,
  build: (request: NextRequest) => Promise<NextResponse> | NextResponse,
): Promise<NextResponse> {
  const env = supabasePublicEnv();
  const hasSession = request.cookies.getAll().some((c) => AUTH_COOKIE.test(c.name));
  if (!env || !hasSession) return build(request);

  const toSet: CookieToSet[] = [];
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          toSet.push({ name, value, options });
        });
      },
    },
  });

  // getUser() valide le jeton côté Supabase ; un timeout évite qu'un refresh qui ne résout jamais fige la requête.
  await Promise.race([
    supabase.auth.getUser().catch(() => null),
    new Promise((resolve) => setTimeout(resolve, REFRESH_TIMEOUT_MS)),
  ]);

  const response = await build(request);
  toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}
