// CSP et en-têtes de sécurité (importé par next.config.ts via un chemin RELATIF : pas d'alias @ dans la config).
// Fonctions PURES, testées dans tests/seo-security-headers.test.ts.
//
// script-src garde 'unsafe-inline' : obligatoire avec l'App Router (scripts inline RSC/hydratation) tant qu'on n'utilise pas
// de nonce — ce qui rendrait toutes les pages dynamiques. Les sources externes sont limitées à GA4, Meta et Sentry.

export type HeaderRule = { source: string; headers: { key: string; value: string }[] };

const GA_SCRIPT = ["https://www.googletagmanager.com"];
const GA_CONNECT = ["https://www.google-analytics.com", "https://*.google-analytics.com", "https://*.analytics.google.com", "https://*.googletagmanager.com"];
const META_SCRIPT = ["https://connect.facebook.net"];
const META_CONNECT = ["https://www.facebook.com", "https://connect.facebook.net"];
const SENTRY_CONNECT = ["https://*.sentry.io", "https://*.ingest.sentry.io", "https://*.ingest.de.sentry.io", "https://*.ingest.us.sentry.io"];
const SUPABASE = ["https://*.supabase.co"];
const SUPABASE_WS = ["wss://*.supabase.co"];

export function buildCsp(isDev: boolean): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : []), ...GA_SCRIPT, ...META_SCRIPT],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...SUPABASE, "https://www.google-analytics.com", "https://*.google-analytics.com", "https://*.googletagmanager.com", "https://www.facebook.com"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...SUPABASE, ...SUPABASE_WS, ...GA_CONNECT, ...META_CONNECT, ...SENTRY_CONNECT, ...(isDev ? ["ws:", "http://localhost:*"] : [])],
    "media-src": ["'self'", ...SUPABASE],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!isDev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

export function securityHeaders(isDev: boolean): { key: string; value: string }[] {
  const list = [
    { key: "Content-Security-Policy", value: buildCsp(isDev) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
    { key: "X-DNS-Prefetch-Control", value: "on" },
  ];
  // HSTS seulement en production : en dev (http://localhost) il ferait mémoriser « https only » au navigateur.
  if (!isDev) list.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
  return list;
}

export function headerRules(isDev: boolean): HeaderRule[] {
  return [{ source: "/:path*", headers: securityHeaders(isDev) }];
}
