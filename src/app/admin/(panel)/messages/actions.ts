"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/admin/guard";
import { getAdminMessages } from "@/lib/admin/data/messages";
import { getAllKbDocs, getSettingsForm } from "@/lib/admin/data/settings";
import { buildDraft, type Draft } from "@/lib/settings/kb-search";
import { tryAdminClient, withTimeout } from "@/lib/settings/db";
import { UUID_RE, fail, type ActionResult } from "@/lib/settings/result";

const idSchema = z.string().regex(UUID_RE);

/** Marque un message comme traité (done=true) ou à traiter (done=false). */
export async function setMessageDoneAction(id: unknown, done: unknown): Promise<ActionResult> {
  if (!(await assertAdmin())) return fail("unauthorized");
  const sb = tryAdminClient();
  if (!sb) return fail("unavailable");
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success || typeof done !== "boolean") return fail("invalid");
  try {
    const { data, error } = await withTimeout(sb.from("messages").update({ done }).eq("id", parsedId.data).select("id").maybeSingle());
    if (error) return fail("error");
    if (!data) return fail("not_found");
  } catch {
    return fail("error");
  }
  revalidatePath("/admin/messages");
  return { ok: true };
}

/** Régénère le brouillon (modèle automatique, sans IA) d'un message à partir de la base de connaissances. Rien n'est envoyé. */
export async function draftReplyAction(id: unknown): Promise<ActionResult<{ draft: Draft }>> {
  if (!(await assertAdmin())) return fail("unauthorized");
  const parsedId = z.string().min(1).max(64).safeParse(id);
  if (!parsedId.success) return fail("invalid");
  try {
    const [{ rows }, { docs }, { form }] = await Promise.all([getAdminMessages(), getAllKbDocs(), getSettingsForm()]);
    const m = rows.find((r) => r.id === parsedId.data);
    if (!m) return fail("not_found");
    const draft = buildDraft(
      { name: m.name, contact: m.contact, subject: m.subject, text: m.body, orderNumber: m.orderNumber, orderStatusLabel: m.orderStatusLabel, aiSign: form.aiSign },
      docs,
    );
    return { ok: true, draft };
  } catch {
    return fail("error");
  }
}
