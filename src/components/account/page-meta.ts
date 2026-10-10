import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { withSeo } from "@/lib/seo/metadata";

type Params = Promise<{ lang: string }>;

// Espaces privés : jamais indexés (le robots.txt les interdit déjà ; `noindex` couvre les liens externes).
const PRIVATE = new Set(["compte", "connexion", "inscription", "favoris", "suivi"]);

/** Titre de page (gabarit « %s · Wá xɔ » défini dans le layout racine) à partir d'une clé de messages. */
export async function pageTitle(params: Params, namespace: string, key: string): Promise<Metadata> {
  const { lang } = await params;
  const t = await getTranslations({ locale: lang, namespace });
  return withSeo({ title: t(key) }, lang, `/${key}`, { noindex: PRIVATE.has(key) });
}
