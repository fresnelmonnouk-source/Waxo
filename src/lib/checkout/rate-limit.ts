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

/** IP du client derrière le proxy (Vercel renseigne x-forwarded-for). « unknown » si absente. */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  const first = fwd?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip")?.trim() || "unknown";
}
