import "server-only";

export type CurrentUser = { id: string; email: string; firstName: string; lastName: string; role: "client" | "admin" };

/**
 * STUB posé par le socle — l'agent « compte » le remplace par la vraie lecture de session Supabase
 * (createSessionClient + profil). Contrat : renvoie null si non connecté ou si Supabase n'est pas configuré. Ne jette jamais.
 * ATTENTION : lit les cookies → rend la page dynamique. Les pages statiques n'appellent PAS ceci ;
 * l'en-tête passe par le composant client AccountMenu qui interroge /api/me.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  return null;
}
