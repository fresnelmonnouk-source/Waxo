import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { getPaymentProvider } from "@/lib/payment";
import { sendOrderEmail } from "@/lib/email";
import { sendShopNewOrderEmail } from "@/lib/email/shop";
import { withTimeout } from "@/lib/auth/timeout";
import { getPacksEnabled } from "@/lib/catalog/packs";
import {
  API_STATUS,
  apiMessage,
  mapPlaceOrderError,
  type ApiErrorCode,
  type ApiLang,
} from "@/lib/checkout/errors";
import { normPhone } from "@/lib/checkout/phone";
import { clientIp } from "@/lib/checkout/rate-limit";
import { rateLimitShared } from "@/lib/ratelimit";
import { checkoutSchema } from "@/lib/checkout/schema";
import { GUARD_MESSAGES, parseIdemKey, submitTiming, withinQuantityCaps } from "./guard";

/**
 * POST /api/checkout — crée la commande via la fonction SQL place_order (prix, stock et frais recalculés côté base :
 * le client n'envoie JAMAIS un montant). Carte / Mobile Money : transmis au fournisseur de paiement (FedaPay, ou mock hors production).
 * Paiement à la livraison : commande confirmée directement. Jamais de détail interne dans les réponses.
 *
 * Idempotence : le navigateur envoie `idem` (UUID stable par tentative de commande). Un second envoi avec la même clé
 * (coupure réseau, double onglet) renvoie la commande existante au lieu d'en créer une autre (colonne orders.idem_key,
 * migration 0007 ; sans elle, la clé est simplement ignorée).
 */

const MAX_BODY_BYTES = 20_000;
const RATE_LIMIT = { max: 8, windowMs: 10 * 60_000 };

type GuardCode = "too_fast" | "quantity_limit";

function fail(lang: ApiLang, code: ApiErrorCode, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, code, message: apiMessage(lang, code), ...extra }, { status: API_STATUS[code] });
}

function failGuard(lang: ApiLang, code: GuardCode) {
  return NextResponse.json(
    { ok: false, code, message: GUARD_MESSAGES[lang][code] },
    { status: code === "too_fast" ? 400 : 422 },
  );
}

type Placed = { orderId: string; number: string; subtotal: number; shippingFee: number; total: number };
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

type AdminClient = ReturnType<typeof createAdminClient>;
type ExistingRow = { id: string; number: string; subtotal: number; shipping_fee: number; total: number; pay: string; paid: boolean };

/** Commande déjà créée avec cette clé ? Toute erreur (colonne absente…) = pas d'idempotence, jamais bloquant. */
async function findByIdem(admin: AdminClient, key: string): Promise<(Placed & { pay: string; paid: boolean }) | null> {
  try {
    const { data, error } = await admin
      .from("orders")
      .select("id,number,subtotal,shipping_fee,total,pay,paid")
      .eq("idem_key", key)
      .maybeSingle();
    if (error || !data) return null;
    const r = data as ExistingRow;
    return { orderId: r.id, number: r.number, subtotal: r.subtotal, shippingFee: r.shipping_fee, total: r.total, pay: r.pay, paid: r.paid };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let lang: ApiLang = "fr";
  try {
    if (!(await rateLimitShared(`checkout:${clientIp(request.headers)}`, RATE_LIMIT.max, RATE_LIMIT.windowMs))) {
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

    // Honeypot + délai minimal avant tout autre traitement (tolérant à l'horloge du téléphone).
    const verdict = submitTiming({ website: rawObj.website, t: rawObj.t, elapsed: rawObj.elapsed });
    if (verdict === "bot") return fail(lang, "invalid_request");
    if (verdict === "too_fast") return failGuard(lang, "too_fast");

    // Base absente (mode démo / pas encore branchée) : 503 net AVANT de juger le panier — sinon les ids de démo reçoivent un trompeur 422 (QA-2).
    let admin: AdminClient;
    try {
      admin = createAdminClient();
    } catch {
      return fail(lang, "unavailable");
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
    if (!withinQuantityCaps(input.items)) return failGuard(lang, "quantity_limit");
    // Packs désactivés depuis l'admin : un panier qui en contient encore est refusé (jamais une commande sur une offre retirée).
    if (input.items.some((i) => i.kind === "pack") && !(await getPacksEnabled().catch(() => true))) return fail(lang, "cart_invalid");

    // Compte connecté éventuel : rattache la commande. Invité par défaut ; jamais bloquant.
    let userId: string | null = null;
    if (supabasePublicEnv()) {
      try {
        const sb = await createSessionClient();
        const { data } = await withTimeout(sb.auth.getUser(), 2000); // jamais bloquant : sans réponse → commande en invité
        userId = data.user?.id ?? null;
      } catch {
        userId = null;
      }
    }

    const idemKey = parseIdemKey(rawObj.idem);
    let placed: Placed | null = null;
    let pay = input.pay;
    let alreadyPaid = false;

    if (idemKey) {
      const existing = await findByIdem(admin, idemKey);
      if (existing) {
        placed = existing;
        pay = existing.pay as typeof input.pay;
        alreadyPaid = existing.paid;
      }
    }

    if (!placed) {
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
      placed = { orderId: row.order_id, number: row.order_number, subtotal: row.subtotal, shippingFee: row.shipping_fee, total: row.total };

      // Langue de la commande (e-mails) et clé d'idempotence : colonnes de 0007_payments.sql ; absentes = sans effet.
      try {
        const patch: Record<string, string> = {};
        if (lang === "en") patch.locale = "en";
        if (idemKey) patch.idem_key = idemKey;
        if (Object.keys(patch).length > 0) {
          const { error: upErr } = await admin.from("orders").update(patch).eq("id", placed.orderId);
          if (upErr?.code === "23505" && idemKey) {
            // Deux requêtes simultanées avec la même clé : la première gagne, on annule le doublon (stock restitué).
            await admin.rpc("cancel_order", { p_order: placed.orderId });
            const winner = await findByIdem(admin, idemKey);
            if (winner) {
              placed = winner;
              pay = winner.pay as typeof input.pay;
              alreadyPaid = winner.paid;
            }
          }
        }
      } catch {
        /* non bloquant */
      }
    }

    const order = { number: placed.number, subtotal: placed.subtotal, shippingFee: placed.shippingFee, total: placed.total };

    if (pay === "cod") {
      // Paiement à la livraison : commande confirmée directement. L'e-mail ne bloque jamais la réponse
      // (et n'est pas renvoyé en cas de rejeu : garde anti-doublon de sendOrderEmail).
      // + alerte « nouvelle commande » à la boutique, en parallèle.
      await withTimeout(Promise.allSettled([sendOrderEmail(placed.orderId, "confirmation"), sendShopNewOrderEmail(placed.orderId)]), 3000).catch(() => undefined);
      return NextResponse.json({ ok: true, order, payment: { kind: "cod" } });
    }
    if (alreadyPaid) return NextResponse.json({ ok: true, order, payment: { kind: "paid" } });

    try {
      const result = await (await getPaymentProvider()).createCheckout({
        orderId: placed.orderId,
        number: placed.number,
        total: placed.total,
        method: pay,
        customer: { name: input.customer.name, phone: normPhone(input.customer.phone), email: input.customer.email || null },
        payerPhone: input.payerPhone ? normPhone(input.payerPhone) : null,
        lang,
      });
      if ("redirectUrl" in result && /^https:\/\//i.test(result.redirectUrl)) {
        return NextResponse.json({ ok: true, order, payment: { kind: "redirect", url: result.redirectUrl } });
      }
      return NextResponse.json({ ok: true, order, payment: { kind: "pending" } });
    } catch (e) {
      console.error("[checkout] paiement non lancé", e instanceof Error ? e.message : "inconnu");
      // La commande existe (stock réservé, libéré par expire_stale_orders si jamais payée) : on le dit au client.
      return fail(lang, "payment_unavailable", { order });
    }
  } catch {
    return fail(lang, "server_error");
  }
}
