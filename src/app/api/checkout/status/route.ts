import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/checkout/rate-limit";
import { rateLimitShared } from "@/lib/ratelimit";
import { fetchTransaction } from "@/lib/payment/fedapay";
import { loadFedapayConfig, loadStatusTokenSource } from "@/lib/payment/credentials";
import { settleApprovedTransaction } from "@/lib/payment/settle";
import { paymentStateFor, transactionMatchesOrder, type PaymentState } from "@/lib/payment/state";
import { verifyOrderStatusToken } from "@/lib/payment/token";
import { isApproved } from "@/lib/payment/transaction";

/**
 * GET /api/checkout/status?n=WX-…&k=<jeton>&id=<transaction FedaPay> — état du paiement pour la page de retour.
 *  - jeton HMAC obligatoire (le numéro de commande étant séquentiel, il ne suffit pas) ;
 *  - si `id` est fourni et que la commande n'est pas encore payée, la transaction est RELUE chez FedaPay, vérifiée
 *    (même commande, même montant) puis réglée via mark_paid : le client est confirmé même si le webhook est en retard ;
 *  - ne renvoie que l'état, le numéro, le total et le moyen de paiement ; jamais d'erreur interne.
 */

export const dynamic = "force-dynamic";

const NUMBER = /^WX-\d{1,12}$/;
const TOKEN = /^[0-9a-f]{16,64}$/;
const TX_ID = /^[A-Za-z0-9_-]{1,64}$/;

const reply = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

type OrderRow = { id: string; number: string; total: number; pay: string; paid: boolean; status: string };

export async function GET(request: Request) {
  if (!(await rateLimitShared(`pay-status:${clientIp(request.headers)}`, 40, 60_000))) return reply({ ok: false, code: "rate_limited" }, 429);

  const params = new URL(request.url).searchParams;
  const number = params.get("n") ?? "";
  const token = params.get("k") ?? "";
  const txId = params.get("id") ?? "";
  if (!NUMBER.test(number) || !TOKEN.test(token) || (txId && !TX_ID.test(txId))) {
    return reply({ ok: true, state: "unknown" satisfies PaymentState });
  }
  if (!verifyOrderStatusToken(number, token, await loadStatusTokenSource())) return reply({ ok: true, state: "unknown" satisfies PaymentState });

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("orders")
      .select("id,number,total,pay,paid,status")
      .eq("number", number)
      .maybeSingle();
    if (error) return reply({ ok: false, code: "unavailable" }, 503);
    let order = data as OrderRow | null;
    if (!order) return reply({ ok: true, state: "unknown" satisfies PaymentState });

    let tx = null;
    const cfg = !order.paid && txId ? await loadFedapayConfig() : null;
    if (cfg) {
      try {
        const fetched = await fetchTransaction(txId, cfg);
        if (fetched && transactionMatchesOrder(fetched, order)) {
          tx = fetched;
          if (isApproved(fetched)) {
            await settleApprovedTransaction(fetched, `return:${fetched.id}`);
            const again = await admin.from("orders").select("id,number,total,pay,paid,status").eq("id", order.id).maybeSingle();
            if (again.data) order = again.data as OrderRow;
          }
        }
      } catch {
        /* FedaPay ou base momentanément injoignable : on répond « en attente », le client réessaiera */
      }
    }

    return reply({
      ok: true,
      state: paymentStateFor(order, tx),
      number: order.number,
      total: order.total,
      pay: order.pay,
    });
  } catch {
    return reply({ ok: false, code: "unavailable" }, 503);
  }
}
