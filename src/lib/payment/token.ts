import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Jeton de suivi du retour de paiement : HMAC(secret, numéro de commande). Il est placé dans l'URL de retour
 * (`/commande/merci?n=WX-…&k=…`) afin que le statut d'une commande ne soit pas lisible en devinant son numéro (séquentiel).
 * Secret = FEDAPAY_WEBHOOK_SECRET, à défaut FEDAPAY_SECRET_KEY. Sans secret : pas de jeton (mode mock).
 */

function secret(source: Record<string, string | undefined>): string | null {
  return source.FEDAPAY_WEBHOOK_SECRET?.trim() || source.FEDAPAY_SECRET_KEY?.trim() || null;
}

export function orderStatusToken(number: string, source: Record<string, string | undefined> = process.env): string | null {
  const key = secret(source);
  if (!key) return null;
  return createHmac("sha256", key).update(`order-status:${number}`).digest("hex").slice(0, 32);
}

export function verifyOrderStatusToken(
  number: string,
  token: string,
  source: Record<string, string | undefined> = process.env,
): boolean {
  const expected = orderStatusToken(number, source);
  if (!expected || token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
