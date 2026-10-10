"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/admin/guard";
import { tryAdminClient, withTimeout } from "@/lib/settings/db";
import { UUID_RE, fail, type ActionResult } from "@/lib/settings/result";

const idSchema = z.string().regex(UUID_RE);

/** Désinscrit un contact (suppression de la ligne). */
export async function deleteSubscriberAction(id: unknown): Promise<ActionResult> {
  if (!(await assertAdmin())) return fail("unauthorized");
  const sb = tryAdminClient();
  if (!sb) return fail("unavailable");
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return fail("invalid");
  try {
    const { error } = await withTimeout(sb.from("newsletter_subs").delete().eq("id", parsedId.data));
    if (error) return fail("error");
  } catch {
    return fail("error");
  }
  revalidatePath("/admin/newsletter");
  return { ok: true };
}
