import { fmtXof } from "@/lib/money";
import { prettyPhone } from "@/lib/checkout/phone";
import { button, escapeHtml, infoBox, items, join, notice, p, raw, renderLayout } from "./layout";
import { safeSiteUrl, type RenderedEmail } from "./template";

/** Alerte interne « Nouvelle commande » (back-office en français seulement). Pur : données → objet, HTML, texte. */

export type ShopOrderData = {
  number: string;
  name: string;
  phone: string;
  address: string;
  note: string;
  zone: string;
  pay: string;
  paid: boolean;
  subtotal: number;
  shippingFee: number;
  total: number;
  items: { name: string; qty: number; unitPrice: number }[];
  siteUrl: string | null;
};

const PAY: Record<string, string> = { momo: "MTN MoMo", moov: "Moov Money", celtiis: "Celtiis Cash", carte: "Carte bancaire", cod: "À la livraison" };
const ZONE: Record<string, string> = { cotonou: "Cotonou & Calavi", autre: "Autre ville" };
const oneLine = (s: string) => s.replace(/[\r\n\u0000-\u001f]+/g, " ").trim();

export function renderShopNewOrder(o: ShopOrderData): RenderedEmail {
  const cod = o.pay === "cod";
  const status = cod ? "à encaisser à la livraison" : o.paid ? "payée en ligne" : "paiement en attente";
  const subject = oneLine(`Nouvelle commande ${o.number} · ${fmtXof(o.total)} · ${status}`);
  const preheader = oneLine(`${o.name} · ${ZONE[o.zone] ?? o.zone} · ${o.items.reduce((n, i) => n + i.qty, 0)} article(s)`);
  const site = safeSiteUrl(o.siteUrl);
  const phone = prettyPhone(o.phone);
  const wa = /^01\d{8}$/.test(o.phone) ? `https://wa.me/229${o.phone}` : null;

  const body = join(
    p(`${o.name} vient de passer commande.`, "strong"),
    infoBox([
      { label: "Commande", value: o.number, strong: true },
      { label: "Total", value: fmtXof(o.total), strong: true },
      { label: "Paiement", value: `${PAY[o.pay] ?? o.pay}${o.paid ? " · payée" : ""}` },
      { label: "Livraison", value: `${ZONE[o.zone] ?? o.zone}${o.shippingFee ? ` · ${fmtXof(o.shippingFee)}` : " · offerte"}` },
    ]),
    items(o.items.map((i) => ({ label: `${i.qty} × ${i.name}`, amount: fmtXof(i.unitPrice * i.qty) })), "Articles"),
    p(
      raw(
        `<strong style="color:#141210;">Client</strong><br>${escapeHtml(o.name)}<br>` +
          (wa ? `<a href="${escapeHtml(wa)}" style="color:#141210;font-weight:600;">${escapeHtml(phone)}</a> (WhatsApp)` : escapeHtml(phone)) +
          `<br>${escapeHtml(o.address).replace(/\n/g, "<br>")}`,
      ),
    ),
    o.note ? notice(`Note du client : ${o.note}`) : null,
    cod ? notice("À confirmer par WhatsApp avant expédition. Sans confirmation sous 48 h, la commande expire et le stock est libéré.") : null,
    site ? button(`${site}/admin/commandes`, "Ouvrir dans l'admin") : null,
  );

  const html = renderLayout({
    locale: "fr",
    title: subject,
    preheader,
    eyebrow: "Back office · nouvelle commande",
    heading: `${o.number} · ${fmtXof(o.total)}`,
    body,
    footer: ["Alerte automatique de la boutique Wá xɔ.", "Destinataire : ORDER_NOTIFY_EMAIL, sinon l'e-mail de contact (Admin → Réglages)."],
    logoUrl: site ? `${site}/email/logo-light.png` : null,
  });

  const text = [
    `${o.name} vient de passer commande.`,
    `Commande ${o.number} — ${fmtXof(o.total)} — ${PAY[o.pay] ?? o.pay}${o.paid ? " (payée)" : ""}`,
    `Livraison : ${ZONE[o.zone] ?? o.zone}`,
    o.items.map((i) => `${i.qty} × ${i.name} — ${fmtXof(i.unitPrice * i.qty)}`).join("\n"),
    `Client : ${o.name} · ${phone}\n${o.address}`,
    o.note ? `Note : ${o.note}` : "",
    site ? `Admin : ${site}/admin/commandes` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { subject, preheader, html, text };
}
