import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderEmail } from "@/lib/email";
import { rateLimitShared } from "@/lib/ratelimit";
import { loadFedapayConfig } from "./credentials";
import { fetchTransaction } from "./fedapay";
import { reportMoneyError } from "./observe";
import { settleApprovedTransaction } from "./settle";
import { isApproved } from "./transaction";

/**
 * Libération du stock des commandes en ligne jamais payées (RPC expire_stale_orders), partagée par le cron quotidien
 * et par le balayage opportuniste déclenché après une commande (Vercel Hobby = 1 cron par jour : sans lui, une
 * commande Mobile Money abandonnée bloquerait le stock jusqu'à 24 h).
 *
 * Ordre (audit Tariq E4) : rattrapage FedaPay BORNÉ EN TEMPS (webhook perdu → on règle au lieu d'annuler), puis
 * expiration SQL quoi qu'il arrive, puis e-mails d'annulation en parallèle borné, sur les commandes réellement annulées.
 */

export const EXPIRE_AFTER_MINUTES = 60;
const PARALLEL = 5;

export type AdminClient = ReturnType<typeof createAdminClient>;
export type SweepResult = { expired: number; rescued: number; notified: number };

/** Exécute `fn` sur `items` par tranches de `size` en parallèle, et s'arrête dès que l'échéance est passée. */
export async function inBoundedBatches<T>(items: readonly T[], size: number, deadline: number, fn: (item: T) => Promise<void>, now: () => number = Date.now): Promise<number> {
  let done = 0;
  for (let i = 0; i < items.length; i += size) {
    if (now() > deadline) break;
    const slice = items.slice(i, i + size);
    await Promise.allSettled(slice.map(fn));
    done += slice.length;
  }
  return done;
}

/**
 * @param opts.maxCandidates commandes en ligne examinées au plus pour le rattrapage et les e-mails
 * @param opts.rescueDeadline échéance (horodatage) du rattrapage FedaPay : au-delà, on passe directement à l'expiration
 * @param opts.notifyDeadline échéance des e-mails d'annulation
 * @throws Error("expire_failed") si le RPC échoue (l'appelant répond 500 / journalise)
 */
export async function sweepStaleOrders(
  admin: AdminClient,
  opts: { maxCandidates: number; rescueDeadline: number; notifyDeadline: number },
): Promise<SweepResult> {
  const cutoff = new Date(Date.now() - EXPIRE_AFTER_MINUTES * 60_000).toISOString();
  const { data: stale } = await admin
    .from("orders")
    .select("id")
    .eq("status", "nouvelle")
    .eq("paid", false)
    .neq("pay", "cod")
    .lt("created_at", cutoff)
    .limit(opts.maxCandidates);
  const candidates = ((stale ?? []) as { id: string }[]).map((r) => r.id);

  // 1) Paiement déjà approuvé chez FedaPay mais webhook manqué : on règle au lieu d'annuler (borné en temps).
  let rescued = 0;
  const cfg = candidates.length > 0 ? await loadFedapayConfig() : null;
  if (cfg) {
    const { data: pendings } = await admin
      .from("payments")
      .select("order_id,provider_ref")
      .eq("provider", "fedapay")
      .eq("status", "pending")
      .in("order_id", candidates);
    const rows = ((pendings ?? []) as { order_id: string; provider_ref: string | null }[]).filter((p) => p.provider_ref);
    await inBoundedBatches(rows, PARALLEL, opts.rescueDeadline, async (p) => {
      try {
        const tx = await fetchTransaction(p.provider_ref as string, cfg);
        if (tx && isApproved(tx) && tx.orderId === p.order_id) {
          const r = await settleApprovedTransaction(tx, `cron:${tx.id}`, cfg.env);
          if (r === "paid") rescued += 1;
        }
      } catch {
        /* on ne casse pas la libération du stock pour une transaction illisible */
      }
    });
  }

  // 2) Expiration SQL : toujours exécutée, même si le rattrapage a manqué de temps.
  const { data: expired, error } = await admin.rpc("expire_stale_orders", { p_minutes: EXPIRE_AFTER_MINUTES });
  if (error) {
    reportMoneyError("expire", "expire_failed", { code: error.code ?? undefined });
    throw new Error("expire_failed");
  }

  // 3) E-mail « annulée » aux commandes réellement annulées, en parallèle borné.
  let notified = 0;
  if (candidates.length > 0) {
    const { data: cancelled } = await admin.from("orders").select("id").in("id", candidates).eq("status", "annulee");
    await inBoundedBatches((cancelled ?? []) as { id: string }[], PARALLEL, opts.notifyDeadline, async (row) => {
      const r = await sendOrderEmail(row.id, "annulee").catch(() => ({ sent: false }));
      if (r.sent) notified += 1;
    });
  }
  return { expired: typeof expired === "number" ? expired : 0, rescued, notified };
}

/** Intervalle minimal entre deux balayages opportunistes (toutes instances confondues, via le limiteur partagé). */
export const OPPORTUNISTIC_EVERY_MS = 10 * 60_000;
let lastLocal = 0;

/**
 * Balayage opportuniste, à lancer APRÈS la réponse (runAfterResponse) : au plus une fois par 10 min et par instance,
 * et une fois par 10 min au total (rate_hit partagé). Petit lot, 6 s de budget. Ne jette jamais.
 */
export async function maybeSweepStaleOrders(now: number = Date.now()): Promise<SweepResult | null> {
  if (now - lastLocal < OPPORTUNISTIC_EVERY_MS) return null;
  lastLocal = now;
  try {
    if (!(await rateLimitShared("expire-sweep", 1, OPPORTUNISTIC_EVERY_MS))) return null;
    const admin = createAdminClient();
    return await sweepStaleOrders(admin, { maxCandidates: 20, rescueDeadline: now + 4_000, notifyDeadline: now + 6_000 });
  } catch (e) {
    reportMoneyError("expire-opportunistic", e);
    return null;
  }
}

/** Tests : remet le verrou local à zéro. */
export function resetSweepThrottle(): void {
  lastLocal = 0;
}
