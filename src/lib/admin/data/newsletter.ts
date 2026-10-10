import "server-only";
import demo from "@/lib/demo/admin.json";
import { tryAdminClient, withTimeout } from "@/lib/settings/db";

export type Subscriber = { id: string; channel: "email" | "whatsapp"; value: string; createdAt: string };
export type NewsletterData = {
  rows: Subscriber[];
  counts: { email: number; whatsapp: number };
  connected: boolean;
  truncated: boolean;
};

export const SUBSCRIBER_LIMIT = 200;
const EXPORT_PAGE = 1000;
const EXPORT_MAX = 20000;

const asChannel = (c: unknown): "email" | "whatsapp" => (c === "whatsapp" ? "whatsapp" : "email");

export async function getSubscribers(): Promise<NewsletterData> {
  const sb = tryAdminClient();
  if (sb) {
    try {
      const [rowsRes, emailRes, waRes] = await withTimeout(
        Promise.all([
          sb.from("newsletter_subs").select("id,channel,value,created_at").order("created_at", { ascending: false }).limit(SUBSCRIBER_LIMIT),
          sb.from("newsletter_subs").select("id", { count: "exact", head: true }).eq("channel", "email"),
          sb.from("newsletter_subs").select("id", { count: "exact", head: true }).eq("channel", "whatsapp"),
        ]),
      );
      if (!rowsRes.error && rowsRes.data) {
        const email = emailRes.count ?? 0;
        const whatsapp = waRes.count ?? 0;
        return {
          rows: rowsRes.data.map((r) => ({ id: String(r.id), channel: asChannel(r.channel), value: String(r.value), createdAt: String(r.created_at) })),
          counts: { email, whatsapp },
          connected: true,
          truncated: email + whatsapp > rowsRes.data.length,
        };
      }
    } catch {
      /* repli démo */
    }
  }
  const rows = demo.subs
    .map((s) => ({ id: s.id, channel: asChannel(s.channel), value: s.value, createdAt: s.date }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    rows,
    counts: { email: rows.filter((r) => r.channel === "email").length, whatsapp: rows.filter((r) => r.channel === "whatsapp").length },
    connected: false,
    truncated: false,
  };
}

/** Tous les abonnés pour l'export CSV (pagination par blocs de 1 000, plafond 20 000). */
/** `null` = base configurée mais illisible (ne jamais exporter la démo à la place des vraies données). */
export async function getAllSubscribersForExport(): Promise<Subscriber[] | null> {
  const sb = tryAdminClient();
  if (sb) {
    try {
      const out: Subscriber[] = [];
      for (let from = 0; from < EXPORT_MAX; from += EXPORT_PAGE) {
        const { data, error } = await withTimeout(
          sb
            .from("newsletter_subs")
            .select("id,channel,value,created_at")
            .order("created_at", { ascending: false })
            .order("id")
            .range(from, from + EXPORT_PAGE - 1),
        );
        if (error || !data) throw new Error("export_failed");
        out.push(...data.map((r) => ({ id: String(r.id), channel: asChannel(r.channel), value: String(r.value), createdAt: String(r.created_at) })));
        if (data.length < EXPORT_PAGE) break;
      }
      return out;
    } catch {
      return null;
    }
  }
  return demo.subs.map((s) => ({ id: s.id, channel: asChannel(s.channel), value: s.value, createdAt: s.date }));
}
