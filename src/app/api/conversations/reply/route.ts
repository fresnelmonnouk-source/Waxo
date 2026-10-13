import { checkBot } from "@/lib/auth/bot-guard";
import { fail, json, clientIp, readJson } from "@/lib/auth/http";
import { fieldErrors } from "@/lib/auth/validation";
import { notifyCustomerReplied } from "@/lib/conversations/notify";
import { tokenReplySchema } from "@/lib/conversations/schema";
import { conversationIdFromToken, loadNotifyTarget, postMessage } from "@/lib/conversations/store";
import { runAfterResponse } from "@/lib/email/defer";
import { createSharedLimiter } from "@/lib/ratelimit";
import { createAdminClient } from "@/lib/supabase/admin";

const perIp = createSharedLimiter({ name: "conv-reply-ip", windowMs: 10 * 60_000, max: 10 });
const perConversation = createSharedLimiter({ name: "conv-reply-conv", windowMs: 60 * 60_000, max: 20 });

/**
 * Réponse du client depuis son lien privé. Le jeton voyage dans le CORPS (jamais dans l'URL de l'API). Jeton mal formé
 * ou inconnu : même 404 neutre. Honeypot + délai mini + limites par IP et par conversation ; jamais d'erreur interne.
 */
export async function POST(req: Request) {
  const raw = await readJson(req, 12_000);
  if (!raw) return fail("invalid", 400);
  const verdict = checkBot(raw);
  if (verdict === "honeypot") return json({ ok: true });
  if (verdict === "tooFast") return fail("tooFast", 429);
  if (!(await perIp.hit(clientIp(req)))) return fail("rateLimited", 429);

  const parsed = tokenReplySchema.safeParse(raw);
  if (!parsed.success) return fail("invalid", 422, { fields: fieldErrors(parsed.error) });
  const v = parsed.data;

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return fail("unavailable", 503);
  }
  try {
    const id = await conversationIdFromToken(admin, v.token);
    if (!id) return fail("notFound", 404);
    if (!(await perConversation.hit(id))) return fail("rateLimited", 429);
    const posted = await postMessage(admin, id, "client", v.body);
    if (!posted) return fail("notFound", 404);
    const target = await loadNotifyTarget(admin, id).catch(() => null);
    if (target) await runAfterResponse(() => notifyCustomerReplied({ target, messageId: posted.messageId, body: v.body, wasUnreadAdmin: posted.wasUnreadAdmin }));
    return json({ ok: true, status: posted.status });
  } catch {
    return fail("unavailable", 503);
  }
}
