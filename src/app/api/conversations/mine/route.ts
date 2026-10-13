import { fail, json } from "@/lib/auth/http";
import { withTimeout } from "@/lib/auth/timeout";
import { getSessionContext } from "@/lib/auth/user";
import { isCategory, isStatus, type MineRow } from "@/lib/conversations/types";

/**
 * « Mes demandes » du client connecté. Lecture sous RLS (conversations_owner_read) ET filtre explicite user_id : un admin
 * verrait sinon toutes les conversations. Aucune coordonnée ni note interne dans la réponse.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return fail("unauthorized", 401);
  try {
    const { data, error } = await withTimeout(
      ctx.sb
        .from("conversations")
        .select("id,subject,category,status,order_number,last_message_at,unread_customer")
        .eq("user_id", ctx.userId)
        .order("last_message_at", { ascending: false })
        .limit(50),
    );
    if (error) return fail("generic", 502);
    const rows: MineRow[] = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      subject: String(r.subject ?? ""),
      category: isCategory(r.category) ? r.category : "autre",
      status: isStatus(r.status) ? r.status : "nouveau",
      orderNumber: typeof r.order_number === "string" && r.order_number ? r.order_number : null,
      lastMessageAt: String(r.last_message_at),
      unread: r.unread_customer === true,
    }));
    return json({ ok: true, conversations: rows });
  } catch {
    return fail("generic", 502);
  }
}
