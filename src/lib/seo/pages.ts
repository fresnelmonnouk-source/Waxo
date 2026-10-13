import "server-only";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getSettings } from "@/lib/catalog";
import { fmtCutoff } from "@/components/shop/ExpressBadge";
import { safeCutoff } from "@/lib/delivery/promise";
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
/**
 * Heure limite de la Livraison Express pour les descriptions (`{hour}`), lue dans les réglages (audit Helena C3) :
 * changer l'heure dans l'admin met à jour les metas, sans texte en dur. Espace insécable en français.
 */
export async function seoHour(lang: string): Promise<string> {
  const settings = await getSettings();
  return fmtCutoff(safeCutoff(settings.shipping.cutoff), lang).replace(" h", " h");
}

export async function seoPageMetadata(
  lang: string,
  key: SeoPageKey,
  path: string,
  extra: Partial<PageMetaInput> & { fallbackDescription?: string } = {},
): Promise<Metadata> {
  if (!hasLocale(routing.locales, lang)) return {};
  const [t, hour] = await Promise.all([getTranslations({ locale: lang, namespace: "SeoPages" }), seoHour(lang)]);
  const { fallbackDescription, ...rest } = extra;
  return pageMetadata({
    lang,
    path,
    title: t(`${key}.title`),
    absoluteTitle: key === "home",
    brand: t("brand"),
    description: seoText(t(`${key}.description`, { hour })) ?? seoText(fallbackDescription),
    ...rest,
  });
}
