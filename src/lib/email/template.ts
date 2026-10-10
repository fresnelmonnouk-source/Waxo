import { fmtXof } from "@/lib/money";
import {
  EMAIL_COPY,
  EMAIL_FOOTER,
  EMAIL_STEP,
  EMAIL_UI,
  REFUND_CLAIM_VALIDATED,
  SPECIAL_LINES,
  type EmailLocale,
  type OrderEmailKind,
} from "./copy";
import { button, escapeHtml, helpBlock, infoBox, items as itemsBlock, join, p, raw, renderLayout, steps, type Html } from "./layout";

/**
 * E-mails de commande : textes de Marcus (copy.ts, docs/copy/emails.md) dans le gabarit commun (layout.ts) — bandeau encre,
 * suivi en étapes, encadré commande, articles, bouton soleil, aide WhatsApp. TOUTE donnée client est échappée. Pur.
 */

export { escapeHtml };

export type OrderEmailData = {
  locale: EmailLocale;
  number: string;
  /** Nom complet saisi à la commande (le prénom est extrait). */
  name: string;
  items: { name: string; qty: number; unitPrice: number }[];
  total: number;
  pay: string;
  paid: boolean;
  /** Expression « Livraison prévue : … » déjà calculée côté serveur (voir delivery.ts). */
  deliveryDate: string;
  brand: { shopName: string; whatsapp: string; waNumber: string; email: string; hours: string };
  /** Origine publique du site (https://…) ; null → pas de bouton de suivi ni de logo image. */
  siteUrl: string | null;
};

export type RenderedEmail = { subject: string; preheader: string; html: string; text: string };

const NBSP = " ";

/** Montant : « 12 500 F » (FR) ou « 12,500 F » (EN), espace insécable avant F. */
export function formatAmount(amount: number, locale: EmailLocale): string {
  if (locale === "fr") return fmtXof(amount);
  return Math.round(amount || 0).toLocaleString("en-US") + NBSP + "F";
}

/** Typographie française : espace insécable avant ? ! : ; (le texte source utilise des espaces simples). */
function frTypography(s: string): string {
  return s.replace(/ ([?!:;])/g, `${NBSP}$1`);
}

/** Sans retour à la ligne ni caractère de contrôle : sûr pour un objet d'e-mail. */
const oneLine = (s: string): string => s.replace(/[\r\n\u0000-\u001f]+/g, " ").trim();

export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

export function safeSiteUrl(url: string | null): string | null {
  return url && /^https?:\/\/[^\s"'<>]+$/i.test(url) ? url.replace(/\/+$/, "") : null;
}

/** Lien WhatsApp cliquable dans un texte déjà échappé (le numéro affiché devient un lien wa.me). */
export function linkWhatsapp(escapedText: string, brand: OrderEmailData["brand"]): Html {
  const waUrl = /^\d{8,15}$/.test(brand.waNumber) ? `https://wa.me/${brand.waNumber}` : null;
  if (!waUrl || !brand.whatsapp) return raw(escapedText);
  return raw(escapedText.replace(escapeHtml(brand.whatsapp), `<a href="${escapeHtml(waUrl)}" style="color:#141210;font-weight:600;white-space:nowrap;">${escapeHtml(brand.whatsapp)}</a>`));
}

export function renderOrderEmail(data: OrderEmailData, kind: OrderEmailKind): RenderedEmail {
  const loc = data.locale;
  const isCod = data.pay === "cod";
  const kindCopy = EMAIL_COPY[loc][kind];
  const variant = isCod && kindCopy.cod ? kindCopy.cod : kindCopy.online;
  const special = SPECIAL_LINES[loc];
  const ui = EMAIL_UI[loc];
  const brand = data.brand;
  const shop = brand.shopName || "Wá xɔ";
  const typo = loc === "fr" ? frTypography : (s: string) => s;

  const refundLine =
    isCod || !data.paid ? special.nothingToPay : REFUND_CLAIM_VALIDATED ? special.refundValidated : special.refundCautious;

  const vars: Record<string, string> = {
    name: firstName(data.name),
    orderNumber: data.number,
    total: formatAmount(data.total, loc),
    deliveryDate: data.deliveryDate,
    whatsapp: brand.whatsapp,
    shopName: shop,
    email: brand.email,
    paidLine: data.paid ? special.paid : "",
    refundLine: "",
  };
  vars.refundLine = fill(refundLine, vars);

  const subject = oneLine(typo(fill(variant.subject, vars)));
  const preheader = oneLine(typo(fill(variant.preheader, vars)));

  // Corps : « Bonjour {{name}}, » sans prénom → « Bonjour, » ; paragraphes vides supprimés.
  type Block = { kind: "p"; text: string } | { kind: "items" };
  const blocks: Block[] = [];
  for (const rawLine of variant.body) {
    if (rawLine === "{{items}}") {
      blocks.push({ kind: "items" });
      continue;
    }
    if (!vars.name && /\{\{name\}\}/.test(rawLine) && rawLine.length < 24) {
      blocks.push({ kind: "p", text: special.greetingAnonymous });
      continue;
    }
    const text = typo(fill(rawLine, vars)).trim();
    if (text) blocks.push({ kind: "p", text });
  }

  const site = safeSiteUrl(data.siteUrl);
  const ctaUrl = site && variant.cta ? `${site}/${loc}/suivi` : null;
  const qtyLine = (it: OrderEmailData["items"][number]) => `${it.qty} × ${it.name}`;

  // ── HTML ──
  const step = EMAIL_STEP[kind];
  const heading = (isCod && ui.heading[kind].cod) || ui.heading[kind].online;
  const info = infoBox([
    { label: ui.order, value: data.number, strong: true },
    ...(kind !== "livree" && kind !== "annulee" ? [{ label: ui.delivery, value: typo(data.deliveryDate) }] : []),
    { label: ui.payment, value: isCod ? `${ui.payCod}${data.paid ? ` · ${ui.paid}` : ""}` : `${ui.payOnline}${data.paid ? ` · ${ui.paid}` : ""}` },
  ]);
  const bodyBlocks: Html[] = blocks.map((b, i) => {
    if (b.kind === "items") return itemsBlock(data.items.map((it) => ({ label: qtyLine(it), amount: formatAmount(it.unitPrice * it.qty, loc) })), ui.items);
    const isFirst = i === 0;
    const isSignature = i === blocks.length - 1;
    return p(linkWhatsapp(escapeHtml(b.text).replace(/\n/g, "<br>"), brand), isFirst || isSignature ? "strong" : "normal");
  });
  // Ordre : salutation, suivi, encadré, puis le texte ; bouton avant la signature.
  const [greeting, ...rest] = bodyBlocks;
  const signature = rest.pop();
  const body = join(
    greeting,
    step !== null ? steps(ui.steps, step) : null,
    info,
    ...rest,
    ctaUrl && variant.cta ? button(ctaUrl, variant.cta) : null,
    signature,
  );

  const footerLines = EMAIL_FOOTER[loc].map((l) => typo(fill(l, vars)));
  const footer = footerLines.map((l, i) => (i === 1 ? linkWhatsapp(escapeHtml(l), brand) : l));
  const help = brand.whatsapp ? helpBlock(ui.helpTitle, linkWhatsapp(escapeHtml(typo(fill(ui.helpText, vars))), brand)) : null;

  const html = renderLayout({
    locale: loc,
    title: subject,
    preheader,
    eyebrow: `${ui.order} ${data.number}`,
    heading,
    body,
    help: kind === "annulee" ? null : help,
    footer,
    logoUrl: site ? `${site}/email/logo-light.png` : null,
  });

  const textParts: string[] = [];
  for (const b of blocks) {
    if (b.kind === "items") textParts.push(data.items.map((it) => `${qtyLine(it)} — ${formatAmount(it.unitPrice * it.qty, loc)}`).join("\n"));
    else textParts.push(b.text);
  }
  if (ctaUrl) textParts.push(`${variant.cta} : ${ctaUrl}`);
  textParts.push(footerLines.join("\n"));

  return { subject, preheader, html, text: textParts.join("\n\n") };
}
