import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderEmail } from "@/lib/email";
import { fedapayConfig } from "@/lib/payment/config";
import { cronAuthorized } from "@/lib/payment/cron-auth";
import { fetchTransaction } from "@/lib/payment/fedapay";
import { settleApprovedTransaction } from "@/lib/payment/settle";
import { isApproved } from "@/lib/payment/transaction";

/**
 * GET /api/cron/expire-orders — libère le stock des commandes en ligne jamais payées (RPC expire_stale_orders).
 * Protégé par `Authorization: Bearer $CRON_SECRET` (Vercel Cron l'ajoute tout seul) ; sans CRON_SECRET → 503.
 * Avant d'expirer, les commandes candidates dont la transaction FedaPay est déjà approuvée sont RÉGLÉES
 * (webhook perdu) au lieu d'être annulées ; les commandes vraiment expirées reçoivent l'e-mail « annulee ».
 * Hobby Vercel : 1 exécution par jour maximum (voir vercel.json).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const EXPIRE_AFTER_MINUTES = 60;
const MAX_CANDIDATES = 100;

const reply = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return reply({ ok: false, code: "not_configured" }, 503);
  if (!cronAuthorized(request.headers.get("authorization"), secret)) return reply({ ok: false, code: "unauthorized" }, 401);

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return reply({ ok: false, code: "unavailable" }, 503);
  }

  try {
    const cutoff = new Date(Date.now() - EXPIRE_AFTER_MINUTES * 60_000).toISOString();
    const { data: stale } = await admin
      .from("orders")
      .select("id")
      .eq("status", "nouvelle")
      .eq("paid", false)
      .neq("pay", "cod")
      .lt("created_at", cutoff)
      .limit(MAX_CANDIDATES);
    const candidates = ((stale ?? []) as { id: string }[]).map((r) => r.id);

    // 1) Paiement déjà approuvé chez FedaPay mais webhook manqué : on règle au lieu d'annuler.
    let rescued = 0;
    const cfg = fedapayConfig();
    if (cfg && candidates.length > 0) {
      const { data: pendings } = await admin
        .from("payments")
        .select("order_id,provider_ref")
        .eq("provider", "fedapay")
        .eq("status", "pending")
        .in("order_id", candidates);
      for (const p of (pendings ?? []) as { order_id: string; provider_ref: string | null }[]) {
        if (!p.provider_ref) continue;
        try {
          const tx = await fetchTransaction(p.provider_ref, cfg);
          if (tx && isApproved(tx) && tx.orderId === p.order_id) {
            const r = await settleApprovedTransaction(tx, `cron:${tx.id}`);
            if (r === "paid") rescued += 1;
          }
        } catch {
          /* on ne casse pas la libération du stock pour une transaction illisible */
        }
      }
    }

    // 2) Expiration (SQL) puis e-mail d'annulation aux commandes réellement annulées.
    const { data: expired, error } = await admin.rpc("expire_stale_orders", { p_minutes: EXPIRE_AFTER_MINUTES });
    if (error) return reply({ ok: false, code: "failed" }, 500);

    let notified = 0;
    if (candidates.length > 0) {
      const { data: cancelled } = await admin.from("orders").select("id").in("id", candidates).eq("status", "annulee");
      for (const row of (cancelled ?? []) as { id: string }[]) {
        const r = await sendOrderEmail(row.id, "annulee").catch(() => ({ sent: false }));
        if (r.sent) notified += 1;
      }
    }

    return reply({ ok: true, expired: typeof expired === "number" ? expired : 0, rescued, notified });
  } catch {
    return reply({ ok: false, code: "failed" }, 500);
  }
}
