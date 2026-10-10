"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/admin/guard";
import { tryAdminClient, withTimeout } from "@/lib/settings/db";
import { UUID_RE, fail, type ActionResult } from "@/lib/settings/result";

const idSchema = z.string().regex(UUID_RE);

function refresh() {
  revalidatePath("/admin/avis");
  revalidatePath("/[lang]", "layout"); // notes moyennes et avis affichés sur la boutique
}

/** Masquer (hidden=true) ou republier (hidden=false) un avis. */
export async function setReviewHiddenAction(id: unknown, hidden: unknown): Promise<ActionResult> {
  if (!(await assertAdmin())) return fail("unauthorized");
  const sb = tryAdminClient();
  if (!sb) return fail("unavailable");
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success || typeof hidden !== "boolean") return fail("invalid");
  try {
    const { data, error } = await withTimeout(sb.from("reviews").update({ hidden }).eq("id", parsedId.data).select("id").maybeSingle());
    if (error) return fail("error");
    if (!data) return fail("not_found");
  } catch {
    return fail("error");
  }
  refresh();
  return { ok: true };
}

export async function deleteReviewAction(id: unknown): Promise<ActionResult> {
  if (!(await assertAdmin())) return fail("unauthorized");
  const sb = tryAdminClient();
  if (!sb) return fail("unavailable");
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return fail("invalid");
  try {
    const { error } = await withTimeout(sb.from("reviews").delete().eq("id", parsedId.data));
    if (error) return fail("error");
  } catch {
    return fail("error");
  }
  refresh();
  return { ok: true };
}
