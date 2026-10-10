import { checkBot } from "@/lib/auth/bot-guard";
import { fail, json, clientIp, readJson } from "@/lib/auth/http";
import { createSharedLimiter } from "@/lib/ratelimit";
import { withTimeout } from "@/lib/auth/timeout";
import { CONTACT_SUBJECT_LABELS, contactSchema, fieldErrors } from "@/lib/auth/validation";
import { createAdminClient } from "@/lib/supabase/admin";

const limiter = createSharedLimiter({ name: "contact-limiter", windowMs: 10 * 60_000, max: 5 });

/** Formulaire de contact → table `messages` (service_role). Honeypot + délai mini + limite par IP ; jamais d'erreur interne renvoyée. */
export async function POST(req: Request) {
  const body = await readJson(req, 12_000);
  if (!body) return fail("invalid", 400);
  const verdict = checkBot(body);
  if (verdict === "honeypot") return json({ ok: true }); // le robot croit avoir réussi
  if (verdict === "tooFast") return fail("tooFast", 429);
  if (!(await limiter.hit(clientIp(req)))) return fail("rateLimited", 429);

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) return fail("invalid", 422, { fields: fieldErrors(parsed.error) });
  const v = parsed.data;

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return fail("unavailable", 503); // Supabase non configuré (J1)
  }
  try {
    const { error } = await withTimeout(
      admin.from("messages").insert({
        name: v.name,
        contact: v.contact,
        subject: CONTACT_SUBJECT_LABELS[v.subject],
        order_number: v.orderNumber || null,
        body: v.body,
      }),
    );
    if (error) return fail("unavailable", 503);
    return json({ ok: true });
  } catch {
    return fail("unavailable", 503);
  }
}
