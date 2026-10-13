import { createHash } from "node:crypto";
import { checkBot } from "@/lib/auth/bot-guard";
import { fail, json, clientIp, readJson } from "@/lib/auth/http";
import { turnstilePasses, verifyTurnstile } from "@/lib/auth/turnstile";
import { getSessionContext } from "@/lib/auth/user";
import { fieldErrors } from "@/lib/auth/validation";
import { notifyCreated } from "@/lib/conversations/notify";
import { createSchema } from "@/lib/conversations/schema";
import { openConversation } from "@/lib/conversations/store";
import { discussionPath } from "@/lib/conversations/token";
import { subjectFrom } from "@/lib/conversations/types";
import { runAfterResponse } from "@/lib/email/defer";
import { createSharedLimiter } from "@/lib/ratelimit";
import { createAdminClient } from "@/lib/supabase/admin";

const limiter = createSharedLimiter({ name: "contact-limiter", windowMs: 10 * 60_000, max: 5 });
// Un même destinataire ne reçoit pas une rafale d'accusés de réception (formulaire détourné pour inonder une boîte).
const perContact = createSharedLimiter({ name: "contact-dest", windowMs: 60 * 60_000, max: 4 });

/**
 * Formulaire de contact (et passage de l'assistant à l'équipe) → nouvelle CONVERSATION (service_role).
 * Honeypot + délai mini + limites par IP et par destinataire + Turnstile (inerte sans clés) ; jamais d'erreur interne.
 * Réponse : { ok, path } où `path` est le lien privé du fil (/{lang}/discussion/{jeton}), montré au client qui vient
 * d'écrire (seul moyen de suivre sa demande s'il a laissé un téléphone). Seule l'empreinte du jeton est stockée.
 */
export async function POST(req: Request) {
  const body = await readJson(req, 12_000);
  if (!body) return fail("invalid", 400);
  const verdict = checkBot(body);
  if (verdict === "honeypot") return json({ ok: true }); // le robot croit avoir réussi
  if (verdict === "tooFast") return fail("tooFast", 429);
  const ip = clientIp(req);
  if (!(await limiter.hit(ip))) return fail("rateLimited", 429);
  if (!turnstilePasses(await verifyTurnstile(body.captcha, ip))) return fail("captcha", 403);

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail("invalid", 422, { fields: fieldErrors(parsed.error) });
  const v = parsed.data;
  if (!(await perContact.hit(createHash("sha256").update(v.contact).digest("hex").slice(0, 32)))) return fail("rateLimited", 429);

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return fail("unavailable", 503); // Supabase non configuré
  }
  // Client connecté : la demande apparaît aussi dans « Mon compte ». Jamais bloquant.
  let session: Awaited<ReturnType<typeof getSessionContext>> = null;
  try {
    session = (await getSessionContext()) ?? null;
  } catch {
    session = null;
  }
  const input = {
    category: v.category,
    subject: subjectFrom(v.body),
    orderNumber: v.orderNumber,
    name: v.name,
    contact: v.contact,
    userId: session?.userId ?? null,
    locale: v.lang,
    source: v.source,
    body: v.body,
  };
  let opened: { id: string; token: string };
  try {
    opened = await openConversation(admin, input);
  } catch {
    return fail("unavailable", 503);
  }
  await runAfterResponse(() => notifyCreated({ id: opened.id, token: opened.token, input, accountEmail: session?.email ?? null }));
  return json({ ok: true, path: discussionPath(v.lang, opened.token) });
}
