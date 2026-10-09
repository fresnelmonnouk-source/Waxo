// Lecture défensive de la réponse de GET /api/me (contrat : `{ user: {...} | null }`, jamais d'erreur visible).
// Le format exact de `user` appartient au module compte : on accepte camelCase et snake_case, et on ne suppose rien.

export type MeUser = { name: string; first: string; phone: string; address: string };

const str = (v: unknown): string => (typeof v === "string" ? v : "");

export function parseMe(json: unknown): MeUser | null {
  const user = (json as { user?: unknown } | null)?.user;
  if (!user || typeof user !== "object") return null;
  const u = user as Record<string, unknown>;
  const first = str(u.firstName ?? u.first_name ?? u.first).trim();
  const last = str(u.lastName ?? u.last_name ?? u.last).trim();
  const name = [first, last].filter(Boolean).join(" ") || str(u.name).trim();
  return { name, first: first || name.split(" ")[0] || "", phone: str(u.phone), address: str(u.address) };
}

/** Récupère l'utilisateur courant ; null si invité, service indisponible ou réponse inattendue. */
export async function fetchMe(signal?: AbortSignal): Promise<MeUser | null> {
  try {
    const res = await fetch("/api/me", { signal, credentials: "same-origin", cache: "no-store" });
    if (!res.ok) return null;
    return parseMe(await res.json());
  } catch {
    return null;
  }
}
