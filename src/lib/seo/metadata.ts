// Helpers de métadonnées pour les pages (à brancher dans `generateMetadata` des pages des autres agents).
// Exemple :
//   export async function generateMetadata({ params }: PageProps<"/[lang]/faq">) {
//     const { lang } = await params;
//     const t = await getTranslations({ locale: lang, namespace: "Faq" });
//     return pageMetadata({ lang, path: "/faq", title: t("title"), description: t("intro") });
//   }
import type { Metadata } from "next";
import { absoluteUrl, languageAlternates, siteUrl } from "./site";

export type PageMetaInput = {
  lang: string;
  /** Chemin SANS langue, ex. `/catalogue` ou `/produit/savon-noir`. */
  path: string;
  title: string;
  description?: string;
  /** Pages privées (compte, commande, suivi…) : `noindex, nofollow`. */
  noindex?: boolean;
  /** Image Open Graph absolue ou relative ; sinon celle générée par `[lang]/opengraph-image`. */
  image?: string | null;
  /** Hreflang : pour une page dont le slug diffère selon la langue, passer les chemins de chaque langue. */
  languagePaths?: Partial<Record<"fr" | "en", string>>;
  type?: "website" | "article";
};

const LOCALE_TAG: Record<string, string> = { fr: "fr_FR", en: "en_GB" };

export function pageMetadata(input: PageMetaInput): Metadata {
  const base = siteUrl();
  const { lang, path, title, description, noindex, image, languagePaths, type } = input;
  const url = absoluteUrl(lang, path, base);
  const languages = languagePaths
    ? {
        ...Object.fromEntries(Object.entries(languagePaths).map(([l, p]) => [l, absoluteUrl(l, p as string, base)])),
        "x-default": absoluteUrl("fr", languagePaths.fr ?? path, base),
      }
    : languageAlternates(path, base);
  const images = image ? [{ url: image.startsWith("http") ? image : `${base}${image}` }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: url, languages },
    robots: noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      type: type ?? "website",
      url,
      title,
      description,
      siteName: "Wá xɔ",
      locale: LOCALE_TAG[lang] ?? "fr_FR",
      images,
    },
    twitter: { card: "summary_large_image", title, description, images: images?.map((i) => i.url) },
  };
}

export type SeoOpts = {
  /** Page privée (compte, connexion, suivi…) : `noindex, nofollow`, aucune balise canonique. */
  noindex?: boolean;
  /** Pages dont le slug change selon la langue (fiches produit, packs) : canonique seule, hreflang laissé au sitemap. */
  canonicalOnly?: boolean;
};

/**
 * Ajoute à des métadonnées de page la balise canonique (URL propre, sans filtres ni paramètres : `?cat=…`, `?col=…`) et les
 * hreflang FR/EN. Sans cela, chaque variante d'URL d'une page serait indexée comme une page distincte.
 */
export function withSeo(meta: Metadata, lang: string, path: string, opts: SeoOpts = {}): Metadata {
  if (opts.noindex) return { ...meta, robots: { index: false, follow: false } };
  const base = siteUrl();
  const canonical = absoluteUrl(lang, path, base);
  return {
    ...meta,
    alternates: opts.canonicalOnly ? { canonical } : { canonical, languages: languageAlternates(path, base) },
  };
}
