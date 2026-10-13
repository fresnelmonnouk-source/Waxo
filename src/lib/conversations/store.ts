import "server-only";
import { withTimeout } from "@/lib/auth/timeout";
import { isValidEmail } from "@/lib/auth/validation";
import type { createAdminClient } from "@/lib/supabase/admin";
import { generateToken, hashToken, isTokenShape, safeEqualHex } from "./token";
import { isCategory, isStatus, publicMessages, type Author, type Category, type Lang, type PublicThread, type Source, type Status } from "./types";

/**
 * Accès aux conversations côté serveur, client service_role UNIQUEMENT (routes API et server actions gardées).
 * Ces fonctions jettent en cas d'erreur de base : l'appelant traduit en code d'API (jamais de détail interne au client).
 */

export type AdminDb = ReturnType<typeof createAdminClient>;

const MS = 5000;

export type OpenInput = {
  category: Category;
  subject: string;
  orderNumber: string;
  name: string;
  contact: string;
  userId: string | null;
  locale: Lang;
  source: Source;
  body: string;
};

/** Conversation + premier message + lien privé (une transaction SQL). Renvoie le jeton EN CLAIR, jamais stocké. */
export async function openConversation(sb: AdminDb, input: OpenInput): Promise<{ id: string; token: string }> {
  const token = generateToken();
  const { data, error } = await withTimeout(
    sb.rpc("conversation_open", {
      p_category: input.category,
      p_subject: input.subject,
      p_order_number: input.orderNumber || null,
      p_name: input.name,
      p_contact: input.contact,
      p_user_id: input.userId,
      p_locale: input.locale,
      p_source: input.source,
      p_body: input.body,
      p_token_hash: hashToken(token),
    }),
    MS,
  );
  if (error || typeof data !== "string") throw new Error("conversation_open");
  return { id: data, token };
}

/**
 * Jeton → id de conversation, ou null (jeton mal formé, inconnu). Recherche par empreinte (jamais par jeton), puis
 * comparaison en temps constant de l'empreinte relue. Même réponse pour « mal formé » et « inconnu » (anti-énumération).
 */
export async function conversationIdFromToken(sb: AdminDb, token: unknown): Promise<string | null> {
  if (!isTokenShape(token)) return null;
  const hash = hashToken(token);
  const { data, error } = await withTimeout(sb.from("conversation_links").select("token_hash,conversation_id").eq("token_hash", hash).maybeSingle(), MS);
  if (error) throw new Error("conversation_lookup");
  if (!data || !safeEqualHex(String(data.token_hash ?? ""), hash)) return null;
  return String(data.conversation_id);
}

/** Nouveau lien privé pour une conversation (chaque e-mail au client en porte un). Renvoie le jeton en clair. */
export async function issueLink(sb: AdminDb, conversationId: string): Promise<string> {
  const token = generateToken();
  const { error } = await withTimeout(sb.from("conversation_links").insert({ token_hash: hashToken(token), conversation_id: conversationId }), MS);
  if (error) throw new Error("conversation_link");
  return token;
}

type ConvRow = {
  id: unknown;
  subject: unknown;
  category: unknown;
  status: unknown;
  order_number: unknown;
  created_at: unknown;
  locale: unknown;
};

function toThread(c: ConvRow, msgs: { id: unknown; author: unknown; body: unknown; created_at: unknown }[]): PublicThread {
  return {
    id: String(c.id),
    subject: String(c.subject ?? ""),
    category: isCategory(c.category) ? c.category : "autre",
    status: isStatus(c.status) ? c.status : "nouveau",
    orderNumber: typeof c.order_number === "string" && c.order_number ? c.order_number : null,
    createdAt: String(c.created_at),
    locale: c.locale === "en" ? "en" : "fr",
    messages: publicMessages(msgs),
  };
}

const PUBLIC_CONV = "id,subject,category,status,order_number,created_at,locale";
const PUBLIC_MSG = "id,author,body,created_at";

/** Fil vu par le client : la requête exclut les notes internes, et `publicMessages` les refiltre (double garde). */
export async function loadPublicThread(sb: AdminDb, conversationId: string): Promise<PublicThread | null> {
  const [conv, msgs] = await Promise.all([
    withTimeout(sb.from("conversations").select(PUBLIC_CONV).eq("id", conversationId).maybeSingle(), MS),
    withTimeout(
      sb.from("conversation_messages").select(PUBLIC_MSG).eq("conversation_id", conversationId).in("author", ["client", "equipe"]).order("created_at", { ascending: true }).limit(300),
      MS,
    ),
  ]);
  if (conv.error || msgs.error) throw new Error("conversation_read");
  if (!conv.data) return null;
  return toThread(conv.data as ConvRow, (msgs.data ?? []) as { id: unknown; author: unknown; body: unknown; created_at: unknown }[]);
}

/** Même fil, lu avec le client lié à la SESSION (RLS : propriétaire seulement, notes exclues par la politique). */
export async function loadOwnThread(
  sb: { from: AdminDb["from"] },
  userId: string,
  conversationId: string,
): Promise<PublicThread | null> {
  const conv = await withTimeout(sb.from("conversations").select(PUBLIC_CONV).eq("id", conversationId).eq("user_id", userId).maybeSingle(), MS);
  if (conv.error) throw new Error("conversation_read");
  if (!conv.data) return null;
  const msgs = await withTimeout(
    sb.from("conversation_messages").select(PUBLIC_MSG).eq("conversation_id", conversationId).in("author", ["client", "equipe"]).order("created_at", { ascending: true }).limit(300),
    MS,
  );
  if (msgs.error) throw new Error("conversation_read");
  return toThread(conv.data as ConvRow, (msgs.data ?? []) as { id: unknown; author: unknown; body: unknown; created_at: unknown }[]);
}

export type PostResult = { messageId: string; wasUnreadAdmin: boolean; status: Status };

/** Ajoute un message (fonction SQL conversation_post, ligne verrouillée). null = conversation introuvable. */
export async function postMessage(sb: AdminDb, conversationId: string, author: Author, body: string, adminId: string | null = null): Promise<PostResult | null> {
  const { data, error } = await withTimeout(
    sb.rpc("conversation_post", { p_conversation: conversationId, p_author: author, p_body: body, p_admin: adminId }),
    MS,
  );
  if (error) throw new Error("conversation_post");
  const row = (Array.isArray(data) ? data[0] : data) as { message_id?: unknown; was_unread_admin?: unknown; new_status?: unknown } | null | undefined;
  if (!row || typeof row.message_id !== "string") return null;
  return { messageId: row.message_id, wasUnreadAdmin: row.was_unread_admin === true, status: isStatus(row.new_status) ? row.new_status : "en_cours" };
}

/** Le client a ouvert son fil : plus de « réponse non lue » de son côté. Ne jette jamais. */
export async function markCustomerRead(sb: AdminDb, conversationId: string): Promise<void> {
  try {
    await withTimeout(sb.from("conversations").update({ unread_customer: false }).eq("id", conversationId).eq("unread_customer", true), MS);
  } catch {
    /* indicateur seulement */
  }
}

/** Données d'envoi d'e-mail (coordonnées : SERVEUR seulement, jamais renvoyées au navigateur ni à l'IA). */
export type NotifyTarget = {
  id: string;
  subject: string;
  category: Category;
  status: Status;
  orderNumber: string | null;
  name: string;
  contact: string;
  userId: string | null;
  locale: Lang;
  source: Source;
};

export async function loadNotifyTarget(sb: AdminDb, conversationId: string): Promise<NotifyTarget | null> {
  const { data, error } = await withTimeout(
    sb.from("conversations").select("id,subject,category,status,order_number,customer_name,customer_contact,user_id,locale,source").eq("id", conversationId).maybeSingle(),
    MS,
  );
  if (error) throw new Error("conversation_read");
  if (!data) return null;
  const d = data as Record<string, unknown>;
  return {
    id: String(d.id),
    subject: String(d.subject ?? ""),
    category: isCategory(d.category) ? d.category : "autre",
    status: isStatus(d.status) ? d.status : "nouveau",
    orderNumber: typeof d.order_number === "string" && d.order_number ? d.order_number : null,
    name: String(d.customer_name ?? ""),
    contact: String(d.customer_contact ?? ""),
    userId: typeof d.user_id === "string" ? d.user_id : null,
    locale: d.locale === "en" ? "en" : "fr",
    source: (["contact", "assistant", "suivi", "compte"] as const).find((s) => s === d.source) ?? "contact",
  };
}

/** E-mail du client : celui qu'il a saisi, sinon celui de son compte. null = pas d'e-mail (contact par téléphone). */
export async function customerEmail(sb: AdminDb, target: Pick<NotifyTarget, "contact" | "userId">): Promise<string | null> {
  if (isValidEmail(target.contact)) return target.contact.trim().toLowerCase();
  if (!target.userId) return null;
  try {
    const { data } = await withTimeout(sb.auth.admin.getUserById(target.userId), MS);
    const email = data?.user?.email;
    return email && isValidEmail(email) ? email.toLowerCase() : null;
  } catch {
    return null;
  }
}
