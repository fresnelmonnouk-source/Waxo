import type { MetadataRoute } from "next";
import { PRIVATE_PATH_PREFIXES, siteUrl } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  const privateLocalized = ["fr", "en"].flatMap((l) => PRIVATE_PATH_PREFIXES.map((p) => `/${l}${p}`));
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", ...privateLocalized] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
