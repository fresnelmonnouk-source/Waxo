import "server-only";

/**
 * Envoi via l'API REST Resend (pas de dépendance). Variables : RESEND_API_KEY (obligatoire),
 * EMAIL_FROM (ex. « Wá xɔ <commandes@votre-domaine> » ; domaine vérifié chez Resend). Ne jette jamais.
 */

const TIMEOUT_MS = 8000;
// Expéditeur de test de Resend : n'envoie qu'au propriétaire du compte. À remplacer par EMAIL_FROM en production.
const FALLBACK_FROM = "Wá xɔ <onboarding@resend.dev>";

export type ResendMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  idempotencyKey: string;
};

export type ResendResult = { ok: true; id: string | null } | { ok: false; reason: "not_configured" | "rejected" | "network" };

export async function sendViaResend(msg: ResendMessage): Promise<ResendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { ok: false, reason: "not_configured" };
  const from = process.env.EMAIL_FROM?.trim() || FALLBACK_FROM;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": msg.idempotencyKey.slice(0, 250),
      },
      body: JSON.stringify({
        from,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
      }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, reason: "rejected" };
    const json = (await res.json().catch(() => null)) as { id?: unknown } | null;
    return { ok: true, id: typeof json?.id === "string" ? json.id : null };
  } catch {
    return { ok: false, reason: "network" };
  } finally {
    clearTimeout(timer);
  }
}
