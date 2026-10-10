"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { assertAdmin } from "@/lib/admin/guard";
import { loadFedapayConfig, fedapayStatus, saveFedapaySecrets, type FedapayStatus } from "@/lib/payment/credentials";
import { pingFedapay } from "@/lib/payment/fedapay";
import { createSharedLimiter } from "@/lib/ratelimit";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { createSessionClient } from "@/lib/supabase/server";
import { tryAdminClient, withTimeout } from "@/lib/settings/db";
import { KB_TAGS, type KbEntry } from "@/lib/settings/kb-search";
import { UUID_RE, fail, type ActionResult } from "@/lib/settings/result";
import { parseSettingsForm } from "@/lib/settings/schema";

// Toutes les actions : assertAdmin() d'abord, entrée validée par Zod, écriture service_role, jamais d'erreur SQL côté client.

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function refreshShop() {
  revalidatePath("/[lang]", "layout"); // marque, livraison, paiements, mentions légales : lus par toute la boutique
  revalidatePath("/admin/reglages");
}

export async function saveSettingsAction(input: unknown): Promise<ActionResult> {
  if (!(await assertAdmin())) return fail("unauthorized");
  const sb = tryAdminClient();
  if (!sb) return fail("unavailable");
  const parsed = parseSettingsForm(input);
  if (!parsed.ok) return { ...fail("invalid", "Corrigez les champs signalés."), fieldErrors: parsed.errors as Record<string, string> };
  const d = parsed.data;
  try {
    // Fusion avec l'existant : les champs que ce formulaire ne gère pas (ex. shipping.returnDays) sont conservés.
    const { data: current, error: readError } = await withTimeout(sb.from("settings").select("key,value").in("key", ["brand", "shipping", "pay", "legal", "flags"]));
    if (readError) return fail("error");
    const old = Object.fromEntries((current ?? []).map((r) => [r.key as string, rec(r.value)]));
    const rows = [
      { key: "brand", value: { ...old.brand, ...d.brand }, is_public: true },
      { key: "shipping", value: { ...old.shipping, ...d.shipping }, is_public: true },
      { key: "pay", value: { ...old.pay, ...d.pay }, is_public: true },
      { key: "legal", value: { ...old.legal, ...d.legal }, is_public: true },
      { key: "flags", value: { ...old.flags, ...d.flags }, is_public: false },
    ];
    const { error } = await withTimeout(sb.from("settings").upsert(rows, { onConflict: "key" }));
    if (error) return fail("error");
  } catch {
    return fail("error");
  }
  refreshShop();
  return { ok: true };
}

// ───────────────────────── Base de connaissances ─────────────────────────
const kbSchema = z
  .object({
    id: z.string().regex(UUID_RE).optional(),
    title: z.string().trim().min(3, "Titre trop court.").max(120, "Titre trop long (120 caractères maximum)."),
    tag: z.enum(KB_TAGS),
    text: z.string().trim().min(20, "Contenu trop court (20 caractères minimum).").max(2000, "Contenu trop long (2 000 caractères maximum)."),
    keywords: z.string().trim().max(300, "Mots-clés trop longs (300 caractères maximum)."),
  })
  .strict();

export async function saveKbEntryAction(input: unknown): Promise<ActionResult<{ entry: KbEntry }>> {
  if (!(await assertAdmin())) return fail("unauthorized");
  const sb = tryAdminClient();
  if (!sb) return fail("unavailable");
  const parsed = kbSchema.safeParse(input);
  if (!parsed.success) return fail("invalid", parsed.error.issues[0]?.message ?? "Données invalides.");
  const { id, ...fields } = parsed.data;
  try {
    const query = id
      ? sb.from("kb").update(fields).eq("id", id).select("id,tag,title,text,keywords").maybeSingle()
      : sb.from("kb").insert({ ...fields, active: true }).select("id,tag,title,text,keywords").maybeSingle();
    const { data, error } = await withTimeout(query);
    if (error) return fail("error");
    if (!data) return fail("not_found");
    revalidatePath("/admin/reglages");
    return { ok: true, entry: { id: String(data.id), tag: String(data.tag), title: String(data.title), text: String(data.text), keywords: String(data.keywords ?? "") } };
  } catch {
    return fail("error");
  }
}

export async function deleteKbEntryAction(id: unknown): Promise<ActionResult> {
  if (!(await assertAdmin())) return fail("unauthorized");
  const sb = tryAdminClient();
  if (!sb) return fail("unavailable");
  if (typeof id !== "string" || !UUID_RE.test(id)) return fail("invalid");
  try {
    const { error } = await withTimeout(sb.from("kb").delete().eq("id", id));
    if (error) return fail("error");
  } catch {
    return fail("error");
  }
  revalidatePath("/admin/reglages");
  return { ok: true };
}

// ───────────────────────── Mot de passe de l'administrateur connecté ─────────────────────────
const pwLimiter = createSharedLimiter({ name: "admin-panel-reglages-pwLimiter", windowMs: 10 * 60 * 1000, max: 5 });
const pwSchema = z
  .object({
    current: z.string().min(1, "Mot de passe incorrect.").max(200, "Mot de passe incorrect."),
    next: z.string().min(8, "8 caractères minimum.").max(72, "72 caractères maximum."),
  })
  .strict();

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  const admin = await assertAdmin();
  if (!admin) return fail("unauthorized");
  const env = supabasePublicEnv();
  if (!env || admin.id === "demo-admin") return fail("unavailable");
  const parsed = pwSchema.safeParse(input);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[i.path[0] === "next" ? "next" : "current"] ??= i.message;
    return fail("invalid", "Vérifiez les champs.", fe);
  }
  if (!(await pwLimiter.hit(admin.id))) return fail("rate_limited");
  const { current, next } = parsed.data;
  if (current === next) return fail("invalid", "Choisissez un mot de passe différent.", { next: "Identique à l'actuel." });
  try {
    // Réauthentification avec un client jetable (sans cookies) : prouve que l'appelant connaît le mot de passe actuel.
    const probe = createClient(env.url, env.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: signInError } = await withTimeout(probe.auth.signInWithPassword({ email: admin.email, password: current }));
    if (signInError) return fail("invalid", "Mot de passe incorrect.", { current: "Mot de passe incorrect." });
    const session = await createSessionClient();
    const { error } = await withTimeout(session.auth.updateUser({ password: next }));
    if (error) return fail("error", "Impossible de modifier le mot de passe. Réessayez.");
  } catch {
    return fail("error");
  }
  return { ok: true };
}

// ───────────────────────── Paiement FedaPay (clés saisies depuis l'espace admin) ─────────────────────────
// Les secrets ne quittent jamais le serveur : ils sont validés, chiffrés (AES-256-GCM) puis stockés ; seules des valeurs
// masquées reviennent à l'écran. Chaque action : assertAdmin() d'abord.
const payLimiter = createSharedLimiter({ name: "admin-panel-reglages-fedapay", windowMs: 10 * 60 * 1000, max: 15 });
const KEY_RE = /^sk_(sandbox|live)_[A-Za-z0-9_-]{8,190}$/;
const HOOK_RE = /^wh_(sandbox|live)_[A-Za-z0-9_-]{8,190}$/;

const fedapaySchema = z
  .object({
    secretKey: z.string().trim().max(200).optional(), // vide = inchangé
    webhookSecret: z.string().trim().max(200).optional(),
    confirmLive: z.boolean().optional(),
  })
  .strict();

export type FedapayActionData = { status: FedapayStatus };

export async function saveFedapayAction(input: unknown): Promise<ActionResult<FedapayActionData>> {
  const admin = await assertAdmin();
  if (!admin) return fail("unauthorized");
  const parsed = fedapaySchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  if (!(await payLimiter.hit(admin.id))) return fail("rate_limited");
  const secretKey = parsed.data.secretKey || undefined;
  const webhookSecret = parsed.data.webhookSecret || undefined;
  if (!secretKey && !webhookSecret) return fail("invalid", "Renseignez au moins un des deux champs.");

  const fe: Record<string, string> = {};
  if (secretKey && !KEY_RE.test(secretKey)) fe.secretKey = "Clé invalide : elle commence par sk_sandbox_ ou sk_live_.";
  if (webhookSecret && !HOOK_RE.test(webhookSecret)) fe.webhookSecret = "Secret invalide : il commence par wh_sandbox_ ou wh_live_.";
  if (Object.keys(fe).length) return fail("invalid", "Corrigez les champs signalés.", fe);

  // Le mode (essai / réel) de la clé et du secret de webhook doivent être le même, sinon aucun paiement ne serait confirmé.
  const current = await fedapayStatus();
  const modeOfKey = secretKey ? (secretKey.startsWith("sk_live_") ? "live" : "sandbox") : current.mode;
  const modeOfHook = webhookSecret ? (webhookSecret.startsWith("wh_live_") ? "live" : "sandbox") : current.webhookMasked?.startsWith("wh_live_") ? "live" : current.webhookMasked?.startsWith("wh_sandbox_") ? "sandbox" : null;
  if (modeOfKey && modeOfHook && modeOfKey !== modeOfHook) {
    return fail("invalid", "La clé et le secret de webhook ne sont pas du même mode (essai / réel).", { [secretKey ? "secretKey" : "webhookSecret"]: "Mode différent de l'autre champ." });
  }
  if ((secretKey?.startsWith("sk_live_") || webhookSecret?.startsWith("wh_live_")) && parsed.data.confirmLive !== true) {
    return fail("invalid", "Cochez la confirmation : une clé réelle encaisse de vrais paiements.", { confirmLive: "Confirmation requise." });
  }

  const res = await saveFedapaySecrets({ secretKey, webhookSecret });
  if (!res.ok) {
    if (res.code === "unavailable") return fail("unavailable");
    if (res.code === "no_encryption") return fail("error", "Chiffrement indisponible : ajoutez SETTINGS_ENCRYPTION_KEY (16 caractères minimum) dans les variables du serveur.");
    return fail("error");
  }
  revalidatePath("/admin/reglages");
  return { ok: true, status: await fedapayStatus() };
}

export async function clearFedapayAction(which: unknown): Promise<ActionResult<FedapayActionData>> {
  const admin = await assertAdmin();
  if (!admin) return fail("unauthorized");
  if (which !== "secret" && which !== "webhook" && which !== "all") return fail("invalid");
  if (!(await payLimiter.hit(admin.id))) return fail("rate_limited");
  const res = await saveFedapaySecrets({
    ...(which !== "webhook" ? { secretKey: null } : {}),
    ...(which !== "secret" ? { webhookSecret: null } : {}),
  });
  if (!res.ok) return fail(res.code === "unavailable" ? "unavailable" : "error");
  revalidatePath("/admin/reglages");
  return { ok: true, status: await fedapayStatus() };
}

export async function testFedapayAction(): Promise<ActionResult<{ mode: "sandbox" | "live" }>> {
  const admin = await assertAdmin();
  if (!admin) return fail("unauthorized");
  if (!(await payLimiter.hit(admin.id))) return fail("rate_limited");
  const cfg = await loadFedapayConfig();
  if (!cfg) return fail("invalid", "Aucune clé FedaPay enregistrée.");
  const result = await pingFedapay(cfg);
  if (result === "ok") return { ok: true, mode: cfg.env };
  if (result === "unauthorized") return fail("invalid", "FedaPay refuse cette clé : vérifiez qu'elle est complète et du bon mode (essai / réel).");
  return fail("error", "FedaPay est injoignable pour le moment. Réessayez dans un instant.");
}
