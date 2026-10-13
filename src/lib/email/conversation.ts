import "server-only";
import { excerpt, type Category, type Lang, type Source } from "@/lib/conversations/types";
import { button, fallbackLink, infoBox, join, notice, p, renderLayout } from "./layout";
import { sendViaResend } from "./resend";
import { safeSiteUrl } from "./template";

/**
 * E-mails de l'espace « Discussion » (gabarit commun layout.ts) :
 *  - client  : « Nous avons bien reçu votre demande » et « Vous avez une réponse », FR/EN, avec le LIEN PRIVÉ du fil ;
 *  - équipe  : « Nouvelle demande » et « Un client a répondu », en français, avec un EXTRAIT seulement (jamais le message
 *              complet ni les coordonnées du client).
 * Les textes client ne contiennent jamais la réponse elle-même : on la lit sur le site, derrière le lien privé.
 * Toute donnée saisie est échappée par le gabarit. Rendu PUR ; envoi : ne jette jamais.
 */

export type Rendered = { subject: string; preheader: string; html: string; text: string };
export type BrandInfo = { shopName: string; whatsapp: string; email: string };

const NBSP = " ";
const frTypo = (s: string) => s.replace(/ ([?!:;»])/g, `${NBSP}$1`).replace(/« /g, `«${NBSP}`);
const oneLine = (s: string) => s.replace(/[\r\n\u0000-\u001f]+/g, " ").trim();
const firstName = (name: string) => (name.trim().split(/\s+/)[0] ?? "").slice(0, 60);

export const CATEGORY_TEXT: Record<Lang, Record<Category, string>> = {
  fr: { question: "Question", plainte: "Plainte", retour: "Retour ou remboursement", commande: "Commande", autre: "Autre" },
  en: { question: "Question", plainte: "Complaint", retour: "Return or refund", commande: "Order", autre: "Other" },
};

const COPY = {
  fr: {
    hello: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    sign: (shop: string) => `L'équipe ${shop}`,
    received: {
      subject: "Nous avons bien reçu votre demande",
      preheader: "Suivez la discussion et répondez depuis votre lien privé.",
      eyebrow: "Votre demande",
      heading: "Nous avons bien reçu votre demande",
      lead: "Merci pour votre message. Notre équipe vous répond 7 j/7, de 8 h à 20 h. Vous recevrez un e-mail dès qu'une réponse sera prête.",
      cta: "Voir ma demande",
    },
    reply: {
      subject: (shop: string) => `Vous avez une réponse de ${shop}`,
      preheader: "Notre équipe a répondu à votre demande.",
      eyebrow: "Votre demande",
      heading: "Vous avez une réponse",
      lead: (s: string) => `Notre équipe a répondu à votre demande « ${s} ». Pour lire la réponse et nous écrire, ouvrez la discussion.`,
      leadNoSubject: "Notre équipe a répondu à votre demande. Pour lire la réponse et nous écrire, ouvrez la discussion.",
      cta: "Lire la réponse",
    },
    labels: { subject: "Objet", category: "Catégorie", order: "Commande" },
    fallback: "Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :",
    personal: "Ce lien est personnel : il donne accès à votre discussion avec notre équipe. Ne le transférez pas.",
    footer: (b: BrandInfo) => [
      `${b.shopName} · Cotonou, Bénin`,
      [b.whatsapp ? `WhatsApp ${b.whatsapp}` : "", b.email].filter(Boolean).join(" · "),
      `Vous recevez ce message parce que vous nous avez écrit depuis ${b.shopName}.`,
      "Nous ne vous demanderons jamais votre code secret Mobile Money.",
    ],
  },
  en: {
    hello: (n: string) => (n ? `Hello ${n},` : "Hello,"),
    sign: (shop: string) => `The ${shop} team`,
    received: {
      subject: "We've received your request",
      preheader: "Follow the conversation and reply from your private link.",
      eyebrow: "Your request",
      heading: "We've received your request",
      lead: "Thank you for your message. Our team replies 7 days a week, from 8 am to 8 pm. We'll email you as soon as a reply is ready.",
      cta: "View my request",
    },
    reply: {
      subject: (shop: string) => `You have a reply from ${shop}`,
      preheader: "Our team has replied to your request.",
      eyebrow: "Your request",
      heading: "You have a reply",
      lead: (s: string) => `Our team has replied to your request "${s}". To read the reply and write back, open the conversation.`,
      leadNoSubject: "Our team has replied to your request. To read the reply and write back, open the conversation.",
      cta: "Read the reply",
    },
    labels: { subject: "Subject", category: "Category", order: "Order" },
    fallback: "If the button doesn't work, copy this link into your browser:",
    personal: "This link is personal: it gives access to your conversation with our team. Please don't forward it.",
    footer: (b: BrandInfo) => [
      `${b.shopName} · Cotonou, Benin`,
      [b.whatsapp ? `WhatsApp ${b.whatsapp}` : "", b.email].filter(Boolean).join(" · "),
      `You are receiving this message because you wrote to us on ${b.shopName}.`,
      "We will never ask for your Mobile Money PIN.",
    ],
  },
} as const;

export type CustomerMailInput = {
  kind: "received" | "reply";
  locale: Lang;
  name: string;
  subject: string;
  category: Category;
  orderNumber: string | null;
  /** URL absolue du fil (https://…/fr/discussion/<jeton>). */
  link: string;
  brand: BrandInfo;
  siteUrl: string | null;
};

export function renderCustomerMail(i: CustomerMailInput): Rendered {
  const c = COPY[i.locale];
  const typo = i.locale === "fr" ? frTypo : (s: string) => s;
  const shop = i.brand.shopName || "Wá xɔ";
  const brand = { ...i.brand, shopName: shop };
  const short = excerpt(i.subject, 80);
  const k = i.kind === "received" ? c.received : c.reply;
  const subject = oneLine(typo(i.kind === "received" ? c.received.subject : c.reply.subject(shop)));
  const lead = typo(i.kind === "received" ? c.received.lead : short ? c.reply.lead(short) : c.reply.leadNoSubject);
  const hello = c.hello(firstName(i.name));
  const rows = [
    ...(short ? [{ label: c.labels.subject, value: short }] : []),
    { label: c.labels.category, value: CATEGORY_TEXT[i.locale][i.category] },
    ...(i.orderNumber ? [{ label: c.labels.order, value: i.orderNumber }] : []),
  ];
  const site = safeSiteUrl(i.siteUrl);
  const html = renderLayout({
    locale: i.locale,
    title: subject,
    preheader: typo(k.preheader),
    eyebrow: k.eyebrow,
    heading: typo(k.heading),
    body: join(
      p(hello, "strong"),
      p(lead),
      i.kind === "received" ? infoBox(rows) : null,
      button(i.link, k.cta),
      fallbackLink(typo(c.fallback), i.link),
      notice(typo(c.personal)),
      p(c.sign(shop), "strong"),
    ),
    footer: c.footer(brand).filter(Boolean).map(typo),
    logoUrl: site ? `${site}/email/logo-light.png` : null,
  });
  const sep = i.locale === "fr" ? `${NBSP}: ` : ": ";
  const text = [
    hello,
    lead,
    i.kind === "received" ? rows.map((r) => `${r.label}${sep}${r.value}`).join("\n") : "",
    `${k.cta}${sep}${i.link}`,
    typo(c.personal),
    c.sign(shop),
    c.footer(brand).filter(Boolean).map(typo).join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
  return { subject, preheader: typo(k.preheader), html, text };
}

// ───────────────────────── Équipe (français) ─────────────────────────

const SOURCE_TEXT: Record<Source, string> = { contact: "formulaire de contact", assistant: "assistant du site", suivi: "suivi de commande", compte: "Mon compte" };

export type TeamMailInput = {
  kind: "new" | "customer_reply";
  conversationId: string;
  category: Category;
  source: Source;
  subject: string;
  orderNumber: string | null;
  /** Prénom seulement (aucune coordonnée dans l'e-mail équipe). */
  name: string;
  /** Texte du message : seul un EXTRAIT est repris. */
  body: string;
  siteUrl: string | null;
};

export function renderTeamMail(i: TeamMailInput): Rendered {
  const cat = CATEGORY_TEXT.fr[i.category];
  const short = excerpt(i.subject, 60);
  const ex = excerpt(i.body, 160);
  const site = safeSiteUrl(i.siteUrl);
  const url = site ? `${site}/admin/messages?c=${encodeURIComponent(i.conversationId)}` : null;
  const isNew = i.kind === "new";
  const subject = oneLine(frTypo(`${isNew ? "Nouvelle demande" : "Réponse d'un client"} · ${cat}${short ? ` · ${short}` : ""}`));
  const heading = isNew ? "Nouvelle demande" : "Un client a répondu";
  const who = firstName(i.name);
  const rows = [
    { label: "Catégorie", value: cat },
    ...(isNew ? [{ label: "Source", value: SOURCE_TEXT[i.source] }] : []),
    ...(i.orderNumber ? [{ label: "Commande", value: i.orderNumber }] : []),
    ...(who ? [{ label: "Client", value: who }] : []),
  ];
  const lead = frTypo(`Extrait : « ${ex} »`);
  const html = renderLayout({
    locale: "fr",
    title: subject,
    preheader: frTypo(`${cat} : ${excerpt(i.body, 80)}`),
    eyebrow: `Discussions · ${cat}`,
    heading,
    body: join(
      infoBox(rows),
      p(lead),
      p(frTypo("Le message complet et les coordonnées du client sont dans l'admin, rubrique Discussions."), "small"),
      url ? button(url, "Ouvrir la discussion") : null,
    ),
    footer: ["Alerte automatique de la boutique Wá xɔ.", frTypo("Destinataire : ORDER_NOTIFY_EMAIL, sinon l'e-mail de contact (Admin → Réglages).")],
    logoUrl: site ? `${site}/email/logo-light.png` : null,
  });
  const text = [heading, rows.map((r) => `${r.label}${NBSP}: ${r.value}`).join("\n"), lead, url ? `Ouvrir la discussion${NBSP}: ${url}` : ""].filter(Boolean).join("\n\n");
  return { subject, preheader: excerpt(i.body, 80), html, text };
}

// ───────────────────────── Envoi ─────────────────────────

/** Envoie un e-mail rendu. Ne jette jamais ; renvoie false si Resend est absent ou refuse. */
export async function sendRendered(to: string, mail: Rendered, idempotencyKey: string, replyTo?: string): Promise<boolean> {
  try {
    const res = await sendViaResend({ to, subject: mail.subject, html: mail.html, text: mail.text, idempotencyKey, ...(replyTo ? { replyTo } : {}) });
    return res.ok;
  } catch {
    return false;
  }
}
