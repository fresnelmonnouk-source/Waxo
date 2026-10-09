import "server-only";
import { redirect } from "next/navigation";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { createSessionClient } from "@/lib/supabase/server";

export type AdminUser = { id: string; email: string };

const TIMEOUT_MS = 4000;

/**
 * Mode démo local : `WAXO_ADMIN_DEMO=1` ET NODE_ENV différent de "production" → un admin factice, SANS base.
 * Sert à construire/tester le back-office avant que Supabase soit branché. Impossible en production (NODE_ENV=production).
 */
export function isAdminDemoMode(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.WAXO_ADMIN_DEMO === "1";
}

/** Lit l'admin connecté : session valide ET profiles.role = 'admin' (vérifié en base, jamais déduit d'un cookie/metadata). */
export async function getAdmin(): Promise<AdminUser | null> {
  if (isAdminDemoMode()) return { id: "demo-admin", email: "admin@waxo.local" };
  if (!supabasePublicEnv()) return null;
  try {
    const supabase = await createSessionClient();
    const work = (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return null;
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      return profile?.role === "admin" ? { id: user.id, email: user.email ?? "" } : null;
    })();
    return await Promise.race([work, new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS))]);
  } catch {
    return null;
  }
}

/** À appeler en TÊTE de chaque page admin ET de chaque server action / route API admin. Redirige vers la connexion admin sinon. */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/connexion");
  return admin;
}

/** Variante pour routes API / server actions : renvoie null au lieu de rediriger (à traduire en 401/403 JSON). */
export async function assertAdmin(): Promise<AdminUser | null> {
  return getAdmin();
}
