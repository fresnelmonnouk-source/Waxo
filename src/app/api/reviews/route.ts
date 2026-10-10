import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { API_STATUS, apiMessage, type ApiErrorCode, type ApiLang } from "@/lib/checkout/errors";
import { clientIp } from "@/lib/checkout/rate-limit";
import { rateLimitShared } from "@/lib/ratelimit";
import { looksLikeBot, reviewSchema } from "@/lib/checkout/schema";

/**
 * POST /api/reviews — publie un avis (maquette : seuls les clients inscrits peuvent en donner un).
 * L'auteur vient du PROFIL de la session (jamais du client sauf si le profil n'a pas de nom). Insertion :
 * verified=false, seed=false, hidden=false ; la modération et le badge « Achat vérifié » relèvent de l'admin.
 */

const MAX_BODY_BYTES = 6_000;
const RATE_LIMIT = { max: 6, windowMs: 10 * 60_000 };

function fail(lang: ApiLang, code: ApiErrorCode, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, code, message: apiMessage(lang, code), ...extra }, { status: API_STATUS[code] });
}

/** « Afi Houngbédji » → « Afi H. » */
function displayName(first: string, last: string): string {
  const f = first.trim();
  const l = last.trim();
  return [f, l ? `${l.charAt(0).toUpperCase()}.` : ""].filter(Boolean).join(" ");
}

export async function POST(request: Request) {
  let lang: ApiLang = "fr";
  try {
    if (!(await rateLimitShared(`reviews:${clientIp(request.headers)}`, RATE_LIMIT.max, RATE_LIMIT.windowMs))) {
      return fail(lang, "rate_limited");
    }

    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return fail(lang, "invalid_request");
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return fail(lang, "invalid_request");
    }
    const rawObj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    if (rawObj.lang === "en") lang = "en";

    if (
      looksLikeBot({
        website: typeof rawObj.website === "string" ? rawObj.website : undefined,
        t: typeof rawObj.t === "number" ? rawObj.t : undefined,
      })
    ) {
      return fail(lang, "invalid_request");
    }

    const parsed = reviewSchema.safeParse(raw);
    if (!parsed.success) return fail(lang, "invalid_request");
    const input = parsed.data;
    lang = input.lang;

    if (!supabasePublicEnv()) return fail(lang, "unavailable");
    let admin: ReturnType<typeof createAdminClient>;
    let userId: string | null = null;
    try {
      admin = createAdminClient();
      const sb = await createSessionClient();
      const { data } = await sb.auth.getUser();
      userId = data.user?.id ?? null;
    } catch {
      return fail(lang, "unavailable");
    }
    if (!userId) return fail(lang, "login_required");

    const { data: profile } = await admin
      .from("profiles")
      .select("first_name,last_name")
      .eq("id", userId)
      .maybeSingle();
    const author =
      displayName(String(profile?.first_name ?? ""), String(profile?.last_name ?? "")) ||
      input.author ||
      (lang === "en" ? "Customer" : "Client");

    const { data: existing, error: existingError } = await admin
      .from("reviews")
      .select("id")
      .eq("product_id", input.productId)
      .eq("user_id", userId)
      .limit(1);
    if (existingError) return fail(lang, "server_error");
    if (existing && existing.length > 0) return fail(lang, "already_reviewed");

    const { data: inserted, error } = await admin
      .from("reviews")
      .insert({
        product_id: input.productId,
        user_id: userId,
        author,
        rating: input.rating,
        body: input.body,
        verified: false,
        seed: false,
        hidden: false,
      })
      .select("id,created_at")
      .single();
    // Course (double-tap, deux onglets) : l'index unique (0010) refuse le 2e avis → même réponse que le contrôle ci-dessus.
    if (error?.code === "23505") return fail(lang, "already_reviewed");
    if (error || !inserted) return fail(lang, "server_error");

    return NextResponse.json({
      ok: true,
      review: { id: inserted.id, author, rating: input.rating, body: input.body, createdAt: inserted.created_at },
    });
  } catch {
    return fail(lang, "server_error");
  }
}
