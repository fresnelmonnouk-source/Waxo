"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertAdmin, type AdminUser } from "@/lib/admin/guard";
import { adminDb, withTimeout } from "@/lib/admin/data/products";
import { findUserByEmail, getAdminIds } from "@/lib/admin/data/team";
import { addDecision, normalizeEmail, revokeDecision, type TeamAction } from "@/lib/admin/team";
import { sendTeamAlert } from "@/lib/email/team-alert";
import { siteUrl } from "@/lib/payment/config";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { UNAVAILABLE_MESSAGE, type ActionResult } from "@/components/admin/products/types";

// Server actions de l'équipe d'administration. Même discipline que les autres : assertAdmin() → base joignable →
// validation → écriture service_role → historique → revalidatePath. Le rôle n'est JAMAIS lu depuis le client.

type Fail = Extract<ActionResult, { ok: false }>;
const fail = (code: Fail["code"], message: string): Fail => ({ ok: false, code, message });
const GENERIC = "Une erreur est survenue. Réessayez dans un instant.";
const uuid = z.uuid();

type Prepared = { sb: SupabaseClient; me: AdminUser } | { error: Fail };
async function prepare(): Promise<Prepared> {
  const me = await assertAdmin();
  if (!me) return { error: fail("unauthorized", "Session expirée. Reconnectez-vous.") };
  const sb = adminDb();
  if (!sb) return { error: fail("unavailable", UNAVAILABLE_MESSAGE) };
  return { sb, me };
}

const logErr = (where: string, e: unknown) => {
  const o = (e && typeof e === "object" ? e : {}) as { code?: string; message?: string; status?: number };
  console.error(`[admin/team] ${where}`, o.code ?? o.status ?? "", (o.message ?? "").slice(0, 120));
};

async function logEvent(sb: SupabaseClient, me: AdminUser, targetId: string | null, targetEmail: string, action: TeamAction) {
  // L'historique ne doit jamais faire échouer l'action elle-même (table absente si 0012 n'est pas appliquée).
  const { error } = await sb.from("admin_role_events").insert({ actor_id: me.id, target_id: targetId, target_email: targetEmail, action });
  if (error) logErr("historique", error);
  // Alerte à tous les admins (+ la personne retirée) : un changement d'équipe ne passe jamais inaperçu.
  try {
    const ids = await getAdminIds(sb);
    if (action === "revoke" && targetId) ids.push(targetId);
    const users = await Promise.all(ids.map((id) => withTimeout(sb.auth.admin.getUserById(id)).then((r) => r.data.user?.email ?? "").catch(() => "")));
    await sendTeamAlert({ to: users, actorEmail: me.email, targetEmail, action, key: `${action}:${targetId ?? targetEmail}:${Date.now()}` });
  } catch (e) {
    logErr("alerte", e);
  }
}

/**
 * Sécurise un compte EXISTANT qui devient admin (audit Raphaël) : un tiers a pu le créer avant avec cette adresse et en
 * connaître le mot de passe. On coupe toutes ses sessions, on remplace le mot de passe par un secret aléatoire jamais
 * communiqué, et on envoie un lien de réinitialisation : seul le détenteur de la boîte mail reprend la main.
 */
async function lockDownExistingAccount(sb: SupabaseClient, userId: string, email: string): Promise<boolean> {
  const { error: pwError } = await withTimeout(sb.auth.admin.updateUserById(userId, { password: randomBytes(32).toString("base64url") }));
  if (pwError) {
    logErr("verrouillage mot de passe", pwError);
    return false;
  }
  const { error: sessError } = await withTimeout(sb.rpc("admin_revoke_user_sessions", { p_user: userId }));
  if (sessError) {
    logErr("coupure sessions", sessError);
    return false;
  }
  const env = supabasePublicEnv();
  if (!env) return false;
  // Client anonyme sans persistance : l'e-mail de réinitialisation part comme un « mot de passe oublié » classique.
  const anon = createClient(env.url, env.key, { auth: { persistSession: false, autoRefreshToken: false, flowType: "implicit" } });
  const site = siteUrl();
  const { error: mailError } = await withTimeout(
    anon.auth.resetPasswordForEmail(email, site ? { redirectTo: `${site}/api/auth/callback/fr/recovery` } : undefined),
    8000,
  );
  if (mailError) logErr("e-mail réinitialisation", mailError);
  return true;
}

const isLastAdmin = (e: { message?: string } | null) => !!e?.message && e.message.includes("last_admin");

export async function addAdmin(rawEmail: string): Promise<ActionResult<{ invited: boolean }>> {
  const p = await prepare();
  if ("error" in p) return p.error;
  const email = normalizeEmail(rawEmail);
  if (!email) return fail("invalid", "Adresse e-mail invalide.");
  const { sb, me } = p;
  try {
    const user = await findUserByEmail(sb, email);
    const adminIds = user ? await getAdminIds(sb) : [];
    const decision = addDecision(
      user ? { emailConfirmed: !!user.email_confirmed_at, invited: !!user.invited_at, isAdmin: adminIds.includes(user.id) } : null,
    );
    if (decision === "already") return fail("conflict", "Cette personne est déjà administratrice.");
    if ((decision === "grant" || decision === "unconfirmed") && user) {
      // Verrouillage AVANT de donner le rôle : à aucun moment un mot de passe connu d'un tiers n'ouvre l'admin.
      if (!(await lockDownExistingAccount(sb, user.id, email))) return fail("error", GENERIC);
      const { error } = await withTimeout(sb.from("profiles").update({ role: "admin" }).eq("id", user.id));
      if (error) {
        logErr("grant", error);
        return fail("error", GENERIC);
      }
      await logEvent(sb, me, user.id, email, "grant");
      revalidatePath("/admin/equipe");
      return { ok: true, invited: false };
    }

    // Aucun compte : invitation Supabase (e-mail « Vous êtes invité(e) », modèle Wá xɔ). Le profil est créé en 'client'
    // par le trigger handle_new_user, puis passé admin ici. Seul le détenteur de la boîte mail peut activer le compte.
    const { data, error } = await withTimeout(sb.auth.admin.inviteUserByEmail(email, { data: { locale: "fr" } }), 10_000);
    if (error || !data.user) {
      logErr("invite", error);
      const status = (error as { status?: number } | null)?.status;
      if (status === 429) return fail("error", "Trop d'e-mails envoyés en peu de temps. Réessayez dans quelques minutes.");
      return fail("error", "L'invitation n'a pas pu être envoyée. Réessayez dans un instant.");
    }
    const { error: roleError } = await withTimeout(sb.from("profiles").update({ role: "admin" }).eq("id", data.user.id));
    if (roleError) {
      logErr("invite role", roleError);
      // Pas de compte orphelin à moitié créé : on retire l'invitation.
      await sb.auth.admin.deleteUser(data.user.id).catch(() => undefined);
      return fail("error", GENERIC);
    }
    await logEvent(sb, me, data.user.id, email, "invite");
    revalidatePath("/admin/equipe");
    return { ok: true, invited: true };
  } catch (e) {
    logErr("add", e);
    return fail("error", GENERIC);
  }
}

export async function revokeAdmin(targetId: string): Promise<ActionResult> {
  const p = await prepare();
  if ("error" in p) return p.error;
  if (!uuid.safeParse(targetId).success) return fail("invalid", "Administrateur inconnu.");
  const { sb, me } = p;
  try {
    const adminIds = await getAdminIds(sb);
    const decision = revokeDecision({ actorId: me.id, targetId, adminIds });
    if (decision === "self") return fail("invalid", "Vous ne pouvez pas retirer votre propre accès. Demandez à un autre administrateur.");
    if (decision === "not_admin") return fail("not_found", "Cette personne n'est plus administratrice.");
    if (decision === "last") return fail("conflict", "La boutique doit garder au moins un administrateur.");

    const { error } = await withTimeout(sb.from("profiles").update({ role: "client" }).eq("id", targetId).eq("role", "admin"));
    if (error) {
      if (isLastAdmin(error)) return fail("conflict", "La boutique doit garder au moins un administrateur.");
      logErr("revoke", error);
      return fail("error", GENERIC);
    }
    const { data } = await withTimeout(sb.auth.admin.getUserById(targetId)).catch(() => ({ data: { user: null } }));
    await logEvent(sb, me, targetId, data.user?.email ?? "inconnu", "revoke");
    revalidatePath("/admin/equipe");
    return { ok: true };
  } catch (e) {
    logErr("revoke", e);
    return fail("error", GENERIC);
  }
}
