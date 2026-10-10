"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withTimeout } from "@/lib/auth/timeout";
import { hasAdminDb } from "@/lib/admin/data/stats";
import { assertAdmin } from "@/lib/admin/guard";
import { fail, type ActionResult } from "@/lib/admin/ui/result";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkEntry } from "@/lib/stats/ledger";
import { dayKeyOf } from "@/lib/stats/time";

// Server actions du carnet de comptes. Chacune : assertAdmin() d'abord → base joignable ? → validation → écriture service_role.
// Jamais d'erreur SQL/stack renvoyée au client.

const uuid = z.uuid();

function refresh() {
  revalidatePath("/admin/carnet");
}

async function guard(): Promise<ReturnType<typeof fail> | null> {
  if (!(await assertAdmin())) return fail("unauthorized");
  if (!hasAdminDb()) return fail("unavailable");
  return null;
}

/** Ajoute une écriture de dépense (date, catégorie, libellé, montant en F). */
export async function addLedgerEntry(input: unknown): Promise<ActionResult<{ id: string }>> {
  const denied = await guard();
  if (denied) return denied;
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const check = checkEntry(raw, dayKeyOf(Date.now()));
  if (!check.ok) return fail("invalid", check.message, check.field);
  try {
    const sb = createAdminClient();
    const { data, error } = await withTimeout(sb.from("ledger").insert(check.value).select("id").single(), 6000);
    if (error || !data) return fail("error");
    refresh();
    return { ok: true, id: (data as { id: string }).id };
  } catch {
    return fail("error");
  }
}

/** Modifie une écriture existante. */
export async function updateLedgerEntry(id: unknown, input: unknown): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!uuid.safeParse(id).success) return fail("invalid");
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const check = checkEntry(raw, dayKeyOf(Date.now()));
  if (!check.ok) return fail("invalid", check.message, check.field);
  try {
    const sb = createAdminClient();
    const { data, error } = await withTimeout(sb.from("ledger").update(check.value).eq("id", id as string).select("id"), 6000);
    if (error) return fail("error");
    if (!data || data.length === 0) return fail("not_found", "Cette écriture n'existe plus.");
    refresh();
    return { ok: true };
  } catch {
    return fail("error");
  }
}

/** Supprime une écriture. */
export async function deleteLedgerEntry(id: unknown): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!uuid.safeParse(id).success) return fail("invalid");
  try {
    const sb = createAdminClient();
    const { error } = await withTimeout(sb.from("ledger").delete().eq("id", id as string), 6000);
    if (error) return fail("error");
    refresh();
    return { ok: true };
  } catch {
    return fail("error");
  }
}

/** Définit (ou efface, avec `null`) le prix d'achat unitaire d'un produit. Table `product_costs` : admin seulement. */
export async function setProductCost(productId: unknown, cost: unknown): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!uuid.safeParse(productId).success) return fail("invalid");
  const value = cost === null ? null : typeof cost === "number" && Number.isInteger(cost) && cost >= 0 && cost <= 100_000_000 ? cost : undefined;
  if (value === undefined) return fail("invalid", "Prix d'achat invalide.", "cost");
  try {
    const sb = createAdminClient();
    const res =
      value === null
        ? await withTimeout(sb.from("product_costs").delete().eq("product_id", productId as string), 6000)
        : await withTimeout(sb.from("product_costs").upsert({ product_id: productId as string, cost: value }, { onConflict: "product_id" }), 6000);
    if (res.error) return fail("error");
    refresh();
    return { ok: true };
  } catch {
    return fail("error");
  }
}
