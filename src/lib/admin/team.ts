// Équipe d'administration : règles PURES (testées dans tests/admin-team.test.ts). Aucun accès base ici.

export type TeamAction = "grant" | "invite" | "revoke";

export type TeamMember = {
  id: string;
  email: string;
  name: string;
  /** « invited » : invitation pas encore acceptée (jamais connecté). */
  status: "active" | "invited";
  lastSignInAt: string | null;
  isMe: boolean;
};

export type TeamEvent = { at: string; action: TeamAction; actorEmail: string; targetEmail: string };

export type TeamData = { source: "db" | "demo" | "error"; members: TeamMember[]; events: TeamEvent[] };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** E-mail normalisé (minuscules, sans espaces) ou null s'il est invalide. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  return e.length >= 3 && e.length <= 254 && EMAIL.test(e) ? e : null;
}

/** Peut-on retirer `targetId` ? Jamais soi-même, jamais le dernier admin (la base le refuse aussi : trigger 0012). */
export function revokeDecision(args: { actorId: string; targetId: string; adminIds: string[] }): "ok" | "self" | "last" | "not_admin" {
  if (args.actorId === args.targetId) return "self";
  if (!args.adminIds.includes(args.targetId)) return "not_admin";
  if (args.adminIds.length <= 1) return "last";
  return "ok";
}

/** Que faire pour un e-mail donné : promouvoir un compte existant, inviter, ou refuser. */
export function addDecision(
  user: { emailConfirmed: boolean; invited: boolean; isAdmin: boolean } | null,
): "invite" | "grant" | "already" | "unconfirmed" {
  if (!user) return "invite";
  if (user.isAdmin) return "already";
  // Compte jamais confirmé (ni invité) : adresse non prouvée. Il est promu comme les autres comptes existants, mais
  // TOUJOURS verrouillé d'abord (mot de passe aléatoire + sessions coupées + lien de réinitialisation : voir actions.ts).
  if (!user.emailConfirmed && !user.invited) return "unconfirmed";
  return "grant";
}

export const ACTION_LABEL: Record<TeamAction, string> = {
  grant: "a donné l'accès admin à",
  invite: "a invité comme admin",
  revoke: "a retiré l'accès admin de",
};
