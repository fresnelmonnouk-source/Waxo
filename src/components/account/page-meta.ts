import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

type Params = Promise<{ lang: string }>;

/** Titre de page (gabarit « %s · Wá xɔ » défini dans le layout racine) à partir d'une clé de messages. */
export async function pageTitle(params: Params, namespace: string, key: string): Promise<Metadata> {
  const { lang } = await params;
  const t = await getTranslations({ locale: lang, namespace });
  return { title: t(key) };
}
