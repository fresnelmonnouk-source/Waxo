import "server-only";
import accountFr from "@/messages/fr/account.json";
import commonFr from "@/messages/fr/common.json";
import consentFr from "@/messages/fr/consent.json";
import productFr from "@/messages/fr/product.json";
import seoFr from "@/messages/fr/seo.json";
import shopFr from "@/messages/fr/shop.json";
import { getLiveCampaigns } from "@/lib/campaigns/data";
import { campaignStatus, type Campaign } from "@/lib/campaigns/logic";
import { getCategories, getProducts, getSettings, type Product, type ShopSettings } from "@/lib/catalog";
import { fmtXof } from "@/lib/money";
import { getLegalSettings, getPage } from "@/lib/pages";
import { LEGAL_FIELDS, PAY_LABELS, PAY_IDS } from "@/lib/settings/schema";
import { PAGE_LABELS, PAGE_SLUGS, type LegalSettings } from "@/lib/pages/types";
import { onlinePayAvailable } from "@/lib/payment/ready";
import { kbStateOf, listKbAdmin, KB_STATE_LABEL, type AdminKbRow } from "./kb-admin";
import { scrubText } from "./scrub";

/**
 * Corpus envoyé à DeepSeek par l'IA de l'admin. Construit sur LISTE BLANCHE, sans aucune donnée personnelle :
 *  - réglages publics (livraison, paiement, horaires, marque), coordonnées et mentions légales réduites à « renseigné / vide » ;
 *  - pages d'infos (titre + markdown), textes publics clés (FAQ, garanties de l'accueil, titres et descriptions Google) ;
 *  - produits actifs (nom, prix, stock, rayon, description courte), campagnes actives, fiches de la base de connaissances.
 * Jamais : commandes, clients, messages, avis (noms d'auteurs), clés de paiement (`settings.payments`, non public).
 * Tout le texte passe ensuite par `scrubText` (e-mails, numéros, secrets masqués) et est borné en taille.
 */

export type CorpusSources = {
  settings: ShopSettings | null;
  onlinePay: boolean | null;
  legal: LegalSettings | null;
  pages: { slug: string; label: string; title: string; body: string; source: "db" | "default" }[];
  products: (Pick<Product, "name" | "price" | "comparePrice" | "stock" | "description"> & { category: string })[];
  campaigns: Campaign[];
  kb: AdminKbRow[];
};

export type CorpusSection = { name: string; chars: number; truncated: boolean };
export type Corpus = { text: string; chars: number; truncated: boolean; sections: CorpusSection[] };

/** Budgets en caractères (≈ 3,5 caractères par jeton en français). */
export const CORPUS_BUDGET = 60_000;
const SECTION_BUDGET = { reglages: 3_000, textes: 9_000, pages: 22_000, produits: 12_000, campagnes: 2_000, kb: 14_000 } as const;
const PAGE_MAX = 4_500;
const PRODUCT_DESC_MAX = 160;
const KB_TEXT_MAX = 900;
const TRUNC = "[… tronqué]";

const yes = (b: boolean) => (b ? "oui" : "non");
const one = (s: string) => s.replace(/\s+/g, " ").trim();
/** Balises riches des messages (`<contact>Écrivez-nous</contact>`) → texte seul. */
const stripTags = (s: string) => s.replace(/<\/?[a-zA-Z][^>]*>/g, "");
const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, Math.max(0, max - TRUNC.length - 1)).trimEnd()} ${TRUNC}` : s);
const dateFr = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "date inconnue" : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Porto-Novo" });
};

/** Coupe un bloc à la dernière fin de ligne sous le budget (jamais au milieu d'une ligne). */
export function fitBlock(text: string, budget: number): { text: string; truncated: boolean } {
  if (text.length <= budget) return { text, truncated: false };
  const room = Math.max(0, budget - TRUNC.length - 1);
  const head = text.slice(0, room);
  const nl = head.lastIndexOf("\n");
  return { text: `${(nl > room * 0.5 ? head.slice(0, nl) : head).trimEnd()}\n${TRUNC}`, truncated: true };
}

function settingsBlock(s: CorpusSources): string {
  const lines: string[] = [];
  const st = s.settings;
  if (!st) return "Réglages indisponibles pour le moment.";
  lines.push(`Nom de la boutique : ${st.brand.shopName || "(vide)"}`);
  lines.push(`Horaires de l'équipe : ${st.brand.hours || "(vide)"}`);
  lines.push(`Numéro WhatsApp de la boutique renseigné : ${yes(!!st.brand.whatsapp)}. E-mail de contact renseigné : ${yes(!!st.brand.email)}.`);
  lines.push(`Livraison zone Cotonou/Abomey-Calavi : ${fmtXof(st.shipping.cotonou)}. Autres villes du Bénin : ${fmtXof(st.shipping.autre)}.`);
  lines.push(`Livraison offerte dès ${fmtXof(st.shipping.freeFrom)} d'achat, dans la zone Cotonou/Abomey-Calavi seulement.`);
  lines.push(`Heure limite Livraison Express (livré le jour même avant, sinon le lendemain, 7 j/7) : ${st.shipping.cutoff} h.`);
  lines.push(`Délai de retour : ${st.shipping.returnDays} jours après réception.`);
  lines.push(`Moyens de paiement cochés : ${PAY_IDS.map((id) => `${PAY_LABELS[id]} ${yes(st.pay[id])}`).join(", ")}.`);
  if (s.onlinePay !== null) lines.push(`Paiement en ligne (Mobile Money / carte) réellement proposé au client aujourd'hui : ${yes(s.onlinePay)}.`);
  lines.push(`Packs en vente : ${yes(st.features.packs)}.`);
  if (s.legal) {
    const filled = LEGAL_FIELDS.filter((f) => s.legal![f.key]?.trim()).map((f) => f.label);
    const empty = LEGAL_FIELDS.filter((f) => !s.legal![f.key]?.trim()).map((f) => f.label);
    lines.push(`Mentions légales renseignées : ${filled.join(", ") || "aucune"}. Vides : ${empty.join(", ") || "aucune"}.`);
  }
  return lines.join("\n");
}

function textsBlock(): string {
  const faq = accountFr.Faq as Record<string, string>;
  const home = shopFr.Home as Record<string, unknown>;
  const pick = (o: Record<string, unknown>, k: string) => (typeof o[k] === "string" ? one(stripTags(o[k] as string)) : "");
  const lines: string[] = ["FAQ :"];
  for (let i = 1; i <= 20; i++) {
    if (!faq[`q${i}`]) continue;
    lines.push(`- Q : ${one(stripTags(faq[`q${i}`]))}`);
    lines.push(`  R : ${one(stripTags(faq[`a${i}`] ?? ""))}`);
  }
  if (faq.cod) lines.push(`  (ajout quand le paiement à la livraison est actif : « ${one(faq.cod)} »)`);
  lines.push("Accueil :");
  for (const k of ["title", "lead", "payCod", "payNoCod", "g1Title", "g1Sub", "g2Title", "g2Sub", "g2CodTitle", "g2CodSub", "g3Title", "g3Sub", "g4Title", "g4Sub"]) {
    const v = pick(home, k);
    if (v) lines.push(`- ${k} : ${v}`);
  }
  const product = productFr.Product as Record<string, unknown>;
  lines.push("Fiche produit :");
  for (const k of ["payAll", "payNoCod", "payCodOnly", "returns", "conditions"]) {
    const v = pick(product, k);
    if (v) lines.push(`- ${k} : ${v}`);
  }
  const express = (commonFr as Record<string, unknown>).Express as Record<string, unknown> | undefined;
  if (express) {
    lines.push("Bandeau Livraison Express :");
    for (const k of Object.keys(express)) {
      const v = pick(express, k);
      if (v) lines.push(`- ${k} : ${v}`);
    }
  }
  lines.push("Titres et descriptions Google :");
  const seo = consentFr.Seo as Record<string, string>;
  lines.push(`- site : ${one(seo.siteName)} | ${one(seo.description)}`);
  for (const [k, v] of Object.entries(seoFr.SeoPages as Record<string, unknown>)) {
    if (v && typeof v === "object" && "title" in v) {
      const o = v as Record<string, unknown>;
      const desc = one(String(o.description ?? ""));
      lines.push(`- ${k} : ${one(String(o.title ?? ""))}${desc ? ` | ${desc}` : ""}`);
    }
  }
  return lines.join("\n");
}

function pagesBlock(s: CorpusSources): string {
  if (!s.pages.length) return "Aucune page lue.";
  return s.pages
    .map((p) => `### ${p.label} (/${p.slug})${p.source === "default" ? " [texte par défaut, jamais modifié]" : ""}\nTitre : ${one(p.title)}\n${cut(p.body.trim(), PAGE_MAX)}`)
    .join("\n\n");
}

function productsBlock(s: CorpusSources): string {
  if (!s.products.length) return "Aucun produit actif.";
  return s.products
    .map((p) => {
      const price = `${fmtXof(p.price)}${p.comparePrice ? ` (au lieu de ${fmtXof(p.comparePrice)})` : ""}`;
      return `- ${one(p.name)} | ${p.category || "sans rayon"} | ${price} | stock ${p.stock} | ${cut(one(p.description), PRODUCT_DESC_MAX)}`;
    })
    .join("\n");
}

function campaignsBlock(s: CorpusSources, now: number): string {
  if (!s.campaigns.length) return "Aucune campagne active.";
  return s.campaigns
    .map((c) => {
      const st = campaignStatus(c, now);
      return `- ${one(c.nameFr)}${c.taglineFr ? ` : ${one(c.taglineFr)}` : ""} | ${st === "running" ? "en cours" : st === "upcoming" ? "à venir" : "terminée"} | du ${dateFr(c.startsAt)} au ${dateFr(c.endsAt)} | ${c.items.length} produit(s)`;
    })
    .join("\n");
}

function kbBlock(s: CorpusSources): string {
  if (!s.kb.length) return "Aucune fiche.";
  return s.kb.map((k) => `- [${KB_STATE_LABEL[kbStateOf(k)]}] (${k.tag}) ${one(k.title)} : ${cut(one(k.text), KB_TEXT_MAX)}`).join("\n");
}

/** Assemble le corpus (pur, testable) : sections bornées, masquage, budget global. */
export function buildCorpus(src: CorpusSources, opts: { budget?: number; now?: number } = {}): Corpus {
  const budget = opts.budget ?? CORPUS_BUDGET;
  const now = opts.now ?? Date.now();
  const parts: [keyof typeof SECTION_BUDGET, string, string][] = [
    ["reglages", "RÉGLAGES DE LA BOUTIQUE (source de vérité)", settingsBlock(src)],
    ["textes", "TEXTES PUBLICS DU SITE ({cutoff}, {hour}, {cotonou}… sont remplacés par les réglages à l'affichage)", textsBlock()],
    ["kb", "BASE DE CONNAISSANCES DE L'ASSISTANT", kbBlock(src)],
    ["pages", "PAGES D'INFOS (markdown ; les marqueurs {{…}} sont remplacés par les réglages à l'affichage)", pagesBlock(src)],
    ["produits", `PRODUITS ACTIFS (${src.products.length})`, productsBlock(src)],
    ["campagnes", "CAMPAGNES PROMOTIONNELLES ACTIVES", campaignsBlock(src, now)],
  ];
  const sections: CorpusSection[] = [];
  const chunks: string[] = [];
  let used = 0;
  for (const [key, title, body] of parts) {
    const room = Math.max(0, Math.min(SECTION_BUDGET[key], budget - used - title.length - 8));
    const fitted = fitBlock(scrubText(body), room);
    const chunk = `## ${title}\n${fitted.text}`;
    chunks.push(chunk);
    used += chunk.length + 2;
    sections.push({ name: key, chars: fitted.text.length, truncated: fitted.truncated });
  }
  const text = chunks.join("\n\n");
  return { text, chars: text.length, truncated: sections.some((x) => x.truncated), sections };
}

async function safe<T>(p: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await p();
  } catch {
    return fallback;
  }
}

/** Lecture serveur des sources publiques (jamais d'exception : une source en panne est simplement absente). */
export async function loadCorpusSources(): Promise<CorpusSources> {
  const [settings, legal, pages, products, categories, campaigns, kb] = await Promise.all([
    safe(() => getSettings(), null),
    safe(() => getLegalSettings(), null),
    safe(() => Promise.all(PAGE_SLUGS.map((slug) => getPage(slug, "fr"))), []),
    safe(() => getProducts("fr"), [] as Product[]),
    safe(() => getCategories("fr"), []),
    safe(() => getLiveCampaigns(), [] as Campaign[]),
    safe(async () => (await listKbAdmin()).rows, [] as AdminKbRow[]),
  ]);
  const onlinePay = settings ? await safe(() => onlinePayAvailable(settings.pay), null) : null;
  const cat = new Map(categories.map((c) => [c.id, c.label]));
  return {
    settings,
    onlinePay,
    legal,
    pages: pages.map((p) => ({ slug: p.slug, label: PAGE_LABELS[p.slug], title: p.title, body: p.body, source: p.source })),
    products: products.slice(0, 150).map((p) => ({
      name: p.name,
      price: p.price,
      comparePrice: p.comparePrice,
      stock: p.stock,
      description: p.description,
      category: cat.get(p.categoryId) ?? "",
    })),
    campaigns,
    kb,
  };
}

export async function loadCorpus(opts: { budget?: number } = {}): Promise<Corpus> {
  return buildCorpus(await loadCorpusSources(), opts);
}
