// Contrat de retour des server actions du back-office (jamais d'erreur SQL/stack vers le client). Module pur : importable depuis un fichier « use server » ET un composant client.

export type ActionResult<T extends object = Record<never, never>> =
  | ({ ok: true } & T)
  | { ok: false; code: ActionErrorCode; message: string; field?: string };

export type ActionErrorCode = "unauthorized" | "invalid" | "unavailable" | "conflict" | "not_found" | "error";

export const MSG = {
  unauthorized: "Session expirée ou accès refusé. Reconnectez-vous.",
  unavailable: "Base non connectée (mode démo) : modification impossible.",
  error: "Une erreur est survenue. Réessayez dans un instant.",
  invalid: "Données invalides.",
  notFound: "Élément introuvable.",
  conflict: "Cet élément a changé entre-temps. Actualisez la page.",
} as const;

export function fail(code: ActionErrorCode, message?: string, field?: string): { ok: false; code: ActionErrorCode; message: string; field?: string } {
  const fallback =
    code === "unauthorized" ? MSG.unauthorized : code === "unavailable" ? MSG.unavailable : code === "invalid" ? MSG.invalid : code === "not_found" ? MSG.notFound : code === "conflict" ? MSG.conflict : MSG.error;
  return { ok: false, code, message: message ?? fallback, ...(field ? { field } : {}) };
}
