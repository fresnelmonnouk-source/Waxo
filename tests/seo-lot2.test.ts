// Chantier SEO du 2026-10-12 (lot 2) : JSON-LD Product/Breadcrumb/FAQ/Organization, métadonnées de page (Open Graph,
// og:url, gabarit « | Waxo », fiche sans texte anglais), sitemap (langues traduites, catalogue vide, campagnes, lastmod).
import { describe, expect, it, vi } from "vitest";

vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.exemple.test");
import {
  faqJsonLd,
  organizationJsonLd,
  packPageJsonLd,
  productPageJsonLd,
  safeJsonLd,
  websiteJsonLd,
} from "@/lib/seo/jsonld";
import { metaDescription, pageMetadata, priceFcfa, seoText, withSeo } from "@/lib/seo/metadata";
import { buildSitemap } from "@/lib/seo/sitemap-build";

const BASE = "https://www.exemple.test";
const UUID = "3f2b8c1e-5a47-4d9a-9b1e-7c2d4e6f8a10";
const LABELS = { home: "Accueil", catalogue: "Catalogue", packs: "Packs" };
const product = { id: UUID, slug: "savon-noir", name: "Savon noir", description: "Un savon.", price: 2500.4, stock: 3, imageUrl: "https://x.supabase.co/p.jpg" };

type Ld = Record<string, unknown> & { offers: Record<string, unknown>; itemListElement: { item: string; name: string }[] };

describe("JSON-LD fiche produit (contrat avec le suivi)", () => {
  const [p, crumbs] = productPageJsonLd(product, { id: "cuisine", label: "Cuisine" }, LABELS, "fr", BASE) as Ld[];
  it("Product : productID = sku = UUID, offre XOF entière, disponibilité, url, image, marque", () => {
    expect(p).toMatchObject({ "@type": "Product", productID: UUID, sku: UUID, name: "Savon noir", image: [product.imageUrl], brand: { name: "Wá xɔ" } });
    expect(p.offers).toEqual(
      expect.objectContaining({ "@type": "Offer", price: 2500, priceCurrency: "XOF", availability: "https://schema.org/InStock", url: `${BASE}/fr/produit/savon-noir` }),
    );
    expect(p.url).toBe(`${BASE}/fr/produit/savon-noir`);
  });
  it("aucune note sans vrais avis ; note seulement à partir des vrais avis passés", () => {
    expect(p).not.toHaveProperty("aggregateRating");
    const [rated] = productPageJsonLd({ ...product, rating: { average: 4.5, count: 2 } }, undefined, LABELS, "fr", BASE);
    expect(rated).toHaveProperty("aggregateRating.reviewCount", 2);
    const [zero] = productPageJsonLd({ ...product, rating: { average: 0, count: 0 } }, undefined, LABELS, "fr", BASE);
    expect(zero).not.toHaveProperty("aggregateRating");
  });
  it("épuisé : OutOfStock", () => {
    const [out] = productPageJsonLd({ ...product, stock: 0 }, undefined, LABELS, "en", BASE) as Ld[];
    expect(out.offers.availability).toBe("https://schema.org/OutOfStock");
  });
  it("fil d'Ariane : Accueil / rayon (?cat=) / produit ; sans rayon, le catalogue", () => {
    expect(crumbs["@type"]).toBe("BreadcrumbList");
    expect(crumbs.itemListElement.map((i) => i.item)).toEqual([`${BASE}/fr`, `${BASE}/fr/catalogue?cat=cuisine`, `${BASE}/fr/produit/savon-noir`]);
    const [, noCat] = productPageJsonLd(product, undefined, LABELS, "fr", BASE) as Ld[];
    expect(noCat.itemListElement[1]).toMatchObject({ name: "Catalogue", item: `${BASE}/fr/catalogue` });
  });
  it("échappement : un nom ne peut pas fermer la balise script", () => {
    const out = safeJsonLd(productPageJsonLd({ ...product, name: "</script><b>" }, undefined, LABELS, "fr", BASE));
    expect(out).not.toContain("</script>");
  });
});

describe("JSON-LD fiche pack", () => {
  it("Product sous /packs/, sku = UUID du pack, fil Accueil / Packs / pack, jamais de note", () => {
    const [p, crumbs] = packPageJsonLd({ id: UUID, slug: "pack-cuisine", name: "Pack cuisine", price: 8900, stock: 0 }, LABELS, "en", BASE) as Ld[];
    expect(p).toMatchObject({ productID: UUID, sku: UUID, url: `${BASE}/en/packs/pack-cuisine` });
    expect(p.offers).toMatchObject({ price: 8900, priceCurrency: "XOF", availability: "https://schema.org/OutOfStock" });
    expect(p).not.toHaveProperty("aggregateRating");
    expect(crumbs.itemListElement.map((i) => i.item)).toEqual([`${BASE}/en`, `${BASE}/en/packs`, `${BASE}/en/packs/pack-cuisine`]);
  });
});

describe("JSON-LD FAQ, Organization, WebSite", () => {
  it("FAQPage : une Question par paire non vide", () => {
    const ld = faqJsonLd([{ question: "Q1 ?", answer: "R1." }, { question: "Q2", answer: " " }]) as { mainEntity: unknown[] };
    expect(ld).toMatchObject({ "@type": "FAQPage" });
    expect(ld.mainEntity).toEqual([{ "@type": "Question", name: "Q1 ?", acceptedAnswer: { "@type": "Answer", text: "R1." } }]);
  });
  it("Organization : graphies « Waxo », logo absolu, zone desservie ; contact seulement s'il est renseigné", () => {
    const org = organizationJsonLd({ base: BASE });
    expect(org).toMatchObject({ alternateName: ["Waxo", "Wa xo"], logo: `${BASE}/icon-512.png` });
    expect(org.areaServed).toEqual([{ "@type": "City", name: "Cotonou" }, { "@type": "City", name: "Abomey-Calavi" }]);
    expect(org).not.toHaveProperty("contactPoint");
    expect(org).not.toHaveProperty("sameAs");
    expect(organizationJsonLd({ base: BASE, email: " ", phone: "" })).not.toHaveProperty("contactPoint");
    expect(organizationJsonLd({ base: BASE, phone: "+2290197000000" })).toHaveProperty("contactPoint.telephone", "+2290197000000");
  });
  it("WebSite : un @id par langue", () => {
    expect(websiteJsonLd("fr", BASE)["@id"]).toBe(`${BASE}/fr#website`);
    expect(websiteJsonLd("en", BASE)["@id"]).toBe(`${BASE}/en#website`);
  });
});

describe("métadonnées de page", () => {
  it("Open Graph et Twitter propres à la page : og:url = canonique, titre « … | Waxo », image produit", () => {
    const m = pageMetadata({ lang: "fr", path: "/produit/savon-noir", title: "Savon noir · 2 500 FCFA", description: "d", image: product.imageUrl });
    expect(m.alternates?.canonical).toBe(`${BASE}/fr/produit/savon-noir`);
    expect(m.openGraph).toMatchObject({ url: `${BASE}/fr/produit/savon-noir`, title: "Savon noir · 2 500 FCFA | Waxo", description: "d", images: [{ url: product.imageUrl }] });
    expect(m.twitter).toMatchObject({ title: "Savon noir · 2 500 FCFA | Waxo", images: [product.imageUrl] });
  });
  it("accueil : titre absolu (sans gabarit) ; sans photo, l'image de partage générée reste posée", () => {
    const m = pageMetadata({ lang: "en", path: "/", title: "Waxo · Shop", absoluteTitle: true });
    expect(m.title).toEqual({ absolute: "Waxo · Shop" });
    expect(m.openGraph).toMatchObject({ title: "Waxo · Shop", url: `${BASE}/en`, images: [{ url: `${BASE}/en/opengraph-image`, width: 1200, height: 630 }] });
    expect(m.twitter).toMatchObject({ images: [`${BASE}/en/opengraph-image`] });
  });
  it("fiche traduite : hreflang avec les deux slugs", () => {
    const m = pageMetadata({ lang: "en", path: "/produit/black-soap", title: "x", languagePaths: { fr: "/produit/savon-noir", en: "/produit/black-soap" } });
    expect(m.alternates?.canonical).toBe(`${BASE}/en/produit/black-soap`);
    expect(m.alternates?.languages).toEqual({ fr: `${BASE}/fr/produit/savon-noir`, en: `${BASE}/en/produit/black-soap`, "x-default": `${BASE}/fr/produit/savon-noir` });
  });
  it("fiche sans texte anglais (S8) : pas d'alternate EN, canonique FR depuis /en", () => {
    const m = pageMetadata({ lang: "en", path: "/produit/savon-noir", title: "x", languagePaths: { fr: "/produit/savon-noir" } });
    expect(m.alternates?.canonical).toBe(`${BASE}/fr/produit/savon-noir`);
    expect(m.alternates?.languages).toEqual({ fr: `${BASE}/fr/produit/savon-noir`, "x-default": `${BASE}/fr/produit/savon-noir` });
    expect(m.openGraph).toMatchObject({ url: `${BASE}/fr/produit/savon-noir` });
  });
  it("withSeo délègue à pageMetadata : Open Graph et og:url posés", () => {
    const m = withSeo({ title: "Contact", description: "d" }, "fr", "/contact");
    expect(m.openGraph).toMatchObject({ url: `${BASE}/fr/contact`, title: "Contact | Waxo" });
  });
  it("textes : « TODO » ignoré, description coupée à un mot, prix FCFA entier", () => {
    expect(seoText("TODO Marcus")).toBeUndefined();
    expect(seoText("  ")).toBeUndefined();
    expect(seoText("Vrai texte")).toBe("Vrai texte");
    const long = metaDescription(`${"mot ".repeat(60)}fin`)!;
    expect(long.length).toBeLessThanOrEqual(155);
    expect(long.endsWith("mot…")).toBe(true);
    expect(metaDescription("Ligne 1\n\nLigne 2")).toBe("Ligne 1 Ligne 2");
    expect(priceFcfa(2500.4, "fr").replace(/\s/g, " ")).toBe("2 500 FCFA");
    expect(priceFcfa(12500, "en")).toBe("12,500 FCFA");
  });
});

describe("sitemap (lot 2)", () => {
  it("fiche sans texte anglais : entrée FR seule, sans alternate EN", () => {
    const e = buildSitemap([{ id: "1", slugs: { fr: "savon-noir" } }], BASE);
    expect(e.some((x) => x.url === `${BASE}/en/produit/savon-noir`)).toBe(false);
    const fr = e.find((x) => x.url === `${BASE}/fr/produit/savon-noir`)!;
    expect(fr.alternates.languages).toEqual({ fr: `${BASE}/fr/produit/savon-noir`, "x-default": `${BASE}/fr/produit/savon-noir` });
  });
  it("lastmod transmis, catalogue vide retiré, campagnes ajoutées dans les deux langues", () => {
    const e = buildSitemap([{ id: "1", slugs: { fr: "a", en: "b" }, updatedAt: "2026-10-12T10:00:00Z" }], BASE, [], { catalogEmpty: true, campaigns: [{ slug: "noel" }] });
    expect(e.find((x) => x.url === `${BASE}/fr/produit/a`)?.lastModified).toBe("2026-10-12T10:00:00Z");
    expect(e.some((x) => x.url.endsWith("/catalogue"))).toBe(false);
    expect(e.find((x) => x.url === `${BASE}/en/campagne/noel`)?.alternates.languages.fr).toBe(`${BASE}/fr/campagne/noel`);
  });
});
