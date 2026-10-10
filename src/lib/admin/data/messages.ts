import "server-only";
import demo from "@/lib/demo/admin.json";
import { tryAdminClient, withTimeout } from "@/lib/settings/db";

export type AdminMessage = {
  id: string;
  name: string;
  contact: string;
  subject: string;
  orderNumber: string | null;
  body: string;
  done: boolean;
  createdAt: string;
  /** Libellé du statut de la commande citée (« Reçue », « Livrée »…), si elle existe. */
  orderStatusLabel: string | null;
};
export type MessagesData = { rows: AdminMessage[]; connected: boolean; truncated: boolean };

export const MESSAGE_LIMIT = 200;
const STATUS_LABELS: Record<string, string> = Object.fromEntries(Object.entries(demo.status).map(([k, v]) => [k, v[0]]));

export async function getAdminMessages(): Promise<MessagesData> {
  const sb = tryAdminClient();
  if (sb) {
    try {
      // À traiter d'abord, puis du plus récent au plus ancien.
      const { data, error } = await withTimeout(
        sb
          .from("messages")
          .select("id,name,contact,subject,order_number,body,done,created_at")
          .order("done", { ascending: true })
          .order("created_at", { ascending: false })
          .limit(MESSAGE_LIMIT + 1),
      );
      if (!error && data) {
        const truncated = data.length > MESSAGE_LIMIT;
        const list = data.slice(0, MESSAGE_LIMIT);
        const numbers = [...new Set(list.map((m) => (m.order_number ? String(m.order_number).toUpperCase() : "")).filter(Boolean))];
        const statusByNumber = new Map<string, string>();
        if (numbers.length) {
          try {
            const { data: orders } = await withTimeout(sb.from("orders").select("number,status").in("number", numbers));
            (orders ?? []).forEach((o) => statusByNumber.set(String(o.number), STATUS_LABELS[String(o.status)] ?? ""));
          } catch {
            /* statut indisponible : le brouillon l'omet */
          }
        }
        return {
          rows: list.map((m) => {
            const num = m.order_number ? String(m.order_number) : null;
            return {
              id: String(m.id),
              name: String(m.name),
              contact: String(m.contact),
              subject: String(m.subject ?? ""),
              orderNumber: num,
              body: String(m.body),
              done: Boolean(m.done),
              createdAt: String(m.created_at),
              orderStatusLabel: num ? statusByNumber.get(num.toUpperCase()) || null : null,
            };
          }),
          connected: true,
          truncated,
        };
      }
    } catch {
      /* repli démo */
    }
  }
  const orders = new Map(demo.orders.map((o) => [o.id.toUpperCase(), STATUS_LABELS[o.status] ?? ""]));
  const rows = demo.messages
    .map((m) => ({
      id: m.id,
      name: m.name,
      contact: m.contact,
      subject: m.subject,
      orderNumber: m.orderId || null,
      body: m.text,
      done: m.done,
      createdAt: m.date,
      orderStatusLabel: m.orderId ? orders.get(m.orderId.toUpperCase()) || null : null,
    }))
    .sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt.localeCompare(a.createdAt));
  return { rows, connected: false, truncated: false };
}
