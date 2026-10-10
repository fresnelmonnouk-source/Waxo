"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/admin/guard";
import { DB_ERROR, UNAVAILABLE, adminDb, withTimeout } from "@/lib/orders/db";
import type { ActionResult } from "@/lib/orders/types";
import {
  courierDeleteSchema,
  courierFieldsSchema,
  courierToggleSchema,
  courierUpdateSchema,
  firstIssue,
} from "@/lib/orders/validation";

// Server actions « livreurs » : création, modification, pause / réactivation, suppression.
// Les changements de statut des commandes (remise au livreur, livrée, échec) passent par commandes/actions.ts.

const FORBIDDEN = { ok: false as const, code: "forbidden", message: "Session expirée ou accès refusé : reconnectez-vous." };

function refresh() {
  revalidatePath("/admin/livraisons");
  revalidatePath("/admin/commandes");
}

export async function createCourierAction(input: unknown): Promise<ActionResult<{ message: string }>> {
  if (!(await assertAdmin())) return FORBIDDEN;
  const parsed = courierFieldsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", message: firstIssue(parsed.error) };
  const db = adminDb();
  if (!db) return UNAVAILABLE;
  try {
    const { count } = await withTimeout(db.from("couriers").select("id", { count: "exact", head: true }));
    if ((count ?? 0) >= 200) return { ok: false, code: "limit", message: "Nombre maximal de livreurs atteint (200)." };
    const { error } = await withTimeout(
      db.from("couriers").insert({ name: parsed.data.name, phone: parsed.data.phone, zone: parsed.data.zone, active: true }),
    );
    if (error) return DB_ERROR;
    refresh();
    return { ok: true, message: "Livreur ajouté." };
  } catch {
    return DB_ERROR;
  }
}

export async function updateCourierAction(input: unknown): Promise<ActionResult<{ message: string }>> {
  if (!(await assertAdmin())) return FORBIDDEN;
  const parsed = courierUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", message: firstIssue(parsed.error) };
  const db = adminDb();
  if (!db) return UNAVAILABLE;
  try {
    const { data, error } = await withTimeout(
      db
        .from("couriers")
        .update({ name: parsed.data.name, phone: parsed.data.phone, zone: parsed.data.zone })
        .eq("id", parsed.data.courierId)
        .select("id"),
    );
    if (error) return DB_ERROR;
    if (!data || data.length === 0) return { ok: false, code: "not_found", message: "Livreur introuvable." };
    refresh();
    return { ok: true, message: "Livreur modifié." };
  } catch {
    return DB_ERROR;
  }
}

/** Mettre en pause / réactiver. Une pause n'enlève pas le livreur des commandes déjà en cours. */
export async function setCourierActiveAction(input: unknown): Promise<ActionResult<{ message: string }>> {
  if (!(await assertAdmin())) return FORBIDDEN;
  const parsed = courierToggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", message: firstIssue(parsed.error) };
  const db = adminDb();
  if (!db) return UNAVAILABLE;
  try {
    const { data, error } = await withTimeout(
      db.from("couriers").update({ active: parsed.data.active }).eq("id", parsed.data.courierId).select("id"),
    );
    if (error) return DB_ERROR;
    if (!data || data.length === 0) return { ok: false, code: "not_found", message: "Livreur introuvable." };
    refresh();
    return { ok: true, message: parsed.data.active ? "Livreur réactivé." : "Livreur mis en pause." };
  } catch {
    return DB_ERROR;
  }
}

/** Suppression refusée tant que le livreur a des commandes à expédier ou en route (→ le mettre en pause). */
export async function deleteCourierAction(input: unknown): Promise<ActionResult<{ message: string }>> {
  if (!(await assertAdmin())) return FORBIDDEN;
  const parsed = courierDeleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", message: firstIssue(parsed.error) };
  const db = adminDb();
  if (!db) return UNAVAILABLE;
  try {
    const { count, error: cErr } = await withTimeout(
      db
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("courier_id", parsed.data.courierId)
        .in("status", ["nouvelle", "preparation", "livraison"]),
    );
    if (cErr) return DB_ERROR;
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        code: "in_use",
        message: "Ce livreur a des commandes en cours : mettez-le en pause plutôt que de le supprimer.",
      };
    }
    const { error } = await withTimeout(db.from("couriers").delete().eq("id", parsed.data.courierId));
    if (error) return DB_ERROR;
    refresh();
    return { ok: true, message: "Livreur supprimé." };
  } catch {
    return DB_ERROR;
  }
}
