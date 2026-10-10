// Données structurées schema.org (JSON-LD) : fonctions PURES.
// `safeJsonLd` neutralise `<` pour qu'une valeur ne puisse jamais fermer la balise <script>.
import { absoluteUrl, siteUrl } from "./site";

export type JsonLdObject = Record<string, unknown>;

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

export function safeJsonLd(data: JsonLdObject | JsonLdObject[]): string {
  return JSON.stringify(data)
    .replace(/</g, String.fromCharCode(92) + "u003c")
    .split(LS).join(String.fromCharCode(92) + "u2028")
    .split(PS).join(String.fromCharCode(92) + "u2029");
}

export type OrgInput = { name?: string; email?: string; phone?: string; base?: string };

export function organizationJsonLd(input: OrgInput = {}): JsonLdObject {
  const base = input.base ?? siteUrl();
  const contact: JsonLdObject | undefined =
    input.email || input.phone
      ? { "@type": "ContactPoint", contactType: "customer service", ...(input.email ? { email: input.email } : {}), ...(input.phone ? { telephone: input.phone } : {}), areaServed: "BJ", availableLanguage: ["fr", "en"] }
      : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${base}/#organization`,
    name: input.name ?? "Wá xɔ",
    url: base,
    ...(contact ? { contactPoint: contact } : {}),
  };
}

/** Site + moteur de recherche interne (le catalogue accepte `?q=`). */
export function websiteJsonLd(lang: string, base: string = siteUrl()): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${base}/#website`,
    name: "Wá xɔ",
    url: absoluteUrl(lang, "/", base),
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
  /** Identifiant du produit : devient `sku` (le suivi s'en sert pour `view_item`). */
  id: string;
  slug: string;
  name: string;
  description?: string;
  /** Prix en XOF entier. */
  price: number;
  stock: number;
  imageUrl?: string | null;
  rating?: { average: number; count: number };
};

export function productJsonLd(p: ProductLdInput, lang: string, base: string = siteUrl()): JsonLdObject {
  const url = absoluteUrl(lang, `/produit/${encodeURIComponent(p.slug)}`, base);
  const image = p.imageUrl ? (p.imageUrl.startsWith("http") ? p.imageUrl : `${base}${p.imageUrl}`) : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    sku: p.id,
    name: p.name,
    ...(p.description ? { description: p.description.slice(0, 500) } : {}),
    ...(image ? { image: [image] } : {}),
    url,
    brand: { "@type": "Brand", name: "Wá xɔ" },
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
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating.average, reviewCount: p.rating.count } }
      : {}),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[], lang: string, base: string = siteUrl()): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(lang, it.path, base) })),
  };
}
