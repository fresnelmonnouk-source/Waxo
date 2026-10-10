import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/catalog";
import { siteUrl } from "@/lib/payment/config";
import { deliveryExpression } from "./delivery";
import type { OrderEmailData } from "./template";

/** Lit la commande (service_role) et fabrique les données du gabarit. Renvoie le destinataire à part. */

type OrderRow = {
  id: string;
  number: string;
  user_id: string | null;
  name: string;
  email: string | null;
  address: string;
  zone: string;
  created_at: string;
  pay: string;
  paid: boolean;
  subtotal: number;
  shipping_fee: number;
  total: number;
  locale?: string | null;
  order_items: { name: string; qty: number; unit_price: number }[] | null;
};

const COLUMNS = "id,number,user_id,name,email,address,zone,created_at,pay,paid,subtotal,shipping_fee,total,order_items(name,qty,unit_price)";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type LoadedOrderEmail = { to: string; data: OrderEmailData } | { to: null; reason: "order_not_found" | "no_recipient" | "unavailable" };

export async function loadOrderEmail(orderId: string): Promise<LoadedOrderEmail> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { to: null, reason: "unavailable" };
  }

  // `locale` (migration 0007) peut ne pas exister encore : on réessaie sans elle.
  let row: OrderRow | null = null;
  const withLocale = await admin.from("orders").select(`${COLUMNS},locale`).eq("id", orderId).maybeSingle();
  if (!withLocale.error) {
    row = withLocale.data as OrderRow | null;
  } else {
    const without = await admin.from("orders").select(COLUMNS).eq("id", orderId).maybeSingle();
    if (without.error) return { to: null, reason: "unavailable" };
    row = without.data as OrderRow | null;
  }
  if (!row) return { to: null, reason: "order_not_found" };

  let to = row.email && EMAIL_RE.test(row.email.trim()) ? row.email.trim() : "";
  if (!to && row.user_id) {
    try {
      const { data } = await admin.auth.admin.getUserById(row.user_id);
      const accountEmail = data.user?.email?.trim() ?? "";
      if (EMAIL_RE.test(accountEmail)) to = accountEmail;
    } catch {
      /* pas d'e-mail de compte lisible */
    }
  }
  if (!to) return { to: null, reason: "no_recipient" };

  const settings = await getSettings();
  const locale = row.locale === "en" ? "en" : "fr";
  return {
    to,
    data: {
      locale,
      number: row.number,
      name: row.name,
      items: (row.order_items ?? []).map((i) => ({ name: i.name, qty: i.qty, unitPrice: i.unit_price })),
      total: row.total,
      pay: row.pay,
      paid: row.paid,
      deliveryDate: deliveryExpression({ zone: row.zone, createdAt: row.created_at, cutoff: settings.shipping.cutoff, locale }),
      brand: settings.brand,
      siteUrl: siteUrl(),
    },
  };
}
