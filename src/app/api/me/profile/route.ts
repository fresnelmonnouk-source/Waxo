import { fail, json, readJson } from "@/lib/auth/http";
import { createSharedLimiter } from "@/lib/ratelimit";
import { withTimeout } from "@/lib/auth/timeout";
import { getSessionContext } from "@/lib/auth/user";
import { fieldErrors, profileSchema } from "@/lib/auth/validation";
import { createAdminClient } from "@/lib/supabase/admin";

const limiter = createSharedLimiter({ name: "me-profile-limiter", windowMs: 60_000, max: 20 });
/**
 * Audit Raphaël F6 : un refus « numéro déjà pris » confirme qu'un compte existe pour ce numéro. Sans vérification OTP,
 * on ne peut pas le taire sans faire croire au client que son numéro est enregistré ; on borne donc l'oracle :
 * 5 conflits par heure et par compte (au lieu de 20 essais par minute), puis 429.
 */
const conflictLimiter = createSharedLimiter({ name: "me-profile-phone-conflict", windowMs: 60 * 60_000, max: 5 });

/**
 * Mise à jour du profil. Colonnes autorisées UNIQUEMENT : first_name, last_name, phone, address, news
 * (la colonne `role` est protégée en base ; on ne l'écrit jamais). L'e-mail ne change pas ici.
 */
export async function PATCH(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return fail("unauthorized", 401);
  if (!(await limiter.hit(ctx.userId))) return fail("rateLimited", 429);

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
    // Numéro déjà rattaché à un autre compte (index unique, 0010) : erreur de champ, jamais un 502.
    if (error?.code === "23505") {
      if (!(await conflictLimiter.hit(ctx.userId))) return fail("rateLimited", 429);
      return fail("invalid", 422, { fields: { phone: "phoneTaken" } });
    }
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
