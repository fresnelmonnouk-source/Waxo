import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabasePublicEnv } from "./env";

/**
 * Client anon SANS cookies : lecture du catalogue public. Garde les pages statiques/ISR
 * (un client à cookies dans un layout rend tout l'arbre dynamique).
 */
export function createPublicClient() {
  const env = supabasePublicEnv();
  if (!env) throw new Error("Supabase non configuré (NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY)");
  return createClient(env.url, env.key, { auth: { persistSession: false, autoRefreshToken: false } });
}
