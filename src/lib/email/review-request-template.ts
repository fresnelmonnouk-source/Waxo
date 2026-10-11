import { button, join, p, renderLayout } from "./layout";
import { safeSiteUrl, type RenderedEmail } from "./template";

/** E-mail « Donnez votre avis » envoyé quelques jours après la livraison. Pur : données → objet, HTML, texte. */

export type ReviewRequestData = {
  locale: "fr" | "en";
  firstName: string;
  orderNumber: string;
  products: { name: string; slug: string }[];
  siteUrl: string | null;
};

const MAX_PRODUCTS = 4;

const COPY = {
  fr: {
    subject: (n: string) => `Votre avis sur votre commande ${n}`,
    preheader: "Deux minutes pour aider les prochains clients à bien choisir.",
    eyebrow: "Votre avis",
    heading: "Ça vous a plu ?",
    hello: (name: string) => (name ? `Bonjour ${name},` : "Bonjour,"),
    intro: (n: string) => `Votre commande ${n} vous a été livrée il y a quelques jours. Votre avis aide les prochains clients à bien choisir, et nous aide à garder les bons produits.`,
    howto: "Il suffit d'être connecté à votre compte Wá xɔ. Une note et une phrase, c'est déjà beaucoup.",
    cta: "Donner mon avis",
    ctaOne: (name: string) => `Donner mon avis sur ${name}`,
    footer: ["Vous recevez ce message une seule fois, après la livraison de votre commande."],
  },
  en: {
    subject: (n: string) => `Your review of order ${n}`,
    preheader: "Two minutes to help the next customers choose well.",
    eyebrow: "Your review",
    heading: "Did you like it?",
    hello: (name: string) => (name ? `Hello ${name},` : "Hello,"),
    intro: (n: string) => `Your order ${n} was delivered a few days ago. Your review helps the next customers choose well, and helps us keep the right products.`,
    howto: "You just need to be signed in to your Wá xɔ account. A rating and one sentence is already a lot.",
    cta: "Leave a review",
    ctaOne: (name: string) => `Review ${name}`,
    footer: ["You receive this message only once, after your order is delivered."],
  },
} as const;

const oneLine = (s: string) => s.replace(/[\r\n\u0000-\u001f]+/g, " ").trim();

export function renderReviewRequest(d: ReviewRequestData): RenderedEmail | null {
  const site = safeSiteUrl(d.siteUrl);
  const products = d.products.filter((x) => x.slug && x.name).slice(0, MAX_PRODUCTS);
  if (!site || products.length === 0) return null;
  const c = COPY[d.locale];
  const link = (slug: string) => `${site}/${d.locale}/produit/${encodeURIComponent(slug)}#avis`;
  const first = oneLine(d.firstName).slice(0, 40);

  const body = join(
    p(c.hello(first), "strong"),
    p(c.intro(d.orderNumber)),
    ...(products.length === 1 ? [button(link(products[0].slug), c.cta)] : products.map((x) => button(link(x.slug), c.ctaOne(oneLine(x.name))))),
    p(c.howto, "small"),
  );
  const subject = oneLine(c.subject(d.orderNumber));
  const html = renderLayout({
    locale: d.locale,
    title: subject,
    preheader: c.preheader,
    eyebrow: c.eyebrow,
    heading: c.heading,
    body,
    footer: [...c.footer],
    logoUrl: `${site}/email/logo-light.png`,
  });
  const text = [
    c.hello(first),
    c.intro(d.orderNumber),
    products.map((x) => `${oneLine(x.name)}${d.locale === "fr" ? " :" : ":"} ${link(x.slug)}`).join("\n"),
    c.howto,
  ].join("\n\n");
  return { subject, preheader: c.preheader, html, text };
}
