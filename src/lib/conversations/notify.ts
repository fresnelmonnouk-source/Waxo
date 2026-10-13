import "server-only";
import { isValidEmail } from "@/lib/auth/validation";
import { getSettings } from "@/lib/catalog";
import { renderCustomerMail, renderTeamMail, sendRendered, type BrandInfo } from "@/lib/email/conversation";
import { siteUrl } from "@/lib/payment/config";
import { customerEmail, issueLink, type AdminDb, type NotifyTarget, type OpenInput } from "./store";
import { discussionPath } from "./token";

/**
 * Envois d'e-mails de l'espace Discussion. Appelés via runAfterResponse (src/lib/email/defer.ts) : jamais bloquants,
 * ne jettent jamais. Destinataire équipe : ORDER_NOTIFY_EMAIL, sinon l'e-mail de contact des Réglages (comme l'alerte
 * « Nouvelle commande »).
 */

async function brand(): Promise<BrandInfo> {
  try {
    const s = await getSettings();
    return { shopName: s.brand.shopName || "Wá xɔ", whatsapp: s.brand.whatsapp, email: s.brand.email };
  } catch {
    return { shopName: "Wá xɔ", whatsapp: "", email: "" };
  }
}

export function teamRecipient(b: BrandInfo): string | null {
  const to = (process.env.ORDER_NOTIFY_EMAIL?.trim() || b.email || "").trim();
  return isValidEmail(to) ? to : null;
}

/** URL absolue du fil, ou null si l'origine publique du site n'est pas connue (aucun lien cassé dans un e-mail). */
export function absoluteLink(locale: "fr" | "en", token: string): string | null {
  const site = siteUrl();
  return site ? `${site}${discussionPath(locale, token)}` : null;
}

/** Nouvelle conversation : accusé de réception au client (si e-mail) + alerte à l'équipe (extrait seulement). */
export async function notifyCreated(args: { id: string; token: string; input: OpenInput; accountEmail: string | null }): Promise<void> {
  const b = await brand();
  const site = siteUrl();
  const { input } = args;
  const to = isValidEmail(input.contact) ? input.contact : args.accountEmail && isValidEmail(args.accountEmail) ? args.accountEmail : null;
  const link = absoluteLink(input.locale, args.token);
  const jobs: Promise<unknown>[] = [];
  if (to && link) {
    const mail = renderCustomerMail({
      kind: "received",
      locale: input.locale,
      name: input.name,
      subject: input.subject,
      category: input.category,
      orderNumber: input.orderNumber || null,
      link,
      brand: b,
      siteUrl: site,
    });
    jobs.push(sendRendered(to, mail, `waxo-conv-${args.id}-received`, b.email || undefined));
  }
  const team = teamRecipient(b);
  if (team) {
    const mail = renderTeamMail({
      kind: "new",
      conversationId: args.id,
      category: input.category,
      source: input.source,
      subject: input.subject,
      orderNumber: input.orderNumber || null,
      name: input.name,
      body: input.body,
      siteUrl: site,
    });
    jobs.push(sendRendered(team, mail, `waxo-conv-${args.id}-team-new`));
  }
  await Promise.all(jobs);
}

/** Le client a répondu : alerte à l'équipe, seulement si la conversation n'était pas déjà « non lue » (pas de rafale). */
export async function notifyCustomerReplied(args: { target: NotifyTarget; messageId: string; body: string; wasUnreadAdmin: boolean }): Promise<void> {
  if (args.wasUnreadAdmin) return;
  const b = await brand();
  const team = teamRecipient(b);
  if (!team) return;
  const t = args.target;
  const mail = renderTeamMail({
    kind: "customer_reply",
    conversationId: t.id,
    category: t.category,
    source: t.source,
    subject: t.subject,
    orderNumber: t.orderNumber,
    name: t.name,
    body: args.body,
    siteUrl: siteUrl(),
  });
  await sendRendered(team, mail, `waxo-conv-msg-${args.messageId}-team`);
}

export type ReplyMailPlan = { to: string; link: string } | { to: null; reason: "no_email" | "no_site" | "not_configured" };

/**
 * Prépare l'e-mail « Vous avez une réponse » : destinataire et NOUVEAU lien privé (le précédent n'est pas relisible).
 * Synchrone pour que l'admin sache tout de suite si le client sera prévenu ; l'envoi lui-même est différé.
 */
export async function planReplyMail(sb: AdminDb, target: NotifyTarget): Promise<ReplyMailPlan> {
  if (!process.env.RESEND_API_KEY?.trim()) return { to: null, reason: "not_configured" };
  const to = await customerEmail(sb, target);
  if (!to) return { to: null, reason: "no_email" };
  if (!siteUrl()) return { to: null, reason: "no_site" };
  const token = await issueLink(sb, target.id);
  const link = absoluteLink(target.locale, token);
  return link ? { to, link } : { to: null, reason: "no_site" };
}

export async function sendReplyMail(args: { target: NotifyTarget; to: string; link: string; messageId: string }): Promise<void> {
  const b = await brand();
  const t = args.target;
  const mail = renderCustomerMail({
    kind: "reply",
    locale: t.locale,
    name: t.name,
    subject: t.subject,
    category: t.category,
    orderNumber: t.orderNumber,
    link: args.link,
    brand: b,
    siteUrl: siteUrl(),
  });
  await sendRendered(args.to, mail, `waxo-conv-msg-${args.messageId}-reply`, b.email || undefined);
}
