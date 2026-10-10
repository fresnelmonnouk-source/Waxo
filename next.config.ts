import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { headerRules } from "./src/lib/seo/security-headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  // Pas d'en-tête « X-Powered-By: Next.js ».
  poweredByHeader: false,
  // CSP + en-têtes de sécurité (voir src/lib/seo/security-headers.ts ; vérifiés par tests/seo-security-headers.test.ts).
  async headers() {
    return headerRules(isDev);
  },
  // Photos produits servies par Supabase Storage (bucket public) si un composant utilise next/image.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }],
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
