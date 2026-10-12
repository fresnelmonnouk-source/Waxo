import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { API_STATUS, apiMessage, type ApiErrorCode, type ApiLang } from "@/lib/checkout/errors";
import { clientIp } from "@/lib/checkout/rate-limit";
import { normPhone } from "@/lib/checkout/phone";
import { rateLimitShared } from "@/lib/ratelimit";
import { looksLikeBot } from "@/lib/checkout/schema";
import { publicAuthor, validateSiteReview } from "@/lib/site-reviews/logic";

/**
 * POST /api/site-reviews — avis sur la BOUTIQUE (migration 0018). Réservé à un client connecté ayant au moins une
 * commande LIVRÉE (rattachée à son compte ou à son numéro de téléphone) : « client vérifié ». Un avis par compte,
 * toujours « à valider » (status pending) : l'admin publie. L'auteur vient du PROFIL (« Afi H. »), jamais du navigateur.
 */

const MAX_BODY_BYTES = 4_000;
const RATE_LIMIT = { max: 5, windowMs: 10 * 60_000 };

function fail(lang: ApiLang, code: ApiErrorCode, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, code, message: apiMessage(lang, code), ...extra }, { status: API_STATUS[code] });
}

export async function POST(request: Request) {
  let lang: ApiLang = "fr";
  try {
    if (!(await rateLimitShared(`site-reviews:${clientIp(request.headers)}`, RATE_LIMIT.max, RATE_LIMIT.windowMs))) {
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
    const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    if (o.lang === "en") lang = "en";
    if (looksLikeBot({ website: typeof o.website === "string" ? o.website : undefined, t: typeof o.t === "number" ? o.t : undefined })) {
      return fail(lang, "invalid_request");
    }
    const v = validateSiteReview({ rating: Number(o.rating), body: String(o.body ?? ""), city: typeof o.city === "string" ? o.city : null });
    if (!v.ok) return fail(lang, "invalid_request", { fields: [v.field] });
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
    if (!userId) {
      return fail(lang, "login_required", {
        message:
          lang === "en"
            ? "Sign in to review the shop. Reviews are open to customers who have received an order."
            : "Connectez-vous pour donner votre avis sur la boutique. Les avis sont ouverts aux clients qui ont reçu une commande.",
      });
    }

    const { data: profile } = await admin.from("profiles").select("first_name,last_name,phone").eq("id", userId).maybeSingle();
    // Client vérifié : au moins une commande livrée, sur son compte ou sur son numéro (commande passée sans compte).
    const phone = normPhone(String(profile?.phone ?? ""));
    const delivered = admin.from("orders").select("id", { count: "exact", head: true }).eq("status", "livree");
    const { count, error: eligErr } = await (phone.length >= 8 ? delivered.or(`user_id.eq.${userId},phone.eq.${phone}`) : delivered.eq("user_id", userId));
    if (eligErr) return fail(lang, "server_error");
    if (!count) return fail(lang, "not_eligible");

    const author = publicAuthor(String(profile?.first_name ?? ""), String(profile?.last_name ?? "")) || (lang === "en" ? "Customer" : "Client");
    const { error } = await admin.from("site_reviews").insert({
      user_id: userId,
      author,
      city: v.value.city,
      rating: v.value.rating,
      body: v.value.body,
      source: "client",
      verified: true,
      status: "pending",
    });
    if (error?.code === "23505") {
      return fail(lang, "already_reviewed", {
        message: lang === "en" ? "You have already reviewed the shop. Thank you." : "Vous avez déjà donné votre avis sur la boutique. Merci.",
      });
    }
    if (error) return fail(lang, "server_error");
    return NextResponse.json({ ok: true, pending: true });
  } catch {
    return fail(lang, "server_error");
  }
}
