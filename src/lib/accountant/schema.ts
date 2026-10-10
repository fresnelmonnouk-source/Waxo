import { z } from "zod";

export const MAX_BODY_BYTES = 8_000;
export const MAX_MESSAGE_CHARS = 500;
export const MAX_TURNS = 10;

/** Corps de POST /api/admin/accountant : historique borné (≤ 10 tours, ≤ 500 car.), le dernier message est celui de l'utilisateur. */
export const accountantRequestSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().trim().min(1).max(MAX_MESSAGE_CHARS) }).strict())
    .min(1)
    .max(MAX_TURNS),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
}).strict();

/** Limiteur mémoire simple (fenêtre glissante) : suffisant pour un back-office à un ou deux admins. */
const hits = new Map<string, number[]>();
export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 500) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}
export function resetLimiter(): void {
  hits.clear();
}
