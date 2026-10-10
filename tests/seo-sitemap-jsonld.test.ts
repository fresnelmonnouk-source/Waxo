import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, organizationJsonLd, productJsonLd, safeJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import { buildSitemap } from "@/lib/seo/sitemap-build";
import { absoluteUrl, languageAlternates, localizedPath, siteUrl } from "@/lib/seo/site";

const BASE = "https://exemple.test";

describe("site", () => {
  it("siteUrl : variable explicite, repli Vercel, repli local", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://waxo.example/" })).toBe("https://waxo.example");
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "javascript:alert(1)" })).toBe("http://localhost:3007");
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "waxo.vercel.app" })).toBe("https://waxo.vercel.app");
    expect(siteUrl({})).toBe("http://localhost:3007");
  });
  it("chemins localisés et hreflang", () => {
    expect(localizedPath("fr", "/")).toBe("/fr");
    expect(localizedPath("en", "/catalogue")).toBe("/en/catalogue");
    expect(absoluteUrl("en", "/faq", BASE)).toBe(`${BASE}/en/faq`);
    expect(languageAlternates("/faq", BASE)).toEqual({ fr: `${BASE}/fr/faq`, en: `${BASE}/en/faq`, "x-default": `${BASE}/fr/faq` });
  });
});

describe("sitemap", () => {
  const entries = buildSitemap([{ id: "1", slugs: { fr: "savon-noir", en: "black-soap" } }], BASE);
  it("pages statiques dans les deux langues avec hreflang", () => {
    const home = entries.find((e) => e.url === `${BASE}/fr`)!;
    expect(home.alternates.languages).toMatchObject({ fr: `${BASE}/fr`, en: `${BASE}/en`, "x-default": `${BASE}/fr` });
    expect(entries.some((e) => e.url === `${BASE}/en/catalogue`)).toBe(true);
  });
  it("produits : slug propre à chaque langue", () => {
    const fr = entries.find((e) => e.url === `${BASE}/fr/produit/savon-noir`)!;
    expect(fr.alternates.languages.en).toBe(`${BASE}/en/produit/black-soap`);
    expect(entries.some((e) => e.url === `${BASE}/en/produit/black-soap`)).toBe(true);
  });
  it("n'expose jamais les pages privées", () => {
    for (const e of entries) expect(e.url).not.toMatch(/\/(compte|connexion|inscription|commande|suivi|favoris|admin|api)(\/|$)/);
  });
  it("catalogue indisponible : pages statiques seulement", () => {
    const only = buildSitemap([], BASE);
    expect(only.length).toBeGreaterThan(10);
    expect(only.every((e) => !e.url.includes("/produit/"))).toBe(true);
  });
  it("encode les slugs", () => {
    expect(buildSitemap([{ id: "2", slugs: { fr: "a b/c" } }], BASE).some((e) => e.url === `${BASE}/fr/produit/a%20b%2Fc`)).toBe(true);
  });
});

describe("JSON-LD", () => {
  it("safeJsonLd empêche de fermer la balise script", () => {
    const out = safeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>");
  });
  it("Organization et WebSite", () => {
    expect(organizationJsonLd({ base: BASE })).toMatchObject({ "@type": "Organization", url: BASE, name: "Wá xɔ" });
    expect(websiteJsonLd("fr", BASE)).toMatchObject({ "@type": "WebSite", potentialAction: { "@type": "SearchAction" } });
  });
  it("Product : sku = id, prix XOF, disponibilité, pas de note sans avis", () => {
    const p = { id: "uuid-1", slug: "savon", name: "Savon", price: 2500, stock: 3 };
    const ld = productJsonLd(p, "fr", BASE) as { sku: string; offers: { price: number; priceCurrency: string; availability: string }; aggregateRating?: unknown };
    expect(ld.sku).toBe("uuid-1");
    expect(ld.offers).toMatchObject({ price: 2500, priceCurrency: "XOF", availability: "https://schema.org/InStock" });
    expect(ld.aggregateRating).toBeUndefined();
    expect((productJsonLd({ ...p, stock: 0 }, "fr", BASE) as { offers: { availability: string } }).offers.availability).toBe("https://schema.org/OutOfStock");
    expect(productJsonLd({ ...p, rating: { average: 4.5, count: 10 } }, "fr", BASE)).toHaveProperty("aggregateRating.reviewCount", 10);
    expect(productJsonLd({ ...p, rating: { average: 0, count: 0 } }, "fr", BASE)).not.toHaveProperty("aggregateRating");
  });
  it("BreadcrumbList", () => {
    const b = breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Catalogue", path: "/catalogue" }], "fr", BASE) as { itemListElement: { position: number; item: string }[] };
    expect(b.itemListElement[1]).toMatchObject({ position: 2, item: `${BASE}/fr/catalogue` });
  });
});

describe("pageMetadata", () => {
  it("canonical, hreflang et OpenGraph", () => {
    const m = pageMetadata({ lang: "en", path: "/faq", title: "FAQ", description: "d" });
    expect(m.alternates?.canonical).toContain("/en/faq");
    expect(m.alternates?.languages).toHaveProperty("x-default");
    expect(m.openGraph).toMatchObject({ siteName: "Wá xɔ", locale: "en_GB" });
    expect(m.robots).toBeUndefined();
  });
  it("noindex pour les pages privées", () => {
    expect(pageMetadata({ lang: "fr", path: "/compte", title: "Compte", noindex: true }).robots).toEqual({ index: false, follow: false });
  });
});
