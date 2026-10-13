import "server-only";
import demo from "@/lib/demo/admin.json";
import { tryAdminClient, withTimeout } from "@/lib/settings/db";
import { isCategory, isSource, isStatus, type Author, type Category, type Lang, type Source, type Status } from "./types";

/** Lectures de l'admin (« Discussions ») : service_role si la base est configurée, sinon données de démonstration. */

export type InboxRow = {
  id: string;
  category: Category;
  status: Status;
  subject: string;
  orderNumber: string | null;
  name: string;
  contact: string;
  source: Source;
  lastMessageAt: string;
  unread: boolean;
};

export type InboxFilters = { status: Status | "all" | "todo"; category: Category | "all" };
export type InboxCounts = { all: number; todo: number } & Record<Status, number>;
export type InboxData = { rows: InboxRow[]; counts: InboxCounts; connected: boolean; truncated: boolean };

export type AdminMessage = { id: string; author: Author; body: string; createdAt: string };
export type AdminThread = InboxRow & {
  createdAt: string;
  locale: Lang;
  userId: string | null;
  messages: AdminMessage[];
  /** Commande citée, si elle existe en base : lien vers sa fiche admin et libellé de statut. */
  order: { number: string; statusLabel: string } | null;
};

export const INBOX_LIMIT = 200;
const ORDER_STATUS: Record<string, string> = Object.fromEntries(Object.entries(demo.status).map(([k, v]) => [k, v[0]]));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseInboxFilters(sp: Record<string, string | string[] | undefined>): InboxFilters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const s = one(sp.statut);
  const c = one(sp.categorie);
  return { status: s === "todo" || isStatus(s) ? s : "all", category: isCategory(c) ? c : "all" };
}

export function parseSelectedId(sp: Record<string, string | string[] | undefined>): string | null {
  const v = Array.isArray(sp.c) ? sp.c[0] : sp.c;
  return v && (UUID.test(v) || /^m\d{1,4}$/.test(v)) ? v : null;
}

const toRow = (d: Record<string, unknown>): InboxRow => ({
  id: String(d.id),
  category: isCategory(d.category) ? d.category : "autre",
  status: isStatus(d.status) ? d.status : "nouveau",
  subject: String(d.subject ?? ""),
  orderNumber: typeof d.order_number === "string" && d.order_number ? d.order_number : null,
  name: String(d.customer_name ?? ""),
  contact: String(d.customer_contact ?? ""),
  source: isSource(d.source) ? d.source : "contact",
  lastMessageAt: String(d.last_message_at),
  unread: d.unread_admin === true,
});

const INBOX_COLS = "id,category,status,subject,order_number,customer_name,customer_contact,source,last_message_at,unread_admin";

function demoRows(): InboxRow[] {
  return demo.messages.map((m) => ({
    id: m.id,
    category: m.subject === "Livraison" || m.subject === "Commande" ? "commande" : m.subject === "Produit" ? "question" : "autre",
    status: m.done ? "resolu" : "nouveau",
    subject: m.text.slice(0, 80),
    orderNumber: m.orderId || null,
    name: m.name,
    contact: m.contact,
    source: "contact",
    lastMessageAt: m.date,
    unread: !m.done,
  }));
}

function applyFilters(rows: InboxRow[], f: InboxFilters): InboxRow[] {
  return rows.filter(
    (r) =>
      (f.category === "all" || r.category === f.category) &&
      (f.status === "all" || (f.status === "todo" ? r.status === "nouveau" || r.unread : r.status === f.status)),
  );
}

function countsOf(rows: InboxRow[]): InboxCounts {
  return {
    all: rows.length,
    todo: rows.filter((r) => r.status === "nouveau" || r.unread).length,
    nouveau: rows.filter((r) => r.status === "nouveau").length,
    en_cours: rows.filter((r) => r.status === "en_cours").length,
    resolu: rows.filter((r) => r.status === "resolu").length,
  };
}

export async function getInbox(f: InboxFilters): Promise<InboxData> {
  const sb = tryAdminClient();
  if (sb) {
    try {
      let q = sb.from("conversations").select(INBOX_COLS);
      if (f.category !== "all") q = q.eq("category", f.category);
      if (f.status === "todo") q = q.or("status.eq.nouveau,unread_admin.eq.true");
      else if (f.status !== "all") q = q.eq("status", f.status);
      const head = { count: "exact" as const, head: true };
      const count = async (p: PromiseLike<{ count: number | null; error: unknown }>) => {
        const r = await withTimeout(p);
        return r.error ? 0 : (r.count ?? 0);
      };
      const [list, all, todo, nouveau, en_cours, resolu] = await Promise.all([
        withTimeout(q.order("last_message_at", { ascending: false }).limit(INBOX_LIMIT + 1)),
        count(sb.from("conversations").select("id", head)),
        count(sb.from("conversations").select("id", head).or("status.eq.nouveau,unread_admin.eq.true")),
        count(sb.from("conversations").select("id", head).eq("status", "nouveau")),
        count(sb.from("conversations").select("id", head).eq("status", "en_cours")),
        count(sb.from("conversations").select("id", head).eq("status", "resolu")),
      ]);
      if (!list.error && list.data) {
        const data = list.data as Record<string, unknown>[];
        return {
          rows: data.slice(0, INBOX_LIMIT).map(toRow),
          counts: { all, todo, nouveau, en_cours, resolu },
          connected: true,
          truncated: data.length > INBOX_LIMIT,
        };
      }
    } catch {
      /* repli démo */
    }
  }
  const rows = demoRows();
  return { rows: applyFilters(rows, f), counts: countsOf(rows), connected: false, truncated: false };
}

export async function getAdminThread(id: string): Promise<AdminThread | null> {
  const sb = tryAdminClient();
  if (sb) {
    if (!UUID.test(id)) return null;
    try {
      const [conv, msgs] = await Promise.all([
        withTimeout(sb.from("conversations").select(`${INBOX_COLS},created_at,locale,user_id`).eq("id", id).maybeSingle()),
        withTimeout(sb.from("conversation_messages").select("id,author,body,created_at").eq("conversation_id", id).order("created_at", { ascending: true }).limit(500)),
      ]);
      if (conv.error || msgs.error || !conv.data) return null;
      const d = conv.data as Record<string, unknown>;
      const row = toRow(d);
      let order: AdminThread["order"] = null;
      if (row.orderNumber) {
        try {
          const { data: o } = await withTimeout(sb.from("orders").select("number,status").eq("number", row.orderNumber.toUpperCase()).maybeSingle());
          if (o) order = { number: String(o.number), statusLabel: ORDER_STATUS[String(o.status)] ?? "" };
        } catch {
          /* commande non vérifiable : pas de lien */
        }
      }
      return {
        ...row,
        createdAt: String(d.created_at),
        locale: d.locale === "en" ? "en" : "fr",
        userId: typeof d.user_id === "string" ? d.user_id : null,
        messages: ((msgs.data ?? []) as Record<string, unknown>[]).map((m) => ({
          id: String(m.id),
          author: m.author === "equipe" || m.author === "note_interne" ? m.author : "client",
          body: String(m.body ?? ""),
          createdAt: String(m.created_at),
        })),
        order,
      };
    } catch {
      return null;
    }
  }
  const m = demo.messages.find((x) => x.id === id);
  if (!m) return null;
  const row = demoRows().find((r) => r.id === id)!;
  const o = m.orderId ? demo.orders.find((x) => x.id.toUpperCase() === m.orderId.toUpperCase()) : null;
  return {
    ...row,
    createdAt: m.date,
    locale: "fr",
    userId: null,
    messages: [{ id: `${m.id}-1`, author: "client", body: m.text, createdAt: m.date }],
    order: o ? { number: o.id, statusLabel: ORDER_STATUS[o.status] ?? "" } : null,
  };
}

/** L'admin a ouvert le fil : il n'est plus « non lu ». Ne jette jamais. */
export async function markAdminRead(id: string): Promise<void> {
  const sb = tryAdminClient();
  if (!sb || !UUID.test(id)) return;
  try {
    await withTimeout(sb.from("conversations").update({ unread_admin: false }).eq("id", id).eq("unread_admin", true));
  } catch {
    /* indicateur seulement */
  }
}
