import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Jetons des liens privés /{lang}/discussion/{jeton}.
 * - 32 octets aléatoires (crypto), encodés en base64url : 43 caractères, ~256 bits, impossibles à deviner.
 * - Seul le SHA-256 (hex) est stocké (table conversation_links) : une fuite de la base ne donne aucun lien utilisable.
 * - Un nouveau jeton par e-mail envoyé au client (le serveur ne peut pas relire un jeton passé) ; les anciens restent valides.
 */

export const TOKEN_BYTES = 32;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const HASH_RE = /^[0-9a-f]{64}$/;

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** Forme seulement (pas de requête en base pour une chaîne qui ne peut pas être un jeton). */
export function isTokenShape(v: unknown): v is string {
  return typeof v === "string" && TOKEN_RE.test(v);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Comparaison en temps constant de deux empreintes hex (filet de sécurité après la recherche en base). */
export function safeEqualHex(a: string, b: string): boolean {
  if (!HASH_RE.test(a) || !HASH_RE.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/** Chemin public du fil (avec langue). */
export function discussionPath(lang: "fr" | "en", token: string): string {
  return `/${lang}/discussion/${token}`;
}
