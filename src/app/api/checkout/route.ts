import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { getPaymentProvider } from "@/lib/payment";
import {
  API_STATUS,
  apiMessage,
  mapPlaceOrderError,
  type ApiErrorCode,
  type ApiLang,
} from "@/lib/checkout/errors";
import { normPhone } from "@/lib/checkout/phone";
import { clientIp, rateLimit } from "@/lib/checkout/rate-limit";
import { checkoutSchema, looksLikeBot } from "@/lib/checkout/schema";

/**
 * POST /api/checkout — crée la commande via la fonction SQL place_order (prix, stock et frais recalculés côté base :
 * le client n'envoie JAMAIS un montant). Carte / Mobile Money : transmis au fournisseur de paiement (mock en J1).
 * Paiement à la livraison : commande confirmée directement. Jamais de détail interne dans les réponses.
 */

const MAX_BODY_BYTES = 20_000;
const RATE_LIMIT = { max: 8, windowMs: 10 * 60_000 };

function fail(lang: ApiLang, code: ApiErrorCode, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, code, message: apiMessage(lang, code), ...extra }, { status: API_STATUS[code] });
}

type PlacedRow = { order_id: string; order_number: string; subtotal: number; shipping_fee: number; total: number };

function isPlacedRow(x: unknown): x is PlacedRow {
  const r = x as Partial<PlacedRow> | null;
  return (
    !!r &&
    typeof r.order_id === "string" &&
    typeof r.order_number === "string" &&
    typeof r.subtotal === "number" &&
    typeof r.shipping_fee === "number" &&
    typeof r.total === "number"
  );
}

export async function POST(request: Request) {
  let lang: ApiLang = "fr";
  try {
    if (!rateLimit(`checkout:${clientIp(request.headers)}`, RATE_LIMIT.max, RATE_LIMIT.windowMs)) {
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

    // Honeypot + délai minimal avant tout autre traitement.
    if (
      looksLikeBot({
        website: typeof rawObj.website === "string" ? rawObj.website : undefined,
        t: typeof rawObj.t === "number" ? rawObj.t : undefined,
      })
    ) {
      return fail(lang, "invalid_request");
    }

    const parsed = checkoutSchema.safeParse(raw);
    if (!parsed.success) {
      const heads = parsed.error.issues.map((i) => i.path.map(String));
      if (heads.some((p) => p[0] === "items")) return fail(lang, "cart_invalid");
      // Noms de champs seulement (jamais les valeurs) pour que le formulaire marque le bon champ.
      const fields = [...new Set(heads.map((p) => (p[0] === "customer" ? p[1] : p[0])).filter(Boolean))];
      return fail(lang, "invalid_request", { fields });
    }
    const input = parsed.data;
    lang = input.lang;

    let admin: ReturnType<typeof createAdminClient>;
    try {
      admin = createAdminClient();
    } catch {
      return fail(lang, "unavailable");
    }

    // Compte connecté éventuel : rattache la commande. Invité par défaut ; jamais bloquant.
    let userId: string | null = null;
    if (supabasePublicEnv()) {
      try {
        const sb = await createSessionClient();
        const { data } = await sb.auth.getUser();
        userId = data.user?.id ?? null;
      } catch {
        userId = null;
      }
    }

    const phone = normPhone(input.customer.phone);
    const { data, error } = await admin.rpc("place_order", {
      p_items: input.items,
      p_customer: {
        name: input.customer.name,
        phone,
        email: input.customer.email ?? "",
        address: input.customer.address,
        note: input.customer.note ?? "",
      },
      p_zone: input.zone,
      p_pay: input.pay,
      p_user: userId,
    });

    if (error) {
      const code = mapPlaceOrderError(error.message);
      if (code === "server_error") console.error("[checkout] place_order a échoué", error.code ?? "");
      return fail(lang, code);
    }
    const row: unknown = Array.isArray(data) ? data[0] : data;
    if (!isPlacedRow(row)) return fail(lang, "server_error");

    const order = { number: row.order_number, subtotal: row.subtotal, shippingFee: row.shipping_fee, total: row.total };

    if (input.pay === "cod") {
      return NextResponse.json({ ok: true, order, payment: { kind: "cod" } });
    }

    try {
      const result = await getPaymentProvider().createCheckout({
        orderId: row.order_id,
        number: row.order_number,
        total: row.total,
        method: input.pay,
        customer: { name: input.customer.name, phone, email: input.customer.email || null },
        payerPhone: input.payerPhone ? normPhone(input.payerPhone) : null,
        lang,
      });
      if ("redirectUrl" in result && /^https:\/\//i.test(result.redirectUrl)) {
        return NextResponse.json({ ok: true, order, payment: { kind: "redirect", url: result.redirectUrl } });
      }
      return NextResponse.json({ ok: true, order, payment: { kind: "pending" } });
    } catch {
      // La commande existe (stock réservé, libéré par expire_stale_orders si jamais payée) : on le dit au client.
      return fail(lang, "payment_unavailable", { order });
    }
  } catch {
    return fail(lang, "server_error");
  }
}
