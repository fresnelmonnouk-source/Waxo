/**
 * Anti-spam des formulaires publics : champ piège caché `website` (jamais rempli par un humain)
 * + délai minimal entre l'affichage du formulaire (`t`, horodatage client en ms) et l'envoi.
 * Module pur (testable avec une horloge injectée).
 */
export const MIN_FILL_MS = 2500;
/** Tolérance d'horloge client très en avance : on ne bloque pas un vrai visiteur dont l'heure est fausse. */
const MAX_CLOCK_SKEW_MS = 10 * 60 * 1000;

export type BotVerdict = "ok" | "honeypot" | "tooFast";

export function checkBot(body: unknown, now: number = Date.now()): BotVerdict {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (typeof b.website === "string" && b.website.trim() !== "") return "honeypot";
  const t = Number(b.t);
  if (!Number.isFinite(t)) return "tooFast";
  const elapsed = now - t;
  if (elapsed < MIN_FILL_MS && elapsed > -MAX_CLOCK_SKEW_MS) return "tooFast";
  return "ok";
}
