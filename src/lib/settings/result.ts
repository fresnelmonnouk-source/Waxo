// Contrat de retour des server actions du back-office (jamais d'erreur SQL/stack côté client).
export type ActionCode = "unauthorized" | "unavailable" | "invalid" | "not_found" | "rate_limited" | "error";
export type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; code: ActionCode; message: string; fieldErrors?: Record<string, string> };

export const UNAVAILABLE_MESSAGE = "Base non connectée (mode démo).";
export const MESSAGES: Record<ActionCode, string> = {
  unauthorized: "Session expirée. Reconnectez-vous.",
  unavailable: UNAVAILABLE_MESSAGE,
  invalid: "Données invalides.",
  not_found: "Élément introuvable.",
  rate_limited: "Trop de tentatives. Réessayez dans quelques minutes.",
  error: "Une erreur est survenue. Réessayez.",
};

export function fail(code: ActionCode, message?: string, fieldErrors?: Record<string, string>): { ok: false; code: ActionCode; message: string; fieldErrors?: Record<string, string> } {
  return { ok: false, code, message: message ?? MESSAGES[code], ...(fieldErrors ? { fieldErrors } : {}) };
}

/** Identifiant uuid (forme seulement : accepte aussi les ids déterministes de seed). */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
