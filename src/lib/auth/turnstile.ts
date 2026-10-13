import "server-only";

/**
 * Cloudflare Turnstile (audit Raphaël M1 / O2) : CAPTCHA sur la commande et l'inscription.
 * INERTE SANS CLÉS : il faut LES DEUX (NEXT_PUBLIC_TURNSTILE_SITE_KEY pour le widget, TURNSTILE_SECRET_KEY pour la
 * vérification). Avec une seule des deux, rien n'est exigé : jamais de formulaire bloqué par une config à moitié posée.
 *
 * Cloudflare injoignable (délai dépassé, 5xx) : on laisse passer (« unavailable ») et on journalise ; les limiteurs de
 * débit restent en place. Un jeton absent ou refusé par Cloudflare est, lui, toujours bloquant.
 */

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 4000;

type Env = Record<string, string | undefined>;

export function turnstileSecret(source: Env = process.env): string | null {
  const secret = source.TURNSTILE_SECRET_KEY?.trim();
  const site = source.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  return secret && site ? secret : null;
}

/** Clé de site à donner au widget, seulement si la vérification serveur est aussi configurée (sinon : aucun widget). */
export function turnstileSiteKey(source: Env = process.env): string | null {
  return turnstileSecret(source) ? (source.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? null) : null;
}

export type TurnstileVerdict = "disabled" | "ok" | "missing" | "invalid" | "unavailable";

/** Le formulaire peut-il continuer ? Seuls un jeton absent ou refusé bloquent. */
export const turnstilePasses = (v: TurnstileVerdict): boolean => v === "disabled" || v === "ok" || v === "unavailable";

export async function verifyTurnstile(
  token: unknown,
  ip: string | null,
  opts: { source?: Env; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<TurnstileVerdict> {
  const secret = turnstileSecret(opts.source);
  if (!secret) return "disabled";
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return "missing";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? TIMEOUT_MS);
  try {
    const form = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") form.set("remoteip", ip);
    const res = await (opts.fetchImpl ?? fetch)(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: form,
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[turnstile] siteverify HTTP ${res.status}`);
      return "unavailable";
    }
    const data = (await res.json()) as { success?: unknown; "error-codes"?: unknown };
    if (data.success === true) return "ok";
    const codes = Array.isArray(data["error-codes"]) ? data["error-codes"].filter((c): c is string => typeof c === "string") : [];
    // Erreur de NOTRE configuration (secret faux) : ne pas faire payer le client, mais le signaler.
    if (codes.some((c) => c === "missing-input-secret" || c === "invalid-input-secret" || c === "internal-error")) {
      console.error(`[turnstile] configuration : ${codes.join(",").slice(0, 120)}`);
      return "unavailable";
    }
    return "invalid";
  } catch {
    console.error("[turnstile] siteverify injoignable");
    return "unavailable";
  } finally {
    clearTimeout(timer);
  }
}
