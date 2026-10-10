import "server-only";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { withTimeout } from "@/lib/auth/timeout";
import { rateLimit as memoryRateLimit } from "@/lib/checkout/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Limiteur de débit PARTAGÉ (fonction SQL `rate_hit`, migration 0009) : sur serverless chaque instance a sa propre mémoire,
 * un limiteur en Map ne freine donc personne. Un seul aller-retour Supabase, fenêtre fixe, atomique.
 *
 * Panne-tolérant : si Supabase n'est pas configuré, la migration 0009 n'est pas appliquée, ou si l'appel dépasse
 * RPC_TIMEOUT_MS, on retombe sur le limiteur en mémoire (frein par instance) — le limiteur ne doit jamais devenir la
 * cause d'une panne. Après un échec, le partagé est ignoré DOWN_FOR_MS pour ne pas ajouter RPC_TIMEOUT_MS à chaque requête.
 */

const RPC_TIMEOUT_MS = 800;
const DOWN_FOR_MS = 30_000;
let downUntil = 0;

/** true/false = décision du limiteur partagé ; null = indisponible (l'appelant utilise le repli mémoire). */
async function sharedHit(key: string, max: number, windowSeconds: number): Promise<boolean | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  if (Date.now() < downUntil) return null;
  try {
    const { data, error } = await withTimeout(
      createAdminClient().rpc("rate_hit", { p_key: key, p_max: max, p_window_seconds: windowSeconds }),
      RPC_TIMEOUT_MS,
    );
    if (error || typeof data !== "boolean") {
      downUntil = Date.now() + DOWN_FOR_MS;
      return null;
    }
    return data;
  } catch {
    downUntil = Date.now() + DOWN_FOR_MS;
    return null;
  }
}

/** Tests uniquement : remet à zéro l'état « partagé indisponible ». */
export function resetSharedLimiterState(): void {
  downUntil = 0;
}

/** Limiteur nommé (le nom préfixe la clé : deux routes n'écrasent pas leurs compteurs). `hit` : false = limite atteinte. */
export function createSharedLimiter(opts: { name: string; windowMs: number; max: number }) {
  const mem = createRateLimiter({ windowMs: opts.windowMs, max: opts.max });
  const windowSeconds = Math.max(1, Math.ceil(opts.windowMs / 1000));
  return {
    async hit(key: string): Promise<boolean> {
      const shared = await sharedHit(`${opts.name}:${key}`, opts.max, windowSeconds);
      return shared ?? mem.hit(key);
    },
    reset() {
      mem.reset();
    },
  };
}

/** Variante à clé complète pour les routes qui composent leur propre clé (`checkout:<ip>`). */
export async function rateLimitShared(key: string, limit: number, windowMs: number): Promise<boolean> {
  const shared = await sharedHit(key, limit, Math.max(1, Math.ceil(windowMs / 1000)));
  return shared ?? memoryRateLimit(key, limit, windowMs);
}
