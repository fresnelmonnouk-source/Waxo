"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/admin/guard";
import { tryAdminClient, withTimeout } from "@/lib/settings/db";
import { UUID_RE, fail, type ActionResult } from "@/lib/settings/result";
import { validateSiteReview } from "@/lib/site-reviews/logic";

// Avis sur la BOUTIQUE (0018) : validation (publier / masquer), suppression, et saisie d'un avis reçu ailleurs
// (WhatsApp, Facebook…) AVEC l'accord du client. Jamais d'avis inventé : l'accord est obligatoire (contrainte en base).

const idSchema = z.string().regex(UUID_RE);
const statusSchema = z.enum(["published", "hidden", "pending"]);
const ORIGINS = ["WhatsApp", "Facebook", "Instagram", "E-mail", "Téléphone", "En personne"] as const;

function refresh() {
  revalidatePath("/admin/avis");
  revalidatePath("/[lang]", "page"); // section de l'accueil
}

export async function setSiteReviewStatusAction(id: unknown, status: unknown): Promise<ActionResult> {
  if (!(await assertAdmin())) return fail("unauthorized");
  const sb = tryAdminClient();
  if (!sb) return fail("unavailable");
  const pid = idSchema.safeParse(id);
  const pst = statusSchema.safeParse(status);
  if (!pid.success || !pst.success) return fail("invalid");
  try {
    const patch = pst.data === "published" ? { status: "published", published_at: new Date().toISOString() } : { status: pst.data };
    const { data, error } = await withTimeout(sb.from("site_reviews").update(patch).eq("id", pid.data).select("id").maybeSingle());
    if (error) return fail("error");
    if (!data) return fail("not_found");
  } catch {
    return fail("error");
  }
  refresh();
  return { ok: true };
}

export async function deleteSiteReviewAction(id: unknown): Promise<ActionResult> {
  if (!(await assertAdmin())) return fail("unauthorized");
  const sb = tryAdminClient();
  if (!sb) return fail("unavailable");
  const pid = idSchema.safeParse(id);
  if (!pid.success) return fail("invalid");
  try {
    const { error } = await withTimeout(sb.from("site_reviews").delete().eq("id", pid.data));
    if (error) return fail("error");
  } catch {
    return fail("error");
  }
  refresh();
  return { ok: true };
}

const addSchema = z.object({
  author: z.string().max(60),
  city: z.string().max(40).optional().default(""),
  rating: z.number().int().min(1).max(5),
  body: z.string().max(600),
  origin: z.enum(ORIGINS),
  consent: z.literal(true),
  publish: z.boolean(),
});

/** Avis reçu hors du site, saisi par l'admin. L'accord du client est OBLIGATOIRE ; jamais de badge « Client vérifié ». */
export async function addSiteReviewAction(input: unknown): Promise<ActionResult> {
  if (!(await assertAdmin())) return fail("unauthorized");
  const sb = tryAdminClient();
  if (!sb) return fail("unavailable");
  const shape = addSchema.safeParse(input);
  if (!shape.success) {
    const consentMissing = shape.error.issues.some((i) => i.path[0] === "consent");
    return fail("invalid", consentMissing ? "Cochez l'accord du client : sans son accord, l'avis ne peut pas être publié." : "Formulaire invalide.");
  }
  const v = validateSiteReview({ rating: shape.data.rating, body: shape.data.body, city: shape.data.city, author: shape.data.author });
  if (!v.ok) {
    const msg = { rating: "Note de 1 à 5.", body: "Avis de 10 à 600 caractères.", city: "Ville trop longue.", author: "Nom de 2 à 60 caractères (ex. « Afi H. »)." }[v.field];
    return fail("invalid", msg, { [v.field]: msg });
  }
  try {
    const now = new Date().toISOString();
    const { error } = await withTimeout(
      sb.from("site_reviews").insert({
        author: v.value.author,
        city: v.value.city,
        rating: v.value.rating,
        body: v.value.body,
        source: "admin",
        origin: shape.data.origin,
        consent: true,
        verified: false,
        status: shape.data.publish ? "published" : "pending",
        published_at: shape.data.publish ? now : null,
      }),
    );
    if (error) return fail("error");
  } catch {
    return fail("error");
  }
  refresh();
  return { ok: true };
}
