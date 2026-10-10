import { NextResponse } from "next/server";
import { fetchTransaction } from "@/lib/payment/fedapay";
import { fedapayConfig } from "@/lib/payment/config";
import { settleApprovedTransaction } from "@/lib/payment/settle";
import { verifyFedapaySignature } from "@/lib/payment/signature";
import { isApproved, parseTransaction } from "@/lib/payment/transaction";

/**
 * POST /api/webhooks/fedapay — notification de paiement.
 *  - corps BRUT lu une seule fois, signature HMAC vérifiée (FEDAPAY_WEBHOOK_SECRET) AVANT tout traitement ;
 *  - signature invalide → 401 ; secret absent → 503 (le prestataire réessaiera) ;
 *  - donnée illisible/événement inconnu → 200 (rien à réessayer), jamais 500 ;
 *  - le corps n'est pas cru : si FEDAPAY_SECRET_KEY existe, la transaction est relue chez FedaPay avant mark_paid ;
 *  - idempotence : id d'événement `<nom>:<id transaction>` passé à mark_paid (table webhook_events) ;
 *  - panne transitoire (API/base) → 503 pour déclencher un nouvel essai.
 */

export const dynamic = "force-dynamic";

const MAX_BODY = 100_000;
const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const secret = process.env.FEDAPAY_WEBHOOK_SECRET?.trim();
  if (!secret) return json({ ok: false, code: "not_configured" }, 503);

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return json({ ok: false, code: "bad_request" }, 400);
  }
  if (raw.length > MAX_BODY) return json({ ok: false, code: "too_large" }, 413);

  const check = verifyFedapaySignature(raw, request.headers.get("x-fedapay-signature"), secret);
  if (!check.ok) return json({ ok: false, code: "invalid_signature" }, 401);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: true, ignored: "invalid_json" });
  }
  const evt = (body && typeof body === "object" ? body : {}) as { name?: unknown; entity?: unknown; object?: unknown };
  const name = typeof evt.name === "string" ? evt.name.slice(0, 64) : "";
  if (name !== "transaction.approved") return json({ ok: true, ignored: "event" });

  const claimed = parseTransaction(evt.entity);
  if (!claimed) return json({ ok: true, ignored: "invalid_entity" });

  try {
    let tx = claimed;
    const cfg = fedapayConfig();
    if (cfg) {
      const verified = await fetchTransaction(claimed.id, cfg);
      if (!verified) return json({ ok: true, ignored: "unverifiable" });
      tx = verified;
    }
    if (!isApproved(tx)) return json({ ok: true, ignored: "not_approved" });

    const result = await settleApprovedTransaction(tx, `${name}:${tx.id}`);
    return json({ ok: true, result });
  } catch {
    // Prestataire ou base momentanément injoignable : 503 → nouvel essai de FedaPay (mark_paid est idempotent).
    return json({ ok: false, code: "temporarily_unavailable" }, 503);
  }
}
