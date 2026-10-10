import { createHash, timingSafeEqual } from "node:crypto";

/** `Authorization: Bearer <CRON_SECRET>` comparé à temps constant (empreintes SHA-256 de même longueur). */
export function cronAuthorized(authHeader: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || !authHeader) return false;
  const m = /^Bearer (.+)$/.exec(authHeader.trim());
  if (!m) return false;
  const a = createHash("sha256").update(m[1]).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}
