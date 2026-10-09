/**
 * Limiteur de débit en mémoire (fenêtre glissante). Suffisant pour freiner un script naïf sur une instance ;
 * il ne remplace pas un limiteur partagé (Redis/edge) si le trafic le justifie un jour.
 */
export function createRateLimiter(opts: { windowMs: number; max: number }) {
  const hits = new Map<string, number[]>();
  return {
    /** Enregistre un appel pour `key`. Renvoie false si la limite est dépassée. */
    hit(key: string, now: number = Date.now()): boolean {
      if (hits.size > 5000) {
        for (const [k, list] of hits) {
          if (!list.length || now - list[list.length - 1] > opts.windowMs) hits.delete(k);
        }
      }
      const recent = (hits.get(key) ?? []).filter((ts) => now - ts < opts.windowMs);
      if (recent.length >= opts.max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
    reset() {
      hits.clear();
    },
  };
}
