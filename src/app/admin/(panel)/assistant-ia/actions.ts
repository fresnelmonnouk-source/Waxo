"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/admin/guard";
import { runAnalysis, runDraft, type AiFailCode, type AiMeta } from "@/lib/admin/ai/analyze";
import { fieldsForState, hasTbc, isMissingColumn, rowToKb, type AdminKbRow, type KbState } from "@/lib/admin/ai/kb-admin";
import { adminLlmConfigured } from "@/lib/admin/ai/llm";
import type { Analysis, KbDraft } from "@/lib/admin/ai/schema";
import { createSharedLimiter } from "@/lib/ratelimit";
import { tryAdminClient, withTimeout } from "@/lib/settings/db";
import { KB_TAGS } from "@/lib/settings/kb-search";
import { UUID_RE, fail, type ActionResult } from "@/lib/settings/result";

// IA de l'admin et base de connaissances. Toute action : assertAdmin() d'abord ; écritures en service_role ; l'IA ne
// fait que proposer : une fiche créée depuis l'IA est un BROUILLON (inactif), seul « Publier » la rend visible.

const analyzeLimiter = createSharedLimiter({ name: "admin-ai-analyze", windowMs: 60 * 60 * 1000, max: 10 });
const draftLimiter = createSharedLimiter({ name: "admin-ai-draft", windowMs: 60 * 60 * 1000, max: 30 });

const NO_KEY_MESSAGE = "L'IA n'est pas configurée : ajoutez la variable DEEPSEEK_API_KEY dans Vercel, puis redéployez. La base de connaissances reste modifiable à la main.";
const AI_FAIL: Record<Exclude<AiFailCode, "no_key">, string> = {
  timeout: "L'IA a mis trop de temps à répondre. Réessayez dans un instant.",
  llm: "L'IA est injoignable pour le moment. Réessayez dans quelques minutes.",
  unreadable: "La réponse de l'IA était illisible. Relancez la demande.",
};
const MIGRATION_MESSAGE = "Les brouillons ne sont pas encore activés : la migration 0022 doit être appliquée sur la base.";
const TBC_MESSAGE = "Complétez les passages « [à confirmer] » avant de publier.";

function refresh() {
  revalidatePath("/admin/assistant-ia");
  revalidatePath("/admin/reglages");
  revalidatePath("/admin/messages");
}

// ───────────────────────── IA : analyse du site et rédaction ─────────────────────────

export async function analyzeSiteAction(): Promise<ActionResult<{ analysis: Analysis; meta: AiMeta }>> {
  const admin = await assertAdmin();
  if (!admin) return fail("unauthorized");
  if (!adminLlmConfigured()) return fail("unavailable", NO_KEY_MESSAGE);
  if (!(await analyzeLimiter.hit(admin.id))) return fail("rate_limited", "Limite atteinte : 10 analyses par heure. Réessayez plus tard.");
  try {
    const out = await runAnalysis();
    if (!out.ok) return out.code === "no_key" ? fail("unavailable", NO_KEY_MESSAGE) : fail("error", AI_FAIL[out.code]);
    return { ok: true, analysis: out.analysis, meta: out.meta };
  } catch {
    return fail("error");
  }
}

const requestSchema = z.string().trim().min(8, "Décrivez la fiche souhaitée (8 caractères minimum).").max(600, "600 caractères maximum.");

export async function draftKbAction(request: unknown): Promise<ActionResult<{ draft: KbDraft; meta: AiMeta }>> {
  const admin = await assertAdmin();
  if (!admin) return fail("unauthorized");
  const parsed = requestSchema.safeParse(request);
  if (!parsed.success) return fail("invalid", parsed.error.issues[0]?.message);
  if (!adminLlmConfigured()) return fail("unavailable", NO_KEY_MESSAGE);
  if (!(await draftLimiter.hit(admin.id))) return fail("rate_limited", "Limite atteinte : 30 rédactions par heure. Réessayez plus tard.");
  try {
    const out = await runDraft(parsed.data);
    if (!out.ok) return out.code === "no_key" ? fail("unavailable", NO_KEY_MESSAGE) : fail("error", AI_FAIL[out.code]);
    return { ok: true, draft: out.draft, meta: out.meta };
  } catch {
    return fail("error");
  }
}

// ───────────────────────── Base de connaissances : fiches et statut ─────────────────────────

const SELECT = "id,tag,title,text,keywords,active,status,source,updated_at";

const kbSchema = z
  .object({
    id: z.string().regex(UUID_RE).optional(),
    title: z.string().trim().min(3, "Titre trop court.").max(120, "Titre trop long (120 caractères maximum)."),
    tag: z.enum(KB_TAGS, { error: "Thème invalide." }),
    text: z.string().trim().min(20, "Contenu trop court (20 caractères minimum).").max(2000, "Contenu trop long (2 000 caractères maximum)."),
    keywords: z.string().trim().max(300, "Mots-clés trop longs (300 caractères maximum)."),
    source: z.enum(["manual", "ai"]).default("manual"),
    /** true = clic « Publier » de l'admin ; sinon une nouvelle fiche est un brouillon et une fiche existante garde son statut. */
    publish: z.boolean().default(false),
  })
  .strict();

export async function saveKbAction(input: unknown): Promise<ActionResult<{ entry: AdminKbRow }>> {
  if (!(await assertAdmin())) return fail("unauthorized");
  const sb = tryAdminClient();
  if (!sb) return fail("unavailable");
  const parsed = kbSchema.safeParse(input);
  if (!parsed.success) return fail("invalid", parsed.error.issues[0]?.message ?? "Données invalides.");
  const { id, source, publish, ...fields } = parsed.data;
  const tbc = hasTbc(fields.text) || hasTbc(fields.title);
  if (publish && tbc) return fail("invalid", TBC_MESSAGE);
  try {
    if (id && tbc) {
      // Une fiche en ligne ne doit jamais montrer « [à confirmer] » aux clients.
      const { data: current, error: readError } = await withTimeout(sb.from("kb").select("active,status").eq("id", id).maybeSingle());
      if (readError && !isMissingColumn(readError)) return fail("error");
      if (current && current.active !== false && current.status !== "draft") return fail("invalid", "Cette fiche est publiée : retirez les « [à confirmer] » ou repassez-la en brouillon.");
    }
    const query = id
      ? sb
          .from("kb")
          .update({ ...fields, ...(publish ? fieldsForState("published") : {}) })
          .eq("id", id)
          .select(SELECT)
          .maybeSingle()
      : sb
          .from("kb")
          .insert({ ...fields, source, ...fieldsForState(publish ? "published" : "draft") })
          .select(SELECT)
          .maybeSingle();
    const { data, error } = await withTimeout(query);
    if (isMissingColumn(error)) return fail("unavailable", MIGRATION_MESSAGE);
    if (error) return fail("error");
    if (!data) return fail("not_found");
    refresh();
    return { ok: true, entry: rowToKb(data as Record<string, unknown>) };
  } catch {
    return fail("error");
  }
}

const STATES = ["published", "draft", "disabled"] as const;

export async function setKbStateAction(id: unknown, state: unknown): Promise<ActionResult<{ entry: AdminKbRow }>> {
  if (!(await assertAdmin())) return fail("unauthorized");
  const sb = tryAdminClient();
  if (!sb) return fail("unavailable");
  if (typeof id !== "string" || !UUID_RE.test(id) || !STATES.includes(state as KbState)) return fail("invalid");
  try {
    if (state === "published") {
      const { data: current, error: readError } = await withTimeout(sb.from("kb").select("title,text").eq("id", id).maybeSingle());
      if (readError) return fail("error");
      if (!current) return fail("not_found");
      if (hasTbc(String(current.text ?? "")) || hasTbc(String(current.title ?? ""))) return fail("invalid", TBC_MESSAGE);
    }
    const { data, error } = await withTimeout(sb.from("kb").update(fieldsForState(state as KbState)).eq("id", id).select(SELECT).maybeSingle());
    if (isMissingColumn(error)) return fail("unavailable", MIGRATION_MESSAGE);
    if (error) return fail("error");
    if (!data) return fail("not_found");
    refresh();
    return { ok: true, entry: rowToKb(data as Record<string, unknown>) };
  } catch {
    return fail("error");
  }
}

export async function deleteKbAction(id: unknown): Promise<ActionResult> {
  if (!(await assertAdmin())) return fail("unauthorized");
  const sb = tryAdminClient();
  if (!sb) return fail("unavailable");
  if (typeof id !== "string" || !UUID_RE.test(id)) return fail("invalid");
  try {
    const { data, error } = await withTimeout(sb.from("kb").delete().eq("id", id).select("id").maybeSingle());
    if (error) return fail("error");
    if (!data) return fail("not_found");
  } catch {
    return fail("error");
  }
  refresh();
  return { ok: true };
}
