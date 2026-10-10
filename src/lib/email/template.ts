import { fmtXof } from "@/lib/money";
import {
  EMAIL_COPY,
  EMAIL_FOOTER,
  REFUND_CLAIM_VALIDATED,
  SPECIAL_LINES,
  type EmailLocale,
  type OrderEmailKind,
} from "./copy";

/**
 * Gabarits HTML des e-mails de commande : tables + styles inline (compatibles clients mail), charte Wá xɔ
 * (crème, encre, terre cuite pour le « ɔ », soleil pour le bouton). Textes : docs/copy/emails.md (voir copy.ts).
 * TOUTE donnée client est échappée. Pur : aucune entrée/sortie.
 */

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
  /** Origine publique du site (https://…) ; null → pas de bouton de suivi. */
  siteUrl: string | null;
};

export type RenderedEmail = { subject: string; preheader: string; html: string; text: string };

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const C = { ink: "#141210", cream: "#F4F1EA", terracotta: "#E2552B", sun: "#FFC93C", text: "#4A443C", muted: "#6B645A", border: "#E2DCCF" };
const FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
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

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

function safeSiteUrl(url: string | null): string | null {
  return url && /^https?:\/\/[^\s"'<>]+$/i.test(url) ? url.replace(/\/+$/, "") : null;
}

export function renderOrderEmail(data: OrderEmailData, kind: OrderEmailKind): RenderedEmail {
  const loc = data.locale;
  const isCod = data.pay === "cod";
  const kindCopy = EMAIL_COPY[loc][kind];
  const variant = isCod && kindCopy.cod ? kindCopy.cod : kindCopy.online;
  const special = SPECIAL_LINES[loc];
  const brand = data.brand;
  const shop = brand.shopName || "Wá xɔ";
  const typo = loc === "fr" ? frTypography : (s: string) => s;

  const refundLine =
    isCod || !data.paid
      ? special.nothingToPay
      : REFUND_CLAIM_VALIDATED
        ? special.refundValidated
        : special.refundCautious;

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
  for (const raw of variant.body) {
    if (raw === "{{items}}") {
      blocks.push({ kind: "items" });
      continue;
    }
    if (!vars.name && /\{\{name\}\}/.test(raw) && raw.length < 24) {
      blocks.push({ kind: "p", text: special.greetingAnonymous });
      continue;
    }
    const text = typo(fill(raw, vars)).trim();
    if (text) blocks.push({ kind: "p", text });
  }

  const site = safeSiteUrl(data.siteUrl);
  const ctaUrl = site && variant.cta ? `${site}/${loc}/suivi` : null;
  const qtyLine = (it: OrderEmailData["items"][number]) => `${it.qty} × ${it.name}`;

  const itemsHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${data.items
    .map(
      (it) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid ${C.border};font:400 15px/1.4 ${FONT};color:${C.ink};">${escapeHtml(qtyLine(it))}</td><td align="right" style="padding:8px 0;border-bottom:1px solid ${C.border};font:400 15px/1.4 ${FONT};color:${C.ink};white-space:nowrap;vertical-align:top;">${escapeHtml(formatAmount(it.unitPrice * it.qty, loc))}</td></tr>`,
    )
    .join("")}</table>`;

  const bodyHtml = blocks
    .map((b, i) => {
      if (b.kind === "items") return `<tr><td style="padding:0 0 16px;">${itemsHtml}</td></tr>`;
      const isFirst = i === 0;
      const isSignature = i === blocks.length - 1;
      const style = isSignature
        ? `font:600 16px/1.55 ${FONT};color:${C.ink};`
        : isFirst
          ? `font:600 16px/1.55 ${FONT};color:${C.ink};`
          : `font:400 16px/1.55 ${FONT};color:${C.text};`;
      return `<tr><td style="padding:0 0 16px;${style}">${escapeHtml(b.text).replace(/\n/g, "<br>")}</td></tr>`;
    })
    .join("\n");

  const footerLines = EMAIL_FOOTER[loc].map((l) => typo(fill(l, vars)));
  const waUrl = /^\d{8,15}$/.test(brand.waNumber) ? `https://wa.me/${brand.waNumber}` : null;

  const footerHtml = footerLines
    .map((l) => escapeHtml(l))
    .map((l, i) => {
      if (i === 1 && waUrl) {
        // « WhatsApp {{whatsapp}} · {{email}} » : le numéro devient un lien.
        return l.replace(escapeHtml(brand.whatsapp), `<a href="${escapeHtml(waUrl)}" style="color:${C.ink};">${escapeHtml(brand.whatsapp)}</a>`);
      }
      return l;
    })
    .join("<br>");

  const html = `<!doctype html>
<html lang="${loc}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.cream};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="padding:0 4px 16px;font:700 24px/1 ${FONT};color:${C.ink};letter-spacing:-0.5px;">Wá x<span style="color:${C.terracotta};">ɔ</span></td></tr>
<tr><td style="background:#FFFFFF;border-radius:20px;padding:28px 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${bodyHtml}
${
  ctaUrl
    ? `<tr><td style="padding:4px 0 0;"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${C.sun};color:${C.ink};text-decoration:none;font:600 16px/1 ${FONT};padding:15px 24px;border-radius:999px;">${escapeHtml(variant.cta ?? "")}</a></td></tr>`
    : ""
}
</table>
</td></tr>
<tr><td style="padding:18px 8px 0;font:400 13px/1.6 ${FONT};color:${C.muted};">${footerHtml}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const textParts: string[] = [];
  for (const b of blocks) {
    if (b.kind === "items") textParts.push(data.items.map((it) => `${qtyLine(it)} — ${formatAmount(it.unitPrice * it.qty, loc)}`).join("\n"));
    else textParts.push(b.text);
  }
  if (ctaUrl) textParts.push(`${variant.cta} : ${ctaUrl}`);
  textParts.push(footerLines.join("\n"));

  return { subject, preheader, html, text: textParts.join("\n\n") };
}
