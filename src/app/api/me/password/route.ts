import { cookies } from "next/headers";
import { fail, json, readJson, clientIp } from "@/lib/auth/http";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { RECOVERY_COOKIE } from "@/lib/auth/recovery";
import { withTimeout } from "@/lib/auth/timeout";
import { getSessionContext } from "@/lib/auth/user";
import { fieldErrors, passwordSchema } from "@/lib/auth/validation";
import { createPublicClient } from "@/lib/supabase/public";

const limiter = createRateLimiter({ windowMs: 10 * 60_000, max: 8 });

/**
 * Changement de mot de passe. L'actuel est revérifié (client anon sans session persistée), puis la mise à jour passe par la session.
 * Exception : session ouverte via un lien de réinitialisation (cookie `wx_recovery` = id de l'utilisateur) → pas d'ancien mot de passe.
 */
export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return fail("unauthorized", 401);
  if (!limiter.hit(`${ctx.userId}|${clientIp(req)}`)) return fail("rateLimited", 429);

  const body = await readJson(req);
  if (!body) return fail("invalid", 400);
  const parsed = passwordSchema.safeParse(body);
  if (!parsed.success) return fail("invalid", 422, { fields: fieldErrors(parsed.error) });
  const { current, next, recovery } = parsed.data;

  const store = await cookies();
  const viaRecovery = recovery === true && store.get(RECOVERY_COOKIE)?.value === ctx.userId;
  if (!viaRecovery && !current) return fail("invalid", 422, { fields: { current: "passRequired" } });

  try {
    if (!viaRecovery && current) {
      // Client anon éphémère : la vérification ne touche pas aux cookies de la vraie session.
      const probe = createPublicClient();
      const check = await withTimeout(probe.auth.signInWithPassword({ email: ctx.email, password: current }));
      if (check.error) return fail("invalid", 422, { fields: { current: "pwCurrentWrong" } });
    }

    const { error } = await withTimeout(ctx.sb.auth.updateUser({ password: next }));
    if (error) return fail("invalid", 422, { fields: { next: /different/i.test(error.message) ? "pwSame" : "passWeak" } });
    if (viaRecovery) store.set(RECOVERY_COOKIE, "", { path: "/api", maxAge: 0 });
    return json({ ok: true });
  } catch {
    return fail("generic", 502);
  }
}
