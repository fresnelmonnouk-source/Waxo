import { checkBot } from "@/lib/auth/bot-guard";
import { fail, json, readJson } from "@/lib/auth/http";
import { getSessionContext } from "@/lib/auth/user";
import { fieldErrors } from "@/lib/auth/validation";
import { notifyCustomerReplied } from "@/lib/conversations/notify";
import { accountReplySchema } from "@/lib/conversations/schema";
import { loadNotifyTarget, loadOwnThread, markCustomerRead, postMessage } from "@/lib/conversations/store";
import { runAfterResponse } from "@/lib/email/defer";
import { createSharedLimiter } from "@/lib/ratelimit";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const perUser = createSharedLimiter({ name: "conv-reply-user", windowMs: 10 * 60_000, max: 10 });

type Ctx = { params: Promise<{ id: string }> };

/** Fil d'une de MES demandes (session + RLS + filtre user_id ; notes internes exclues). Le marque comme lu. */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await getSessionContext();
  if (!ctx) return fail("unauthorized", 401);
  if (!UUID.test(id)) return fail("notFound", 404);
  try {
    const thread = await loadOwnThread(ctx.sb, ctx.userId, id);
    if (!thread) return fail("notFound", 404);
    try {
      await markCustomerRead(createAdminClient(), id);
    } catch {
      /* indicateur seulement */
    }
    return json({ ok: true, thread });
  } catch {
    return fail("generic", 502);
  }
}

/** Réponse du client connecté. La propriété est vérifiée par une lecture sous RLS AVANT l'écriture (service_role). */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const raw = await readJson(req, 12_000);
  if (!raw) return fail("invalid", 400);
  if (checkBot(raw) === "honeypot") return json({ ok: true });
  const ctx = await getSessionContext();
  if (!ctx) return fail("unauthorized", 401);
  if (!UUID.test(id)) return fail("notFound", 404);
  if (!(await perUser.hit(ctx.userId))) return fail("rateLimited", 429);
  const parsed = accountReplySchema.safeParse(raw);
  if (!parsed.success) return fail("invalid", 422, { fields: fieldErrors(parsed.error) });

  try {
    const owned = await loadOwnThread(ctx.sb, ctx.userId, id);
    if (!owned) return fail("notFound", 404);
    const admin = createAdminClient();
    const posted = await postMessage(admin, id, "client", parsed.data.body);
    if (!posted) return fail("notFound", 404);
    const target = await loadNotifyTarget(admin, id).catch(() => null);
    if (target) await runAfterResponse(() => notifyCustomerReplied({ target, messageId: posted.messageId, body: parsed.data.body, wasUnreadAdmin: posted.wasUnreadAdmin }));
    return json({ ok: true, status: posted.status });
  } catch {
    return fail("unavailable", 503);
  }
}
