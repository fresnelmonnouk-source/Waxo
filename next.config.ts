import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { headerRules } from "./src/lib/seo/security-headers";
import { withTurnstileHeaders } from "./src/lib/auth/csp-turnstile";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  // Pas d'en-tête « X-Powered-By: Next.js ».
  poweredByHeader: false,
  // Page 404 des URL hors de toute route (src/app/global-not-found.tsx, en français) : ignorée sans ce drapeau.
  experimental: { globalNotFound: true },
  // CSP + en-têtes de sécurité (voir src/lib/seo/security-headers.ts ; vérifiés par tests/seo-security-headers.test.ts),
  // complétés pour le widget Cloudflare Turnstile (script-src / frame-src, src/lib/auth/csp-turnstile.ts).
  async headers() {
    return withTurnstileHeaders(headerRules(isDev));
  },
  // Photos produits servies par Supabase Storage (bucket public) si un composant utilise next/image.
  // Restreint au SEUL projet Waxo (audit Raphaël F5) : `*.supabase.co` laissait /_next/image optimiser les images de
  // n'importe quel projet Supabase, aux frais du quota Vercel.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "btarkkjimnkmiaxzonzq.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
  // Tailwind v4 via le loader Turbopack (installé par le scaffold Next 16.4).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
