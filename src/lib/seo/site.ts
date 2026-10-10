// URL publique du site et chemins indexables. Fonctions PURES (testées dans tests/seo-*.test.ts).

export const LOCALES = ["fr", "en"] as const;
export type SeoLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: SeoLocale = "fr";

/** Pages publiques indexables (chemins sans langue). Les pages de compte, de commande et d'admin n'y figurent JAMAIS. */
export const STATIC_PUBLIC_PATHS = [
  "/",
  "/catalogue",
  "/packs",
  "/contact",
  "/faq",
  "/a-propos",
  "/livraison-retours",
  "/cgv",
  "/cgu",
  "/confidentialite",
  "/mentions-legales",
] as const;

/** Préfixes à ne pas indexer (robots + metadata `noindex` côté pages concernées). */
export const PRIVATE_PATH_PREFIXES = ["/compte", "/connexion", "/inscription", "/commande", "/suivi", "/favoris"] as const;

/** Origine du site, sans slash final. NEXT_PUBLIC_SITE_URL (https://…) en production ; repli Vercel puis localhost (dev). */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit && /^https?:\/\/[^\s/]+/.test(explicit)) return explicit.replace(/\/+$/, "");
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel && /^[a-z0-9.-]+$/i.test(vercel)) return `https://${vercel}`;
  return "http://localhost:3007";
}

/** Chemin avec langue : `localizedPath("fr", "/")` → `/fr`, `localizedPath("en", "/catalogue")` → `/en/catalogue`. */
export function localizedPath(lang: string, path: string): string {
  const p = path === "/" || path === "" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `/${lang}${p}`;
}

export function absoluteUrl(lang: string, path: string, base: string = siteUrl()): string {
  return `${base}${localizedPath(lang, path)}`;
}

/** Alternatives hreflang d'une page, `x-default` = français. */
export function languageAlternates(path: string, base: string = siteUrl()): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of LOCALES) out[l] = absoluteUrl(l, path, base);
  out["x-default"] = absoluteUrl(DEFAULT_LOCALE, path, base);
  return out;
}
