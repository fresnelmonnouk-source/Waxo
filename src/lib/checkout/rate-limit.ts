// Limiteur mémoire minimal (par processus, fenêtre glissante). Frein anti-abus léger : sur serverless
// chaque instance a sa propre mémoire, la vraie protection reste honeypot + délai + validation + base.

const buckets = new Map<string, number[]>();
const MAX_KEYS = 5000;

/** Renvoie true si l'appel est autorisé (et le compte), false si la limite est atteinte. */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > MAX_KEYS) {
    // Purge simple pour borner la mémoire.
    for (const [k, v] of buckets) {
      if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
    }
  }
  return true;
}

export function resetRateLimit(): void {
  buckets.clear();
}

/**
 * IP du client. Sur Vercel `x-vercel-forwarded-for` / `x-real-ip` sont écrits par la plateforme (non falsifiables) ;
 * `x-forwarded-for` n'est qu'un dernier recours. « unknown » si rien : seau commun, volontairement plus strict pour tous.
 */
export function clientIp(headers: Headers): string {
  const pick = (v: string | null) => v?.split(",")[0]?.trim().slice(0, 64) || "";
  return pick(headers.get("x-vercel-forwarded-for")) || pick(headers.get("x-real-ip")) || pick(headers.get("x-forwarded-for")) || "unknown";
}
