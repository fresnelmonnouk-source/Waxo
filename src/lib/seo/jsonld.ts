// Données structurées schema.org (JSON-LD) : fonctions PURES (tests/seo-sitemap-jsonld.test.ts, tests/seo-lot2.test.ts).
// `safeJsonLd` neutralise `<` pour qu'une valeur ne puisse jamais fermer la balise <script>.
import { watermarkedSrc } from "@/lib/media/product-images";
import { absoluteUrl, siteUrl } from "./site";

export type JsonLdObject = Record<string, unknown>;

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

/** Nom de la marque (logo, texte) et graphies que les gens tapent (« Waxo »), pour les moteurs. */
const BRAND_NAME = "Wá xɔ";
const ALTERNATE_NAMES = ["Waxo", "Wa xo"];
/** Zone desservie par la Livraison Express. */
const AREA_SERVED = [
  { "@type": "City", name: "Cotonou" },
  { "@type": "City", name: "Abomey-Calavi" },
];

export function safeJsonLd(data: JsonLdObject | JsonLdObject[]): string {
  return JSON.stringify(data)
    .replace(/</g, String.fromCharCode(92) + "u003c")
    .split(LS).join(String.fromCharCode(92) + "u2028")
    .split(PS).join(String.fromCharCode(92) + "u2029");
}

export type OrgInput = {
  name?: string;
  email?: string;
  phone?: string;
  base?: string;
  /** Logo : chemin public ou URL absolue (défaut : l'icône 512 px de /public). */
  logo?: string;
  /** Profils officiels (réseaux sociaux) : vide tant qu'ils n'existent pas. */
  sameAs?: string[];
};

/** Organisation. Coordonnées seulement si elles sont renseignées dans les réglages : jamais de valeur inventée. */
export function organizationJsonLd(input: OrgInput = {}): JsonLdObject {
  const base = input.base ?? siteUrl();
  const email = input.email?.trim();
  const phone = input.phone?.trim();
  const contact: JsonLdObject | undefined =
    email || phone
      ? { "@type": "ContactPoint", contactType: "customer service", ...(email ? { email } : {}), ...(phone ? { telephone: phone } : {}), areaServed: "BJ", availableLanguage: ["fr", "en"] }
      : undefined;
  const logo = input.logo ?? "/icon-512.png";
  const sameAs = (input.sameAs ?? []).filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${base}/#organization`,
    name: input.name ?? BRAND_NAME,
    alternateName: ALTERNATE_NAMES,
    url: base,
    logo: logo.startsWith("http") ? logo : `${base}${logo}`,
    areaServed: AREA_SERVED,
    ...(contact ? { contactPoint: contact } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/** Site (un `@id` par langue) + moteur de recherche interne (le catalogue accepte `?q=`). */
export function websiteJsonLd(lang: string, base: string = siteUrl()): JsonLdObject {
  const home = absoluteUrl(lang, "/", base);
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${home}#website`,
    name: BRAND_NAME,
    alternateName: ALTERNATE_NAMES,
    url: home,
    inLanguage: lang,
    publisher: { "@id": `${base}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl(lang, "/catalogue", base)}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export type ProductLdInput = {
  /** UUID du produit (ou du pack) : devient `productID` ET `sku`, lus par le suivi pour `view_item` (contrat du brief). */
  id: string;
  slug: string;
  name: string;
  description?: string;
  /** Prix en XOF entier. */
  price: number;
  stock: number;
  imageUrl?: string | null;
  /** Toutes les photos, couverture en premier (fiche produit) ; prime sur `imageUrl` quand elle est renseignée. */
  images?: readonly string[];
  /** Note des SEULS vrais avis publiés (jamais `rating_seed`). */
  rating?: { average: number; count: number };
};

export type ProductLdOpts = {
  base?: string;
  /** Segment de l'URL de la fiche : `produit` (défaut) ou `packs`. */
  section?: "produit" | "packs";
};

export function productJsonLd(p: ProductLdInput, lang: string, opts: ProductLdOpts | string = {}): JsonLdObject {
  const { base = siteUrl(), section = "produit" } = typeof opts === "string" ? { base: opts } : opts;
  const url = absoluteUrl(lang, `/${section}/${encodeURIComponent(p.slug)}`, base);
  const abs = (u: string) => (u.startsWith("http") ? u : `${base}${u}`);
  const sources = p.images?.length ? p.images : p.imageUrl ? [p.imageUrl] : [];
  // Photos du bucket public : versions filigranées (/api/img, 1 200 px), comme sur la boutique.
  const image = [...new Set(sources.filter(Boolean).map((u) => abs(watermarkedSrc(u, 1200))))];
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    productID: p.id,
    sku: p.id,
    name: p.name,
    ...(p.description ? { description: p.description.slice(0, 500) } : {}),
    ...(image.length ? { image } : {}),
    url,
    brand: { "@type": "Brand", name: BRAND_NAME },
    offers: {
      "@type": "Offer",
      url,
      price: Math.round(p.price),
      priceCurrency: "XOF",
      availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
    // Uniquement si de vrais avis existent : jamais de note inventée.
    ...(p.rating && p.rating.count > 0 && p.rating.average > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating.average, reviewCount: p.rating.count, bestRating: 5, worstRating: 1 } }
      : {}),
  };
}

/** Fil d'Ariane. `path` peut porter une requête (`/catalogue?cat=cuisine`) : le rayon n'a pas encore de page propre. */
export function breadcrumbJsonLd(items: { name: string; path: string }[], lang: string, base: string = siteUrl()): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(lang, it.path, base) })),
  };
}

/** FAQ : questions et réponses en texte brut (les mêmes que celles affichées sur la page). */
export function faqJsonLd(items: { question: string; answer: string }[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items
      .filter((it) => it.question.trim() && it.answer.trim())
      .map((it) => ({ "@type": "Question", name: it.question, acceptedAnswer: { "@type": "Answer", text: it.answer } })),
  };
}

export type CrumbLabels = { home: string; catalogue: string; packs: string };

/** JSON-LD complet d'une fiche produit : Product + BreadcrumbList (Accueil / rayon / produit). */
export function productPageJsonLd(
  p: ProductLdInput & { categoryId?: string },
  category: { id: string; label: string } | undefined,
  labels: CrumbLabels,
  lang: string,
  base: string = siteUrl(),
): JsonLdObject[] {
  const crumbs = [
    { name: labels.home, path: "/" },
    category ? { name: category.label, path: `/catalogue?cat=${encodeURIComponent(category.id)}` } : { name: labels.catalogue, path: "/catalogue" },
    { name: p.name, path: `/produit/${encodeURIComponent(p.slug)}` },
  ];
  return [productJsonLd(p, lang, { base }), breadcrumbJsonLd(crumbs, lang, base)];
}

/** JSON-LD complet d'une fiche pack : Product (sku = UUID du pack) + BreadcrumbList (Accueil / Packs / pack). Pas de note. */
export function packPageJsonLd(p: Omit<ProductLdInput, "rating">, labels: CrumbLabels, lang: string, base: string = siteUrl()): JsonLdObject[] {
  const crumbs = [
    { name: labels.home, path: "/" },
    { name: labels.packs, path: "/packs" },
    { name: p.name, path: `/packs/${encodeURIComponent(p.slug)}` },
  ];
  return [productJsonLd(p, lang, { base, section: "packs" }), breadcrumbJsonLd(crumbs, lang, base)];
}
