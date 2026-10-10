// Anti-doublon (orderId, kind) en mémoire du processus. Filet complémentaire de l'en-tête Idempotency-Key de Resend
// (qui, lui, protège entre instances pendant 24 h).

const sent = new Map<string, number>();
const inFlight = new Set<string>();
const TTL_MS = 24 * 60 * 60_000;
const MAX = 5000;

export const emailKey = (orderId: string, kind: string): string => `${orderId}:${kind}`;

/** Réserve l'envoi. false = déjà envoyé (ou en cours) pour cette clé. */
export function claimEmail(key: string, now = Date.now()): boolean {
  const at = sent.get(key);
  if (at !== undefined && now - at < TTL_MS) return false;
  if (inFlight.has(key)) return false;
  inFlight.add(key);
  return true;
}

export function confirmEmail(key: string, now = Date.now()): void {
  inFlight.delete(key);
  sent.set(key, now);
  if (sent.size > MAX) {
    for (const [k, t] of sent) if (now - t >= TTL_MS) sent.delete(k);
  }
}

/** Échec d'envoi : libère la clé pour qu'un nouvel essai soit possible. */
export function releaseEmail(key: string): void {
  inFlight.delete(key);
}

export function resetEmailGuard(): void {
  sent.clear();
  inFlight.clear();
}
