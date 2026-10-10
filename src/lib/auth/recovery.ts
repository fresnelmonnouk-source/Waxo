import { createHmac, timingSafeEqual } from "node:crypto";

/** Cookie court (15 min, httpOnly) posé après un lien de réinitialisation. Sa valeur est SIGNÉE : `userId.exp.hmac`. */
export const RECOVERY_COOKIE = "wx_recovery";
export const RECOVERY_TTL_SECONDS = 15 * 60;

/**
 * Secret de signature : variable dédiée si présente, sinon la clé service_role (déjà secrète, jamais exposée au navigateur).
 * Sans aucun secret → null : on ne pose pas le cookie et l'ancien mot de passe reste exigé (échec sûr).
 */
function secret(): string | null {
  const s = process.env.RECOVERY_COOKIE_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return s ? s : null;
}

function mac(key: string, userId: string, exp: number): string {
  return createHmac("sha256", key).update(`wx_recovery|${userId}|${exp}`).digest("hex");
}

/** Valeur de cookie signée pour cet utilisateur, ou null si aucun secret serveur n'est configuré. */
export function signRecovery(userId: string, now = Date.now()): string | null {
  const key = secret();
  if (!key) return null;
  const exp = Math.floor(now / 1000) + RECOVERY_TTL_SECONDS;
  return `${userId}.${exp}.${mac(key, userId, exp)}`;
}

/** Vrai seulement si la valeur est signée par ce serveur, pour CET utilisateur, et non expirée. */
export function verifyRecovery(value: string | undefined | null, userId: string, now = Date.now()): boolean {
  const key = secret();
  if (!key || !value || !userId) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [uid, expRaw, sig] = parts;
  const exp = Number(expRaw);
  if (uid !== userId || !Number.isInteger(exp) || exp * 1000 < now) return false;
  const expected = Buffer.from(mac(key, userId, exp), "hex");
  const given = Buffer.from(sig, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
