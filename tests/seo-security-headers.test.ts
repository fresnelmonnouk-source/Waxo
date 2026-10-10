import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";
import { buildCsp, headerRules, securityHeaders } from "@/lib/seo/security-headers";

const parseCsp = (csp: string) => Object.fromEntries(csp.split(";").map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
const byKey = (list: { key: string; value: string }[]) => Object.fromEntries(list.map((h) => [h.key, h.value]));

describe("CSP", () => {
  const prod = parseCsp(buildCsp(false));
  it("script-src : 'unsafe-inline' (RSC) + GA/Meta uniquement, pas d'eval en production", () => {
    expect(prod["script-src"]).toContain("'self'");
    expect(prod["script-src"]).toContain("'unsafe-inline'");
    expect(prod["script-src"]).toContain("https://www.googletagmanager.com");
    expect(prod["script-src"]).toContain("https://connect.facebook.net");
    expect(prod["script-src"]).not.toContain("'unsafe-eval'");
    expect(prod["script-src"].filter((s) => s.startsWith("http")).length).toBe(2);
  });
  it("'unsafe-eval' seulement en développement", () => {
    expect(parseCsp(buildCsp(true))["script-src"]).toContain("'unsafe-eval'");
  });
  it("img-src et connect-src incluent Supabase, GA, Meta, Sentry", () => {
    expect(prod["img-src"]).toContain("https://*.supabase.co");
    expect(prod["img-src"]).toContain("data:");
    expect(prod["connect-src"]).toContain("https://*.supabase.co");
    expect(prod["connect-src"]).toContain("wss://*.supabase.co");
    expect(prod["connect-src"]).toContain("https://www.facebook.com");
    expect(prod["connect-src"]).toContain("https://*.google-analytics.com");
    expect(prod["connect-src"]).toContain("https://*.sentry.io");
  });
  it("verrous : frame-ancestors none, object-src none, base-uri self, jamais de joker global", () => {
    expect(prod["frame-ancestors"]).toEqual(["'none'"]);
    expect(prod["object-src"]).toEqual(["'none'"]);
    expect(prod["base-uri"]).toEqual(["'self'"]);
    expect(prod["default-src"]).toEqual(["'self'"]);
    expect(buildCsp(false)).not.toMatch(/(^|\s)\*(\s|;|$)/);
    expect(prod["upgrade-insecure-requests"]).toBeDefined();
  });
});

describe("en-têtes de sécurité", () => {
  const h = byKey(securityHeaders(false));
  it("jeu complet en production", () => {
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toContain("camera=()");
    expect(h["Permissions-Policy"]).toContain("geolocation=()");
    expect(h["Strict-Transport-Security"]).toMatch(/max-age=\d{7,}/);
    expect(h["Content-Security-Policy"]).toBeTruthy();
  });
  it("pas de HSTS en développement", () => {
    expect(byKey(securityHeaders(true))["Strict-Transport-Security"]).toBeUndefined();
  });
  it("règle appliquée à toutes les routes", () => {
    expect(headerRules(false)).toHaveLength(1);
    expect(headerRules(false)[0].source).toBe("/:path*");
  });
});

describe("next.config.ts", () => {
  it("supprime X-Powered-By et expose les en-têtes générés", async () => {
    const cfg = nextConfig as { poweredByHeader?: boolean; headers?: () => Promise<{ source: string; headers: { key: string; value: string }[] }[]> };
    expect(cfg.poweredByHeader).toBe(false);
    const rules = await cfg.headers!();
    const all = byKey(rules.flatMap((r) => r.headers));
    expect(all["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(all["X-Content-Type-Options"]).toBe("nosniff");
  });
});
