import { describe, expect, it } from "vitest";
import {
  CONSENT_MAX_AGE_S,
  consentCookieString,
  consentToCookieValue,
  isTrackingCookieName,
  makeConsent,
  parseConsent,
  parseCookieValue,
  readCookieValue,
  validGaId,
  validPixelId,
} from "@/lib/tracking/consent";

const NOW = 1_800_000_000_000;

describe("consentement : stockage", () => {
  it("fait l'aller-retour JSON et cookie", () => {
    const c = makeConsent({ analytics: true, marketing: false }, NOW);
    expect(parseConsent(JSON.stringify(c), NOW + 1000)).toEqual(c);
    expect(parseCookieValue(consentToCookieValue(c), NOW + 1000)).toEqual(c);
  });
  it("refuse les contenus absents, altérés ou d'une autre version", () => {
    expect(parseConsent(null, NOW)).toBeNull();
    expect(parseConsent("pas du json", NOW)).toBeNull();
    expect(parseConsent({ v: 2, analytics: true, marketing: true, ts: NOW }, NOW)).toBeNull();
    expect(parseConsent({ v: 1, analytics: "oui", marketing: true, ts: NOW }, NOW)).toBeNull();
    expect(parseCookieValue("1.a1.m1", NOW)).toBeNull();
    expect(parseCookieValue("1.a2.m1.1800000000000", NOW)).toBeNull();
  });
  it("expire après 6 mois et rejette une date du futur", () => {
    const c = makeConsent({ analytics: true, marketing: true }, NOW);
    expect(parseConsent(c, NOW + CONSENT_MAX_AGE_S * 1000 - 1)).not.toBeNull();
    expect(parseConsent(c, NOW + CONSENT_MAX_AGE_S * 1000 + 1)).toBeNull();
    expect(parseConsent(c, NOW - 10 * 60_000)).toBeNull();
  });
  it("cookie : 6 mois, SameSite, Secure seulement en HTTPS", () => {
    const c = makeConsent({ analytics: false, marketing: false }, NOW);
    const https = consentCookieString(c, true);
    expect(https).toContain(`Max-Age=${CONSENT_MAX_AGE_S}`);
    expect(https).toContain("SameSite=Lax");
    expect(https).toContain("Secure");
    expect(consentCookieString(c, false)).not.toContain("Secure");
    expect(CONSENT_MAX_AGE_S).toBeGreaterThanOrEqual(180 * 86400);
  });
  it("lit le cookie dans document.cookie", () => {
    expect(readCookieValue("a=1; waxo_consent=1.a1.m0.1800000000000; b=2")).toBe("1.a1.m0.1800000000000");
    expect(readCookieValue("a=1")).toBeNull();
  });
});

describe("identifiants et cookies de suivi", () => {
  it("n'accepte que des identifiants bien formés (pas d'injection dans l'URL du script)", () => {
    expect(validGaId("G-ABC123XYZ")).toBe("G-ABC123XYZ");
    expect(validGaId("G-ABC&x=1")).toBeNull();
    expect(validGaId("UA-1234")).toBeNull();
    expect(validGaId(undefined)).toBeNull();
    expect(validPixelId("1234567890123")).toBe("1234567890123");
    expect(validPixelId("12'); alert(1)//")).toBeNull();
    expect(validPixelId("")).toBeNull();
  });
  it("reconnaît les cookies GA / Meta à purger, pas les autres", () => {
    for (const n of ["_ga", "_ga_ABC123", "_gid", "_fbp", "_fbc"]) expect(isTrackingCookieName(n)).toBe(true);
    for (const n of ["waxo_consent", "sb-access-token", "NEXT_LOCALE"]) expect(isTrackingCookieName(n)).toBe(false);
  });
});
