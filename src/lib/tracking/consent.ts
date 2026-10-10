// Consentement aux traceurs : logique PURE (sans accès au navigateur), testée dans tests/tracking-consent.test.ts.
// Régime strict opt-in : sans choix explicite de l'internaute, tout est refusé et aucun script de suivi n'est chargé.

export const CONSENT_STORAGE_KEY = "waxo:consent:v1";
export const CONSENT_COOKIE = "waxo_consent";
/** 6 mois (≈ 182 jours) : durée de validité du choix, puis on redemande. */
export const CONSENT_MAX_AGE_S = 182 * 24 * 60 * 60;
/** Événement `window` qui rouvre le bandeau (lien « Gérer mes cookies » du pied de page). */
export const OPEN_COOKIES_EVENT = "waxo:cookies";
/** Événement `window` émis à chaque changement de choix (détail : ConsentChoice). */
export const CONSENT_CHANGED_EVENT = "waxo:consent";

export type ConsentChoice = {
  /** Mesure d'audience (Google Analytics 4). */
  analytics: boolean;
  /** Publicité (Meta Pixel). */
  marketing: boolean;
};

export type StoredConsent = ConsentChoice & { v: 1; ts: number };

export const NO_CONSENT: ConsentChoice = { analytics: false, marketing: false };

export function makeConsent(choice: ConsentChoice, now: number): StoredConsent {
  return { v: 1, analytics: choice.analytics === true, marketing: choice.marketing === true, ts: now };
}

/** Valide un contenu brut (JSON stocké) ; null si absent, altéré, d'une autre version ou expiré. */
export function parseConsent(raw: unknown, now: number): StoredConsent | null {
  try {
    const o = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
    if (!o || typeof o !== "object") return null;
    const c = o as Partial<StoredConsent>;
    if (c.v !== 1 || typeof c.analytics !== "boolean" || typeof c.marketing !== "boolean") return null;
    if (typeof c.ts !== "number" || !Number.isFinite(c.ts)) return null;
    if (c.ts > now + 60_000) return null; // horloge incohérente : on redemande
    if (now - c.ts > CONSENT_MAX_AGE_S * 1000) return null;
    return { v: 1, analytics: c.analytics, marketing: c.marketing, ts: c.ts };
  } catch {
    return null;
  }
}

/** Forme compacte du cookie : `1.a1.m0.<timestamp>`. */
export function consentToCookieValue(c: StoredConsent): string {
  return `1.a${c.analytics ? 1 : 0}.m${c.marketing ? 1 : 0}.${c.ts}`;
}

export function parseCookieValue(value: string | null | undefined, now: number): StoredConsent | null {
  if (!value) return null;
  const m = /^1\.a([01])\.m([01])\.(\d{10,14})$/.exec(value);
  if (!m) return null;
  return parseConsent({ v: 1, analytics: m[1] === "1", marketing: m[2] === "1", ts: Number(m[3]) }, now);
}

/** Valeur de l'en-tête `Set-Cookie`/`document.cookie` (Secure seulement en HTTPS). */
export function consentCookieString(c: StoredConsent, secure: boolean): string {
  return `${CONSENT_COOKIE}=${consentToCookieValue(c)}; Max-Age=${CONSENT_MAX_AGE_S}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** Extrait le cookie de consentement d'une chaîne `document.cookie`. */
export function readCookieValue(cookieHeader: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === CONSENT_COOKIE) return rest.join("=");
  }
  return null;
}

/** Noms de cookies posés par les outils de suivi (à purger au retrait du consentement). */
export function isTrackingCookieName(name: string): boolean {
  return name === "_fbp" || name === "_fbc" || name === "_ga" || name.startsWith("_ga_") || name === "_gid" || name === "_gat" || name.startsWith("_gat_");
}

/** Identifiants valides : jamais d'injection dans l'URL d'un script via une variable d'environnement mal saisie. */
export function validGaId(id: string | undefined): string | null {
  return id && /^G-[A-Z0-9]{4,20}$/.test(id.trim()) ? id.trim() : null;
}
export function validPixelId(id: string | undefined): string | null {
  return id && /^\d{5,20}$/.test(id.trim()) ? id.trim() : null;
}
