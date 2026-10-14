"use server";

import { z } from "zod";
import { assertAdmin } from "@/lib/admin/guard";
import { adminLlmConfigured } from "@/lib/admin/ai/llm";
import { WRITER_NOTES_MAX as NOTES_MAX, type ProductDraft } from "@/lib/admin/ai/product-draft";
import { runProductWriter, type WriterMeta } from "@/lib/admin/ai/product-writer";
import { createSharedLimiter } from "@/lib/ratelimit";
import { fail, type ActionResult } from "@/lib/settings/result";

// Rédacteur IA des fiches produit (tiroir produit → « Rédiger avec l'IA »). assertAdmin() d'abord, limiteur AVANT toute
// lecture de lien ou appel au modèle. La proposition est renvoyée au formulaire : RIEN n'est enregistré ici.

const writerLimiter = createSharedLimiter({ name: "admin-ai-product", windowMs: 60 * 60 * 1000, max: 30 });

const NO_KEY_MESSAGE = "L'IA n'est pas configurée : ajoutez la variable DEEPSEEK_API_KEY dans Vercel, puis redéployez. La fiche reste modifiable à la main.";
const AI_FAIL = {
  timeout: "L'IA a mis trop de temps à répondre. Réessayez dans un instant.",
  llm: "L'IA est injoignable pour le moment. Réessayez dans quelques minutes.",
  unreadable: "La réponse de l'IA était illisible. Relancez la rédaction.",
} as const;

const inputSchema = z
  .object({
    url: z.string().trim().max(2000, "Lien trop long (2 000 caractères maximum).").optional().default(""),
    notes: z.string().trim().max(NOTES_MAX, `Notes trop longues (${NOTES_MAX.toLocaleString("fr-FR")} caractères maximum).`).optional().default(""),
    rayon: z.string().trim().max(80).optional().default(""),
  })
  .strict();

export async function draftProductAction(input: unknown): Promise<ActionResult<{ draft: ProductDraft; meta: WriterMeta }>> {
  const admin = await assertAdmin();
  if (!admin) return fail("unauthorized");
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return fail("invalid", parsed.error.issues[0]?.message ?? "Demande invalide.");
  const { url, notes, rayon } = parsed.data;
  if (!url && notes.length < 3) return fail("invalid", "Collez le lien d'une page produit ou écrivez quelques notes sur l'article.");
  if (!adminLlmConfigured()) return fail("unavailable", NO_KEY_MESSAGE);
  if (!(await writerLimiter.hit(admin.id))) return fail("rate_limited", "Limite atteinte : 30 rédactions par heure. Réessayez plus tard.");
  try {
    const out = await runProductWriter({ url: url || null, notes, rayon });
    if (out.ok) return { ok: true, draft: out.draft, meta: out.meta };
    if (out.code === "no_key") return fail("unavailable", NO_KEY_MESSAGE);
    if (out.code.startsWith("page_")) return fail("invalid", out.message);
    return fail("error", AI_FAIL[out.code as keyof typeof AI_FAIL]);
  } catch {
    return fail("error");
  }
}
