"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { pagesDbConfigured } from "@/lib/admin/data/pages";
import { assertAdmin } from "@/lib/admin/guard";
import { fail, type ActionResult } from "@/lib/admin/ui/result";
import { BODY_MAX, PAGE_LOCALES, PAGE_SLUGS, TITLE_MAX } from "@/lib/pages/types";
import { createAdminClient } from "@/lib/supabase/admin";

// Actions de l'éditeur de pages d'infos. Chaque action : assertAdmin() d'abord, entrée validée par Zod,
// écriture via service_role, revalidatePath ciblé, jamais d'erreur SQL/stack renvoyée au client.

const TIMEOUT_MS = 6000;
function withTimeout<T>(p: PromiseLike<T>): Promise<T> {
  return Promise.race([Promise.resolve(p), new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS))]);
}

/** Retire les NUL et normalise les fins de ligne (le texte est du markdown, jamais interprété comme HTML au rendu). */
const cleanText = (s: string) => s.split(String.fromCharCode(0)).join("").replace(/\r\n?/g, "\n");

const SaveSchema = z.object({
  slug: z.enum(PAGE_SLUGS),
  locale: z.enum(PAGE_LOCALES),
  title: z.string().transform(cleanText).pipe(z.string().trim().min(1, "Le titre est obligatoire.").max(TITLE_MAX, `Titre trop long (${TITLE_MAX} caractères maximum).`)),
  body: z.string().transform(cleanText).pipe(z.string().trim().min(1, "Le texte est obligatoire.").max(BODY_MAX, `Texte trop long (${BODY_MAX} caractères maximum).`)),
  /** Date de dernière mise à jour connue de l'éditeur (détecte une modification faite ailleurs) ; null = rien en base au chargement. */
  baseUpdatedAt: z.string().max(64).nullable(),
});

function refresh(slug: string) {
  // Motif (toutes les langues) + chemins littéraux : la page publique est régénérée à la prochaine visite.
  revalidatePath(`/[lang]/${slug}`, "page");
  for (const l of PAGE_LOCALES) revalidatePath(`/${l}/${slug}`);
  revalidatePath("/admin/pages");
  revalidatePath("/admin/pages/[slug]", "page");
}

function sameInstant(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  return Number.isFinite(ta) && Number.isFinite(tb) && ta === tb;
}

/** Enregistre (crée ou remplace) une page dans une langue. */
export async function savePageAction(input: unknown): Promise<ActionResult<{ updatedAt: string }>> {
  if (!(await assertAdmin())) return fail("unauthorized");
  const parsed = SaveSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail("invalid", issue?.message ?? undefined, typeof issue?.path[0] === "string" ? issue.path[0] : undefined);
  }
  if (!pagesDbConfigured()) return fail("unavailable");
  const { slug, locale, title, body, baseUpdatedAt } = parsed.data;
  try {
    const sb = createAdminClient();
    const { data: current, error: readError } = await withTimeout(sb.from("pages").select("updated_at").eq("slug", slug).eq("locale", locale).maybeSingle());
    if (readError) return fail("error");
    const currentAt = current && typeof current.updated_at === "string" ? current.updated_at : null;
    if (!sameInstant(currentAt, baseUpdatedAt)) {
      return fail("conflict", "Cette page a été modifiée ailleurs depuis l'ouverture de l'éditeur. Rechargez la page pour voir la dernière version avant d'enregistrer.");
    }
    const updatedAt = new Date().toISOString();
    const { error } = await withTimeout(sb.from("pages").upsert({ slug, locale, title, body_md: body, updated_at: updatedAt }, { onConflict: "slug,locale" }));
    if (error) return fail("error");
    refresh(slug);
    return { ok: true, updatedAt };
  } catch {
    return fail("error");
  }
}
