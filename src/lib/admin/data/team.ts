import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { TeamAction, TeamData, TeamEvent, TeamMember } from "@/lib/admin/team";
import { adminDb, withTimeout } from "./products";

// Lecture de l'équipe d'administration (profiles.role = 'admin' + e-mails via l'API admin Auth) et de l'historique 0012.
// service_role uniquement ; repli démo sans Supabase.

const USERS_PER_PAGE = 1000;
const MAX_USER_PAGES = 20; // 20 000 comptes : bien au-delà du besoin d'une boutique, borne une boucle qui ne finirait pas

function displayName(u: User | null, p: { first_name?: string | null; last_name?: string | null }): string {
  const n = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  return n || (u?.email ? u.email.split("@")[0] : "—");
}

/** Recherche un compte par e-mail (l'API admin Auth n'offre pas de recherche directe : pages successives). */
export async function findUserByEmail(sb: SupabaseClient, email: string): Promise<User | null> {
  for (let page = 1; page <= MAX_USER_PAGES; page += 1) {
    const { data, error } = await withTimeout(sb.auth.admin.listUsers({ page, perPage: USERS_PER_PAGE }));
    if (error) throw error;
    const found = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (found) return found;
    if (data.users.length < USERS_PER_PAGE) return null;
  }
  return null;
}

/** Identifiants des admins actuels (invitations en attente comprises). */
export async function getAdminIds(sb: SupabaseClient): Promise<string[]> {
  const { data, error } = await withTimeout(sb.from("profiles").select("id").eq("role", "admin"));
  if (error) throw error;
  return (data ?? []).map((r) => r.id as string);
}

export async function getTeam(meId: string): Promise<TeamData> {
  const sb = adminDb();
  if (!sb) {
    return {
      source: "demo",
      members: [{ id: meId, email: "admin@waxo.local", name: "Admin démo", status: "active", lastSignInAt: null, isMe: true }],
      events: [],
    };
  }
  try {
    const [profiles, events] = await Promise.all([
      withTimeout(sb.from("profiles").select("id,first_name,last_name,created_at").eq("role", "admin").order("created_at", { ascending: true })),
      withTimeout(sb.from("admin_role_events").select("created_at,action,actor_id,target_email").order("created_at", { ascending: false }).limit(30)),
    ]);
    if (profiles.error) throw profiles.error;

    const users = new Map<string, User | null>();
    const loadUser = async (id: string) => {
      if (users.has(id)) return users.get(id) ?? null;
      const { data } = await withTimeout(sb.auth.admin.getUserById(id));
      users.set(id, data.user ?? null);
      return data.user ?? null;
    };

    const members: TeamMember[] = await Promise.all(
      (profiles.data ?? []).map(async (p) => {
        const u = await loadUser(p.id as string);
        return {
          id: p.id as string,
          email: u?.email ?? "",
          name: displayName(u, p),
          status: u?.last_sign_in_at ? "active" : "invited",
          lastSignInAt: u?.last_sign_in_at ?? null,
          isMe: p.id === meId,
        } satisfies TeamMember;
      }),
    );

    // Historique : table absente (0012 pas encore appliquée) = liste vide, la page reste utilisable.
    const rows = events.error ? [] : (events.data ?? []);
    const evs: TeamEvent[] = await Promise.all(
      rows.map(async (r) => {
        const actor = r.actor_id ? await loadUser(r.actor_id as string).catch(() => null) : null;
        return { at: r.created_at as string, action: r.action as TeamAction, actorEmail: actor?.email ?? "compte supprimé", targetEmail: r.target_email as string };
      }),
    );
    return { source: "db", members, events: evs };
  } catch (e) {
    console.error("[admin/team] lecture", e instanceof Error ? e.message.slice(0, 120) : "");
    return { source: "error", members: [], events: [] };
  }
}
