// Métadonnées des pages : fonctions PURES (testées dans tests/seo-*.test.ts). Les textes viennent du namespace `SeoPages`
// (src/messages/*/seo.json), lu par `seoPageMetadata` (./pages.ts) ou directement par les fiches.
// Exemple :
//   export async function generateMetadata({ params }: PageProps<"/[lang]/faq">) {
//     const { lang } = await params;
//     return seoPageMetadata(lang, "faq", "/faq");
//   }
import type { Metadata } from "next";
import { DEFAULT_LOCALE, absoluteUrl, languageAlternates, siteUrl } from "./site";

/** Graphie des titres Google (décision de Fresnel) : « Waxo ». Le logo et le texte visible gardent « Wá xɔ ». */
export const SEO_BRAND = "Waxo";
/** Nom affiché dans les aperçus de partage (`og:site_name`) : la marque telle qu'elle s'écrit. */
export const SITE_NAME = "Wá xɔ";

export type PageMetaInput = {
  lang: string;
  /** Chemin SANS langue, ex. `/catalogue` ou `/produit/savon-noir`. */
  path: string;
  /** Titre de la page ; le layout ajoute « | Waxo » (gabarit), sauf si `absoluteTitle`. */
  title?: string;
  /** Titre complet, sans gabarit (accueil). */
  absoluteTitle?: boolean;
  /** Marque ajoutée au titre de partage (`og:title`), qui n'hérite pas du gabarit du layout. */
  brand?: string;
  description?: string;
  /** Pages privées (compte, commande, suivi…) ou vides (catalogue sans produit) : `noindex`. */
  noindex?: boolean;
  /** Image Open Graph absolue ou relative (photo du produit) ; sinon l'image générée par `[lang]/opengraph-image`. */
  image?: string | null;
  /**
   * Hreflang d'une page dont le slug diffère selon la langue (fiches produit et pack). Une langue absente = pas de version
   * dans cette langue : pas d'alternate, et si c'est la langue demandée, canonique vers la version française (S8).
   */
  languagePaths?: Partial<Record<"fr" | "en", string>>;
  type?: "website" | "article";
};

const LOCALE_TAG: Record<string, string> = { fr: "fr_FR", en: "en_GB" };

export function pageMetadata(input: PageMetaInput): Metadata {
  const base = siteUrl();
  const { lang, path, title, absoluteTitle, description, noindex, image, languagePaths, type } = input;
  const brand = input.brand ?? SEO_BRAND;
  let canonical = absoluteUrl(lang, path, base);
  let languages: Record<string, string>;
  if (languagePaths) {
    languages = Object.fromEntries(
      Object.entries(languagePaths)
        .filter(([, p]) => !!p)
        .map(([l, p]) => [l, absoluteUrl(l, p as string, base)]),
    );
    const fallback = languagePaths.fr ?? languagePaths.en ?? path;
    languages["x-default"] = absoluteUrl(languagePaths.fr ? DEFAULT_LOCALE : "en", fallback, base);
    // Pas de version dans la langue demandée (fiche sans texte anglais) : la page servie est la copie de la version FR.
    if (!languagePaths[lang as "fr" | "en"]) canonical = languages["x-default"];
  } else {
    languages = languageAlternates(path, base);
  }
  // Une page qui pose `openGraph` REMPLACE celui du layout (Next ne fusionne pas) : sans photo, on remet donc
  // explicitement l'image de partage générée de la langue, sinon l'aperçu WhatsApp/Facebook n'aurait plus d'image.
  const images = image
    ? [{ url: image.startsWith("http") ? image : `${base}${image}` }]
    : [{ url: `${base}/${lang === "en" ? "en" : "fr"}/opengraph-image`, width: 1200, height: 630, alt: SITE_NAME }];
  const shareTitle = title ? (absoluteTitle ? title : `${title} | ${brand}`) : undefined;
  return {
    ...(title ? { title: absoluteTitle ? { absolute: title } : title } : {}),
    ...(description ? { description } : {}),
    alternates: { canonical, languages },
    robots: noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      type: type ?? "website",
      url: canonical,
      ...(shareTitle ? { title: shareTitle } : {}),
      ...(description ? { description } : {}),
      siteName: SITE_NAME,
      locale: LOCALE_TAG[lang] ?? "fr_FR",
      images,
    },
    twitter: {
      card: "summary_large_image",
      ...(shareTitle ? { title: shareTitle } : {}),
      ...(description ? { description } : {}),
      images: images.map((i) => i.url),
    },
  };
}

export type SeoOpts = {
  /** Page privée (compte, connexion, suivi…) : `noindex, nofollow`, aucune balise canonique. */
  noindex?: boolean;
  /** Canonique seule, sans hreflang. */
  canonicalOnly?: boolean;
};

/**
 * Enveloppe historique de `pageMetadata` (pages privées et composants partagés) : canonique sans paramètres
 * (`?cat=…`, `?col=…`), hreflang FR/EN, Open Graph et Twitter de la page (`og:url` compris).
 */
export function withSeo(meta: Metadata, lang: string, path: string, opts: SeoOpts = {}): Metadata {
  if (opts.noindex) return { ...meta, robots: { index: false, follow: false } };
  const raw = meta.title;
  const title = typeof raw === "string" ? raw : raw && typeof raw === "object" && "absolute" in raw ? raw.absolute : undefined;
  const pm = pageMetadata({
    lang,
    path,
    title: title ?? undefined,
    absoluteTitle: !!raw && typeof raw === "object" && "absolute" in raw,
    description: typeof meta.description === "string" ? meta.description : undefined,
  });
  return {
    ...meta,
    alternates: opts.canonicalOnly ? { canonical: pm.alternates?.canonical } : pm.alternates,
    openGraph: { ...pm.openGraph, ...(meta.openGraph ?? {}) } as Metadata["openGraph"],
    twitter: { ...pm.twitter, ...(meta.twitter ?? {}) } as Metadata["twitter"],
  };
}

/** Texte SEO publiable : vide ou encore « TODO » (rédaction en cours) = absent, la page hérite alors de la description du site. */
export function seoText(v: string | null | undefined): string | undefined {
  const s = (v ?? "").trim();
  return s && !/^TODO\b/i.test(s) ? s : undefined;
}

/** Méta-description : une ligne, coupée à la limite d'un mot vers 155 caractères (Google tronque au-delà). */
export function metaDescription(text: string | null | undefined, max = 155): string | undefined {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  if (!flat) return undefined;
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.!?·-]+$/, "")}…`;
}

/** Prix des titres et descriptions : entier FCFA, séparateur de milliers de la langue (« 2 500 FCFA », « 2,500 FCFA »). */
export function priceFcfa(amount: number, lang: string): string {
  return `${new Intl.NumberFormat(lang === "en" ? "en-GB" : "fr-FR", { maximumFractionDigits: 0 }).format(Math.round(amount || 0))} FCFA`;
}
