import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client service_role : contourne la RLS. SERVEUR UNIQUEMENT (API routes, server actions gardées).
 * Seul chemin d'écriture sur le catalogue/commandes ; appelle place_order, mark_paid, cancel_order…
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service_role non configuré");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
