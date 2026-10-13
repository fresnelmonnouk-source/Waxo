import "server-only";
import * as Sentry from "@sentry/nextjs";

/**
 * Échec sur le parcours argent (audit Tariq M11) : journal structuré + Sentry. Jamais de donnée client : seulement un
 * chemin, un code et éventuellement le numéro public WX-… (le nettoyage de src/lib/tracking/sentry.ts s'applique en plus).
 * Sans DSN, Sentry est inerte. Ne jette jamais.
 */
export function reportMoneyError(path: string, err: unknown, extra: { order?: string; code?: string } = {}): void {
  const message = err instanceof Error ? err.message.slice(0, 160) : typeof err === "string" ? err.slice(0, 160) : "inconnu";
  console.error(`[money] ${path}${extra.order ? ` order=${extra.order}` : ""}${extra.code ? ` code=${extra.code}` : ""} : ${message}`);
  try {
    const error = err instanceof Error ? err : new Error(message);
    Sentry.captureException(error, { tags: { path, ...(extra.code ? { code: extra.code } : {}) }, extra: extra.order ? { order: extra.order } : undefined });
  } catch {
    /* l'observabilité ne casse jamais le paiement */
  }
}
