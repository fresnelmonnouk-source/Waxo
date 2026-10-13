"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/admin/guard";
import { getAllKbDocs, getSettingsForm } from "@/lib/admin/data/settings";
import { getSettings } from "@/lib/catalog";
import { getAdminThread } from "@/lib/conversations/admin-data";
import { buildDraftPrompt, callDraftLlm, finalizeDraft, type DraftFacts } from "@/lib/conversations/ai-draft";
import { absoluteLink, planReplyMail, sendReplyMail, type ReplyMailPlan } from "@/lib/conversations/notify";
import { redactPii } from "@/lib/conversations/redact";
import { adminBodySchema } from "@/lib/conversations/schema";
import { issueLink, loadNotifyTarget, postMessage } from "@/lib/conversations/store";
import { CATEGORIES, STATUSES } from "@/lib/conversations/types";
import { runAfterResponse } from "@/lib/email/defer";
import { onlinePayAvailable } from "@/lib/payment/ready";
import { buildDraft, retrieve, type Draft } from "@/lib/settings/kb-search";
import { tryAdminClient, withTimeout } from "@/lib/settings/db";
import { UUID_RE, fail, type ActionResult } from "@/lib/settings/result";

// « Discussions » (back-office, français). Chaque action commence par assertAdmin() ; écritures en service_role.

const idSchema = z.string().regex(UUID_RE);
const PATH = "/admin/messages";

type Ctx = { adminId: string; sb: NonNullable<ReturnType<typeof tryAdminClient>>; id: string };

async function guard(id: unknown): Promise<Ctx | ReturnType<typeof fail>> {
  const admin = await assertAdmin();
  if (!admin) return fail("unauthorized");
  const sb = tryAdminClient();
  if (!sb) return fail("unavailable");
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return fail("invalid");
  // Le mode démo local n'a pas d'utilisateur réel : pas d'auteur enregistré.
  return { adminId: UUID_RE.test(admin.id) ? admin.id : "", sb, id: parsed.data };
}
const isFail = (v: Ctx | ReturnType<typeof fail>): v is ReturnType<typeof fail> => "ok" in v;

async function updateConversation(id: unknown, patch: Record<string, unknown>): Promise<ActionResult> {
  const g = await guard(id);
  if (isFail(g)) return g;
  try {
    const { data, error } = await withTimeout(g.sb.from("conversations").update(patch).eq("id", g.id).select("id").maybeSingle());
    if (error) return fail("error");
    if (!data) return fail("not_found");
  } catch {
    return fail("error");
  }
  revalidatePath(PATH);
  return { ok: true };
}

/** Statut : nouveau / en cours / résolu. */
export async function setStatusAction(id: unknown, status: unknown): Promise<ActionResult> {
  if (!(await assertAdmin())) return fail("unauthorized");
  const s = z.enum(STATUSES).safeParse(status);
  if (!s.success) return fail("invalid");
  return updateConversation(id, { status: s.data });
}

/** Catégorie (corrige le choix du client). */
export async function setCategoryAction(id: unknown, category: unknown): Promise<ActionResult> {
  if (!(await assertAdmin())) return fail("unauthorized");
  const c = z.enum(CATEGORIES).safeParse(category);
  if (!c.success) return fail("invalid");
  return updateConversation(id, { category: c.data });
}

/** Ancienne action « Marquer traité / à traiter » : résolu ou en cours. */
export async function setMessageDoneAction(id: unknown, done: unknown): Promise<ActionResult> {
  if (!(await assertAdmin())) return fail("unauthorized");
  if (typeof done !== "boolean") return fail("invalid");
  return updateConversation(id, { status: done ? "resolu" : "en_cours" });
}

export type ReplyOutcome = "sent" | "no_email" | "no_site" | "not_configured";

/**
 * Réponse de l'équipe : ajoutée au fil, puis e-mail « Vous avez une réponse » avec un NOUVEAU lien privé (envoyé après
 * la réponse HTTP). Sans e-mail client (contact par téléphone) : `no_email`, l'admin copie le lien et l'envoie sur WhatsApp.
 */
export async function replyAction(id: unknown, body: unknown): Promise<ActionResult<{ outcome: ReplyOutcome }>> {
  const g = await guard(id);
  if (isFail(g)) return g;
  const text = adminBodySchema.safeParse(body);
  if (!text.success) return fail("invalid", text.error.issues[0]?.message);
  try {
    const posted = await postMessage(g.sb, g.id, "equipe", text.data, g.adminId || null);
    if (!posted) return fail("not_found");
    let outcome: ReplyOutcome = "not_configured";
    const target = await loadNotifyTarget(g.sb, g.id);
    if (target) {
      const plan: ReplyMailPlan = await planReplyMail(g.sb, target).catch(() => ({ to: null, reason: "not_configured" as const }));
      if (plan.to !== null) {
        const { to, link } = plan;
        await runAfterResponse(() => sendReplyMail({ target, to, link, messageId: posted.messageId }));
        outcome = "sent";
      } else outcome = plan.reason;
    }
    revalidatePath(PATH);
    return { ok: true, outcome };
  } catch {
    return fail("error");
  }
}

/** Note interne : visible de l'équipe seulement, jamais du client (ni page, ni API, ni e-mail, ni IA). */
export async function addNoteAction(id: unknown, body: unknown): Promise<ActionResult> {
  const g = await guard(id);
  if (isFail(g)) return g;
  const text = adminBodySchema.safeParse(body);
  if (!text.success) return fail("invalid", text.error.issues[0]?.message);
  try {
    const posted = await postMessage(g.sb, g.id, "note_interne", text.data, g.adminId || null);
    if (!posted) return fail("not_found");
  } catch {
    return fail("error");
  }
  revalidatePath(PATH);
  return { ok: true };
}

/** Lien privé à copier (réponse envoyée sur WhatsApp à un client sans e-mail). Chaque appel crée un nouveau lien. */
export async function issueLinkAction(id: unknown): Promise<ActionResult<{ url: string }>> {
  const g = await guard(id);
  if (isFail(g)) return g;
  try {
    const target = await loadNotifyTarget(g.sb, g.id);
    if (!target) return fail("not_found");
    const token = await issueLink(g.sb, g.id);
    const url = absoluteLink(target.locale, token);
    if (!url) return fail("error", "Adresse publique du site inconnue (NEXT_PUBLIC_SITE_URL).");
    return { ok: true, url };
  } catch {
    return fail("error");
  }
}

/**
 * « Brouillon IA » : DeepSeek reçoit la catégorie, le fil pseudonymisé (sans nom, téléphone, e-mail, adresse, numéro de
 * commande ; notes internes exclues) et les faits de la boutique. Sans clé ou en cas d'échec : modèle automatique
 * (base de connaissances, sans IA). Rien n'est envoyé au client.
 */
export async function draftReplyAction(id: unknown): Promise<ActionResult<{ draft: Draft }>> {
  if (!(await assertAdmin())) return fail("unauthorized");
  const parsedId = z.string().min(1).max(64).safeParse(id);
  if (!parsedId.success) return fail("invalid");
  try {
    const [thread, { docs }, { form }] = await Promise.all([getAdminThread(parsedId.data), getAllKbDocs(), getSettingsForm()]);
    if (!thread) return fail("not_found");
    const firstName = (thread.name.trim().split(/\s+/)[0] || "").slice(0, 60);
    const customerText = thread.messages.filter((m) => m.author === "client").map((m) => m.body).join(" ");
    const query = redactPii(`${thread.subject} ${customerText}`, [thread.name]);
    const hits = retrieve(query, docs, 3);
    const sources = hits.map((h) => ({ title: h.title, tag: h.tag }));

    let facts: DraftFacts | null = null;
    try {
      const s = await getSettings();
      facts = {
        shopName: s.brand.shopName,
        shipping: s.shipping,
        pay: { online: await onlinePayAvailable(s.pay), cod: s.pay.cod },
        kb: hits.map((h) => ({ title: h.title, text: h.text })),
      };
    } catch {
      facts = null;
    }
    if (facts) {
      const prompt = buildDraftPrompt({
        lang: thread.locale,
        category: thread.category,
        orderStatusLabel: thread.order?.statusLabel || null,
        messages: thread.messages,
        customerName: thread.name,
        facts,
      });
      const out = await callDraftLlm(prompt);
      if (out) return { ok: true, draft: { text: finalizeDraft(out, firstName, form.aiSign, thread.locale), mode: "Brouillon IA (à relire)", sources } };
    }
    const last = [...thread.messages].reverse().find((m) => m.author === "client");
    const draft = buildDraft(
      {
        name: thread.name,
        contact: "",
        subject: thread.subject,
        text: last?.body ?? "",
        orderNumber: thread.order?.number ?? null,
        orderStatusLabel: thread.order?.statusLabel ?? null,
        aiSign: form.aiSign,
      },
      docs,
    );
    return { ok: true, draft };
  } catch {
    return fail("error");
  }
}
