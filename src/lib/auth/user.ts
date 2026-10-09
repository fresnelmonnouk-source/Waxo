import "server-only";
import { createSessionClient } from "@/lib/supabase/server";
import { supabasePublicEnv } from "@/lib/supabase/env";
import type { MeUser } from "./types";
import { withTimeout } from "./timeout";

export type CurrentUser = MeUser;

type SessionClient = Awaited<ReturnType<typeof createSessionClient>>;
export type SessionContext = { sb: SessionClient; userId: string; email: string; meta: Record<string, unknown>; createdAt: string };

/**
 * Client Supabase lié à la session + identité vérifiée (getUser() valide le jeton côté Supabase ;
 * getSession() lirait un cookie non vérifié). Renvoie null si non connecté, non configuré ou injoignable. Ne jette jamais.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  if (!supabasePublicEnv()) return null;
  try {
    const sb = await createSessionClient();
    const { data } = await withTimeout(sb.auth.getUser(), 3500);
    const user = data.user;
    if (!user?.email) return null;
    return { sb, userId: user.id, email: user.email, meta: (user.user_metadata ?? {}) as Record<string, unknown>, createdAt: user.created_at };
  } catch {
    return null;
  }
}

/**
 * Utilisateur courant + profil. Contrat : null si non connecté ou si Supabase n'est pas configuré. Ne jette jamais.
 * ATTENTION : lit les cookies → rend la page dynamique. Les pages statiques n'appellent PAS ceci ;
 * l'interface passe par `GET /api/me` (composant client AccountMenu).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const ctx = await getSessionContext();
  if (!ctx) return null;
  try {
    const { data: p } = await withTimeout(
      ctx.sb.from("profiles").select("role,first_name,last_name,phone,address,news,created_at").eq("id", ctx.userId).maybeSingle(),
      3500,
    );
    // Le rôle vient UNIQUEMENT de la table profiles (jamais des metadata modifiables par l'utilisateur).
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    return {
      id: ctx.userId,
      email: ctx.email,
      role: p?.role === "admin" ? "admin" : "client",
      firstName: p?.first_name || str(ctx.meta.first_name),
      lastName: p?.last_name || str(ctx.meta.last_name),
      phone: p?.phone || str(ctx.meta.phone),
      address: p?.address ?? "",
      news: !!p?.news,
      createdAt: p?.created_at ?? ctx.createdAt,
    };
  } catch {
    return null;
  }
}
