import "server-only";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { pageMetadata, seoText, type PageMetaInput } from "./metadata";

/** Pages publiques dont le titre et la description viennent de `SeoPages` (src/messages/*\/seo.json, rédigés par Marcus). */
export type SeoPageKey =
  | "home"
  | "catalogue"
  | "faq"
  | "contact"
  | "aPropos"
  | "livraisonRetours"
  | "packs"
  | "cgv"
  | "cgu"
  | "confidentialite"
  | "mentionsLegales";

/**
 * Métadonnées d'une page publique : titre (`%s | Waxo` par le layout ; absolu pour l'accueil), description, canonique,
 * hreflang, Open Graph (`og:url` compris) et Twitter. Une description encore « TODO » est omise (repli : `fallbackDescription`,
 * sinon celle du site posée par le layout).
 */
export async function seoPageMetadata(
  lang: string,
  key: SeoPageKey,
  path: string,
  extra: Partial<PageMetaInput> & { fallbackDescription?: string } = {},
): Promise<Metadata> {
  if (!hasLocale(routing.locales, lang)) return {};
  const t = await getTranslations({ locale: lang, namespace: "SeoPages" });
  const { fallbackDescription, ...rest } = extra;
  return pageMetadata({
    lang,
    path,
    title: t(`${key}.title`),
    absoluteTitle: key === "home",
    brand: t("brand"),
    description: seoText(t(`${key}.description`)) ?? seoText(fallbackDescription),
    ...rest,
  });
}
