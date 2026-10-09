import { json } from "@/lib/auth/http";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { createSessionClient } from "@/lib/supabase/server";

/** Déconnexion : efface les cookies de session. Toujours `ok` (l'état local est de toute façon vidé côté interface). */
export async function POST() {
  if (supabasePublicEnv()) {
    try {
      const sb = await createSessionClient();
      await sb.auth.signOut();
    } catch {
      /* session déjà invalide ou service injoignable */
    }
  }
  return json({ ok: true });
}
