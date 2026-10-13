import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshFxRates } from "@/lib/currency/refresh";
import { cronAuthorized } from "@/lib/payment/cron-auth";
import { sweepStaleOrders } from "@/lib/payment/expire";
import { reportMoneyError } from "@/lib/payment/observe";
import { sendReviewRequests } from "@/lib/email/review-request";

/**
 * GET /api/cron/expire-orders — libère le stock des commandes en ligne jamais payées (RPC expire_stale_orders).
 * Protégé par `Authorization: Bearer $CRON_SECRET` (Vercel Cron l'ajoute tout seul) ; sans CRON_SECRET → 503.
 * Avant d'expirer, les commandes candidates dont la transaction FedaPay est déjà approuvée sont RÉGLÉES
 * (webhook perdu) au lieu d'être annulées ; les commandes vraiment expirées reçoivent l'e-mail « annulee ».
 *
 * Ordre et budget de temps (audit Tariq E4) : la partie ARGENT passe d'abord (rattrapage FedaPay arrêté à 12 s, puis
 * expiration SQL quoi qu'il arrive, puis e-mails d'annulation jusqu'à 18 s) ; ensuite seulement purge du limiteur,
 * taux de change et demandes d'avis avec le temps qui reste. Hobby Vercel : 1 exécution par jour (voir vercel.json) ;
 * le balayage opportuniste après chaque commande (lib/payment/expire.ts) libère le stock entre deux passages.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_CANDIDATES = 100;
/** Le rattrapage FedaPay s'arrête 12 s après le début : l'expiration SQL a toujours le temps de passer. */
const RESCUE_DEADLINE_MS = 12_000;
const NOTIFY_DEADLINE_MS = 18_000;
/** Les demandes d'avis s'arrêtent à 22 s après le début : marge avant la limite de 30 s de la fonction. */
const REVIEW_DEADLINE_MS = 22_000;

const reply = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  const startedAt = Date.now();
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return reply({ ok: false, code: "not_configured" }, 503);
  if (!cronAuthorized(request.headers.get("authorization"), secret)) return reply({ ok: false, code: "unauthorized" }, 401);

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return reply({ ok: false, code: "unavailable" }, 503);
  }

  // 1) ARGENT D'ABORD : rattrapage borné, expiration, e-mails d'annulation.
  let sweep: Awaited<ReturnType<typeof sweepStaleOrders>> | null = null;
  try {
    sweep = await sweepStaleOrders(admin, {
      maxCandidates: MAX_CANDIDATES,
      rescueDeadline: startedAt + RESCUE_DEADLINE_MS,
      notifyDeadline: startedAt + NOTIFY_DEADLINE_MS,
    });
  } catch (e) {
    reportMoneyError("cron", e);
  }

  // 2) Hygiène : purge des compteurs du limiteur partagé (table UNLOGGED rate_limits, migration 0009 ; absente = sans effet).
  try {
    await admin.from("rate_limits").delete().lt("window_start", new Date(Date.now() - 24 * 3600_000).toISOString());
  } catch {
    /* best effort */
  }

  // 3) Taux d'affichage : tâche indépendante, ne bloque jamais l'expiration des commandes.
  let fx: "updated" | "no_source" | "failed" = "failed";
  try {
    const r = await refreshFxRates();
    fx = r.ok ? "updated" : r.code === "no_source" ? "no_source" : "failed";
  } catch {
    fx = "failed";
  }

  if (!sweep) return reply({ ok: false, code: "failed", fx }, 500);

  // 4) EN DERNIER (audit Raphaël) : demandes d'avis, jamais avant la partie argent, avec le temps qui reste.
  let reviews: { sent: number; skipped: number; failed: number } | null = null;
  try {
    reviews = await sendReviewRequests(admin, { deadline: startedAt + REVIEW_DEADLINE_MS });
  } catch (e) {
    console.error("[cron] demandes d'avis", e instanceof Error ? e.message.slice(0, 120) : "");
    reviews = null;
  }

  return reply({ ok: true, expired: sweep.expired, rescued: sweep.rescued, notified: sweep.notified, fx, reviews });
}
