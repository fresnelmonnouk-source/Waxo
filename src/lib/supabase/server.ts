import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicEnv } from "./env";

/** Client serveur lié à la session (cookies). Rend la page dynamique : à éviter dans les layouts statiques. */
export async function createSessionClient() {
  const env = supabasePublicEnv();
  if (!env) throw new Error("Supabase non configuré (NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY)");
  const store = await cookies();
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        // Les Server Components n'ont pas le droit d'écrire des cookies : le refresh se fait dans proxy.ts.
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* ignoré hors Server Action / Route Handler */
        }
      },
    },
  });
}
