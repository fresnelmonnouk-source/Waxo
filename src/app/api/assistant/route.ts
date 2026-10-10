import { fail, json, clientIp, readJson } from "@/lib/auth/http";
import { createSharedLimiter } from "@/lib/ratelimit";
import { answer } from "@/lib/assistant/answer";
import { requestSchema } from "@/lib/assistant/schema";

export const maxDuration = 10;

// Deux fenêtres par IP : rafale (15 / minute) et plafond horaire (60 / heure, borne le coût du modèle).
const burst = createSharedLimiter({ name: "assistant-burst", windowMs: 60_000, max: 15 });
const hourly = createSharedLimiter({ name: "assistant-hourly", windowMs: 3_600_000, max: 60 });

/**
 * Assistant client. Aucune donnée personnelle ni cookie : l'historique (≤ 10 tours, ≤ 500 caractères) vient du navigateur,
 * rien n'est stocké. Les montants et les produits viennent du catalogue, jamais du client ni du modèle.
 */
export async function POST(req: Request) {
  const body = await readJson(req, 12_000);
  if (!body) return fail("invalid", 400);
  const ip = clientIp(req);
  if (!(await burst.hit(ip)) || !(await hourly.hit(ip))) return fail("rateLimited", 429);

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return fail("invalid", 422);

  try {
    return json(await answer(parsed.data));
  } catch {
    return fail("unavailable", 503);
  }
}
