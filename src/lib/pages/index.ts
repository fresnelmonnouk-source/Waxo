import "server-only";
import { cache } from "react";
import { getSettings } from "@/lib/catalog";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";
import { DEFAULT_PAGES } from "./defaults";
import { type MarkerContext } from "./markers";
import { EMPTY_LEGAL, normalizeLegal, type LegalSettings, type PageLocale, type PageSlug } from "./types";

/**
 * Lecture PUBLIQUE des pages d'infos (client anon sans cookies → pages statiques/ISR).
 * Source : table `pages` ; repli sur les textes par défaut (DEFAULT_PAGES = contenu J1) si la ligne manque,
 * est vide, ou si Supabase est absent/injoignable. Jamais d'exception vers les pages.
 */

const TIMEOUT_MS = 4000;
function withTimeout<T>(p: PromiseLike<T>): Promise<T> {
  return Promise.race([Promise.resolve(p), new Promise<T>((_, reject) => setTimeout(() => reject(new Error("supabase_timeout")), TIMEOUT_MS))]);
}

export type ResolvedPage = {
  slug: PageSlug;
  locale: PageLocale;
  title: string;
  body: string;
  /** `db` = ligne de la table `pages` ; `default` = texte de repli (modèle J1). */
  source: "db" | "default";
  updatedAt: string | null;
};

function fallback(slug: PageSlug, locale: PageLocale): ResolvedPage {
  const d = DEFAULT_PAGES[slug][locale];
  return { slug, locale, title: d.title, body: d.body, source: "default", updatedAt: null };
}

/** Une page, avec repli. `cache` : métadonnées + rendu d'une même requête ne lisent la base qu'une fois. */
export const getPage = cache(async (slug: PageSlug, locale: PageLocale): Promise<ResolvedPage> => {
  if (supabasePublicEnv()) {
    try {
      const { data, error } = await withTimeout(
        createPublicClient().from("pages").select("title,body_md,updated_at").eq("slug", slug).eq("locale", locale).maybeSingle(),
      );
      if (!error && data && typeof data.title === "string" && typeof data.body_md === "string" && data.title.trim() && data.body_md.trim()) {
        return { slug, locale, title: data.title, body: data.body_md, source: "db", updatedAt: typeof data.updated_at === "string" ? data.updated_at : null };
      }
    } catch {
      /* repli par défaut */
    }
  }
  return fallback(slug, locale);
});

/** Réglages légaux publics (`settings.legal`) ; tout vide si la ligne manque ou si la base est indisponible. */
export const getLegalSettings = cache(async (): Promise<LegalSettings> => {
  if (supabasePublicEnv()) {
    try {
      const { data, error } = await withTimeout(
        createPublicClient().from("settings").select("value").eq("key", "legal").eq("is_public", true).maybeSingle(),
      );
      if (!error && data) return normalizeLegal(data.value);
    } catch {
      /* repli : tout vide */
    }
  }
  return { ...EMPTY_LEGAL };
});

/** Contexte des marqueurs (réglages boutique via le catalogue + réglages légaux). */
export async function getMarkerContext(locale: PageLocale): Promise<MarkerContext> {
  const [shop, legal] = await Promise.all([getSettings(), getLegalSettings()]);
  return { locale, shop, legal };
}
