import "server-only";
import { getSettings } from "@/lib/catalog";
import { siteUrl } from "@/lib/payment/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimEmail, confirmEmail, emailKey, releaseEmail } from "./guard";
import { sendViaResend } from "./resend";
import { renderShopNewOrder, type ShopOrderData } from "./shop-template";

/**
 * Alerte interne « Nouvelle commande » (S1, docs/emails/inventaire.md) envoyée à la boutique : commande à la livraison
 * confirmée, ou commande en ligne payée. Destinataire : ORDER_NOTIFY_EMAIL, sinon l'e-mail de contact des Réglages.
 * Même contrat que sendOrderEmail : ne jette jamais, jamais deux fois pour la même commande.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function sendShopNewOrderEmail(orderId: string): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (typeof orderId !== "string" || !orderId) return { sent: false, reason: "invalid_input" };
    if (!process.env.RESEND_API_KEY?.trim()) return { sent: false, reason: "not_configured" };
    const key = emailKey(orderId, "shop_new");
    if (!claimEmail(key)) return { sent: false, reason: "duplicate" };
    try {
      const settings = await getSettings();
      const to = (process.env.ORDER_NOTIFY_EMAIL?.trim() || settings.brand.email || "").trim();
      if (!EMAIL_RE.test(to)) {
        releaseEmail(key);
        return { sent: false, reason: "no_recipient" };
      }
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("orders")
        .select("number,name,phone,address,note,zone,pay,paid,subtotal,shipping_fee,total,order_items(name,qty,unit_price)")
        .eq("id", orderId)
        .maybeSingle();
      if (error || !data) {
        releaseEmail(key);
        return { sent: false, reason: error ? "unavailable" : "order_not_found" };
      }
      const row = data as unknown as {
        number: string; name: string; phone: string; address: string; note: string | null; zone: string; pay: string; paid: boolean;
        subtotal: number; shipping_fee: number; total: number; order_items: { name: string; qty: number; unit_price: number }[] | null;
      };
      const order: ShopOrderData = {
        number: row.number,
        name: row.name,
        phone: row.phone,
        address: row.address,
        note: row.note ?? "",
        zone: row.zone,
        pay: row.pay,
        paid: row.paid,
        subtotal: row.subtotal,
        shippingFee: row.shipping_fee,
        total: row.total,
        items: (row.order_items ?? []).map((i) => ({ name: i.name, qty: i.qty, unitPrice: i.unit_price })),
        siteUrl: siteUrl(),
      };
      const mail = renderShopNewOrder(order);
      const result = await sendViaResend({ to, subject: mail.subject, html: mail.html, text: mail.text, idempotencyKey: `waxo-shop-${key}` });
      if (!result.ok) {
        releaseEmail(key);
        return { sent: false, reason: result.reason };
      }
      confirmEmail(key);
      return { sent: true };
    } catch {
      releaseEmail(key);
      return { sent: false, reason: "error" };
    }
  } catch {
    return { sent: false, reason: "error" };
  }
}
