import "server-only";
import { getSettings } from "@/lib/catalog";
import { DEFAULT_PAGES } from "@/lib/pages/defaults";
import { getLegalSettings } from "@/lib/pages";
import type { MarkerShop } from "@/lib/pages/markers";
import {
  PAGE_LABELS,
  PAGE_LOCALES,
  PAGE_SLUGS,
  type LegalSettings,
  type PageLocale,
  type PageSlug,
} from "@/lib/pages/types";
import { createAdminClient } from "@/lib/supabase/admin";

/** Lecture admin des pages d'infos (table `pages`, repli = textes par défaut ; jamais d'exception). */

export type AdminLocaleState = {
  /** `db` = version enregistrée dans la table `pages` ; `default` = texte de repli (rien en base). */
  source: "db" | "default";
  title: string;
  body: string;
  updatedAt: string | null;
};
export type AdminPageEntry = { slug: PageSlug; label: string; locales: Record<PageLocale, AdminLocaleState> };
export type AdminPagesData = { entries: AdminPageEntry[]; connected: boolean };

const TIMEOUT_MS = 6000;
function withTimeout<T>(p: PromiseLike<T>): Promise<T> {
  return Promise.race([Promise.resolve(p), new Promise<T>((_, reject) => setTimeout(() => reject(new Error("supabase_timeout")), TIMEOUT_MS))]);
}

/** La base d'écriture est-elle branchée ? (clé service_role présente) */
export function pagesDbConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

type Row = { slug: string; locale: string; title: string; body_md: string; updated_at: string | null };

async function readRows(): Promise<Row[] | null> {
  if (!pagesDbConfigured()) return null;
  try {
    const { data, error } = await withTimeout(createAdminClient().from("pages").select("slug,locale,title,body_md,updated_at").limit(50));
    return error || !data ? null : (data as Row[]);
  } catch {
    return null;
  }
}

function build(rows: Row[] | null): AdminPagesData {
  const bySlugLocale = new Map<string, Row>();
  for (const r of rows ?? []) bySlugLocale.set(`${r.slug}/${r.locale}`, r);
  const entries = PAGE_SLUGS.map((slug): AdminPageEntry => {
    const locales = {} as Record<PageLocale, AdminLocaleState>;
    for (const locale of PAGE_LOCALES) {
      const row = bySlugLocale.get(`${slug}/${locale}`);
      locales[locale] =
        row && row.title.trim() && row.body_md.trim()
          ? { source: "db", title: row.title, body: row.body_md, updatedAt: row.updated_at }
          : { source: "default", title: DEFAULT_PAGES[slug][locale].title, body: DEFAULT_PAGES[slug][locale].body, updatedAt: null };
    }
    return { slug, label: PAGE_LABELS[slug], locales };
  });
  return { entries, connected: rows !== null };
}

export async function getAdminPages(): Promise<AdminPagesData> {
  return build(await readRows());
}

export async function getAdminPage(slug: PageSlug): Promise<{ entry: AdminPageEntry; connected: boolean }> {
  const data = build(await readRows());
  return { entry: data.entries.find((e) => e.slug === slug)!, connected: data.connected };
}

/** Données des marqueurs pour l'aperçu de l'éditeur (mêmes réglages que le site public). */
export async function getPreviewSettings(): Promise<{ shop: MarkerShop; legal: LegalSettings }> {
  const [shop, legal] = await Promise.all([getSettings(), getLegalSettings()]);
  return { shop, legal };
}
