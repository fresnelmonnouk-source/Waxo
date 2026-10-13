// Ajout de Cloudflare Turnstile à la CSP (audit M1). Pur, sans alias `@` : importé par next.config.ts via un chemin relatif.
// La CSP de base vit dans src/lib/seo/security-headers.ts ; on la complète ici plutôt que de la dupliquer.

export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

type Header = { key: string; value: string };
type Rule = { source: string; headers: Header[] };

/** Ajoute `src` à la directive `name` (créée si absente, sans doublon). */
function addSource(csp: string, name: string, src: string, base: string[] = []): string {
  const parts = csp.split(";").map((p) => p.trim()).filter(Boolean);
  const i = parts.findIndex((p) => p.split(/\s+/)[0] === name);
  if (i < 0) return [...parts, [name, ...base, src].join(" ")].join("; ");
  const tokens = parts[i].split(/\s+/);
  if (!tokens.includes(src)) parts[i] = [...tokens, src].join(" ");
  return parts.join("; ");
}

/** script-src et frame-src autorisent le widget Turnstile (le script ne se charge que sur les formulaires concernés). */
export function withTurnstileCsp(csp: string): string {
  return addSource(addSource(csp, "script-src", TURNSTILE_ORIGIN), "frame-src", TURNSTILE_ORIGIN, ["'self'"]);
}

export function withTurnstileHeaders<T extends Rule>(rules: T[]): T[] {
  return rules.map((r) => ({
    ...r,
    headers: r.headers.map((h) => (h.key === "Content-Security-Policy" ? { ...h, value: withTurnstileCsp(h.value) } : h)),
  }));
}
