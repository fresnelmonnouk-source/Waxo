import { fail, json, readJson } from "@/lib/auth/http";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { withTimeout } from "@/lib/auth/timeout";
import { getSessionContext } from "@/lib/auth/user";
import { fieldErrors, profileSchema } from "@/lib/auth/validation";
import { createAdminClient } from "@/lib/supabase/admin";

const limiter = createRateLimiter({ windowMs: 60_000, max: 20 });

/**
 * Mise à jour du profil. Colonnes autorisées UNIQUEMENT : first_name, last_name, phone, address, news
 * (la colonne `role` est protégée en base ; on ne l'écrit jamais). L'e-mail ne change pas ici.
 */
export async function PATCH(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return fail("unauthorized", 401);
  if (!limiter.hit(ctx.userId)) return fail("rateLimited", 429);

  const body = await readJson(req);
  if (!body) return fail("invalid", 400);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) return fail("invalid", 422, { fields: fieldErrors(parsed.error) });
  const v = parsed.data;

  try {
    const { error } = await withTimeout(
      ctx.sb
        .from("profiles")
        .update({ first_name: v.firstName, last_name: v.lastName, phone: v.phone, address: v.address, news: v.news })
        .eq("id", ctx.userId),
    );
    if (error) return fail("generic", 502);
  } catch {
    return fail("generic", 502);
  }

  // Abonnement newsletter (e-mail du compte) aligné sur la préférence — meilleur effort, sans bloquer l'enregistrement.
  try {
    const admin = createAdminClient();
    if (v.news) {
      await admin.from("newsletter_subs").upsert({ channel: "email", value: ctx.email.toLowerCase(), consent: true }, { onConflict: "channel,value", ignoreDuplicates: true });
    } else {
      await admin.from("newsletter_subs").delete().eq("channel", "email").eq("value", ctx.email.toLowerCase());
    }
  } catch {
    /* Supabase service_role absent ou injoignable : le profil est déjà enregistré */
  }
  return json({ ok: true });
}
