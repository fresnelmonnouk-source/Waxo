import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fedapayConfig, siteUrl, type FedapayConfig } from "./config";
import { orderStatusToken } from "./token";
import { parseTransaction, type FedapayTransaction } from "./transaction";
import type { CheckoutResult, PayableOrder, PaymentProvider } from "./types";

/**
 * Provider FedaPay (API REST v1) : crée une transaction pour le montant OFFICIEL de la commande (jamais celui du client),
 * obtient un jeton de paiement et renvoie l'URL de la page de paiement hébergée (Mobile Money MTN/Moov/Celtiis + carte).
 * La confirmation arrive par webhook (`/api/webhooks/fedapay`) et/ou par la vérification au retour (`/api/checkout/status`).
 */

const TIMEOUT_MS = 8000;

export class FedapayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "FedapayError";
  }
}

async function call(cfg: FedapayConfig, path: string, init: { method: "GET" | "POST"; body?: unknown }): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${cfg.apiBase}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${cfg.secretKey}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new FedapayError(`fedapay_http_${res.status}`, res.status);
    return (await res.json()) as unknown;
  } catch (e) {
    if (e instanceof FedapayError) throw e;
    throw new FedapayError("fedapay_network", 0);
  } finally {
    clearTimeout(timer);
  }
}

/** Relit une transaction directement chez FedaPay (source de vérité, jamais le corps d'un webhook). */
export async function fetchTransaction(
  id: string,
  cfg: FedapayConfig | null = fedapayConfig(),
): Promise<FedapayTransaction | null> {
  if (!cfg || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  try {
    return parseTransaction(await call(cfg, `/transactions/${encodeURIComponent(id)}`, { method: "GET" }));
  } catch (e) {
    // Transaction inconnue : rien à régler (et rien à réessayer). Les autres erreurs remontent (panne transitoire).
    if (e instanceof FedapayError && e.status === 404) return null;
    throw e;
  }
}

function splitName(full: string): { firstname: string; lastname: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "Client";
  return { firstname: first.slice(0, 60), lastname: (parts.slice(1).join(" ") || first).slice(0, 60) };
}

function buildTransactionBody(order: PayableOrder, callbackUrl: string, withContact: boolean) {
  const { firstname, lastname } = splitName(order.customer.name);
  const phone = (order.payerPhone ?? order.customer.phone).replace(/\D/g, "");
  const customer: Record<string, unknown> = { firstname, lastname };
  if (withContact) {
    if (order.customer.email) customer.email = order.customer.email;
    if (/^01\d{8}$/.test(phone)) customer.phone_number = { number: `+229${phone}`, country: "bj" };
  }
  return {
    description: `Commande ${order.number}`,
    amount: order.total,
    currency: { iso: "XOF" },
    callback_url: callbackUrl,
    merchant_reference: order.number,
    custom_metadata: { order_id: order.orderId, order_number: order.number },
    customer,
  };
}

/** Trace « pending » pour l'audit et la réconciliation du cron. Jamais bloquant. */
async function recordPending(order: PayableOrder, transactionId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("payments").insert({
      order_id: order.orderId,
      provider: "fedapay",
      provider_ref: transactionId,
      status: "pending",
      amount: order.total,
      raw: { id: transactionId, method: order.method },
    });
  } catch {
    /* l'absence de trace n'empêche pas le paiement */
  }
}

export class FedaPayProvider implements PaymentProvider {
  readonly name = "fedapay";
  constructor(private readonly cfg: FedapayConfig) {}

  async createCheckout(order: PayableOrder): Promise<CheckoutResult> {
    const origin = siteUrl();
    if (!origin) throw new FedapayError("site_url_missing", 0);
    const token = orderStatusToken(order.number);
    const callbackUrl =
      `${origin}/${order.lang}/commande/merci?n=${encodeURIComponent(order.number)}` + (token ? `&k=${token}` : "");

    let created: unknown;
    try {
      created = await call(this.cfg, "/transactions", { method: "POST", body: buildTransactionBody(order, callbackUrl, true) });
    } catch (e) {
      // Coordonnées refusées (format de téléphone/e-mail) : on réessaie une fois sans elles plutôt que de perdre le paiement.
      if (e instanceof FedapayError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 403) {
        created = await call(this.cfg, "/transactions", { method: "POST", body: buildTransactionBody(order, callbackUrl, false) });
      } else {
        throw e;
      }
    }
    const tx = parseTransaction(created);
    if (!tx) throw new FedapayError("fedapay_bad_transaction", 0);

    const tokenRes = (await call(this.cfg, `/transactions/${encodeURIComponent(tx.id)}/token`, { method: "POST" })) as {
      url?: unknown;
    } | null;
    const url = typeof tokenRes?.url === "string" ? tokenRes.url : "";
    if (!/^https:\/\//i.test(url)) throw new FedapayError("fedapay_bad_token", 0);

    await recordPending(order, tx.id);
    return { redirectUrl: url };
  }
}
