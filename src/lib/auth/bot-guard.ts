/**
 * Anti-spam des formulaires publics : champ piège caché `website` (jamais rempli par un humain)
 * + délai minimal entre l'affichage du formulaire (`t`, horodatage client en ms) et l'envoi.
 * Module pur (testable avec une horloge injectée).
 */
export const MIN_FILL_MS = 2500;

export type BotVerdict = "ok" | "honeypot" | "tooFast";

export function checkBot(body: unknown, now: number = Date.now()): BotVerdict {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (typeof b.website === "string" && b.website.trim() !== "") return "honeypot";
  const t = Number(b.t);
  if (!Number.isFinite(t)) return "tooFast";
  const elapsed = now - t;
  // Seul un envoi réellement trop rapide (selon l'horloge du serveur) est refusé. Une horloge client en avance
  // (elapsed < 0) ne prouve rien : on accepte ; honeypot et limiteurs restent les freins.
  if (elapsed >= 0 && elapsed < MIN_FILL_MS) return "tooFast";
  return "ok";
}
