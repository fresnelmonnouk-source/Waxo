// Base de connaissances réelle (migration 0021, brief RAG du 2026-10-13) : forme des fiches, faits interdits, et
// recherche (les questions courantes tombent sur la bonne fiche avec le moteur réel).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import demoCatalog from "@/lib/demo/catalog.json";
import { plan } from "@/lib/assistant/engine";
import { retrieve } from "@/lib/assistant/retrieve";
import { expandSynonyms } from "@/lib/assistant/text";
import type { KbEntry } from "@/lib/assistant/types";
import { DEFAULT_SETTINGS } from "@/lib/catalog";
import { KB_TAGS } from "@/lib/settings/kb-search";
import { KB_LEGACY_IDS } from "@/lib/assistant/kb";

const sql = readFileSync(new URL("../supabase/migrations/0021_kb_seed.sql", import.meta.url), "utf8");
const str = "'((?:[^']|'')*)'";
const ROW = new RegExp(`\\(${str}, ${str}, ${str}, ${str}, ${str}, true\\)`, "g");
const unq = (s: string) => s.replace(/''/g, "'");
const rows = [...sql.matchAll(ROW)].map((m) => ({ id: m[1], tag: unq(m[2]), title: unq(m[3]), text: unq(m[4]), keywords: unq(m[5]) }));
/** Comme loadKb : identifiants historiques pour les fiches reconnues par le moteur. */
const kb: KbEntry[] = rows.map((r) => ({ ...r, id: KB_LEGACY_IDS[r.id] ?? r.id }));
const byTitle = (title: string) => rows.find((r) => r.title === title)!;
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

describe("0021_kb_seed : forme", () => {
  it("17 fiches, UUID fixes uniques, rejouable", () => {
    expect(rows).toHaveLength(17);
    expect(new Set(rows.map((r) => r.id)).size).toBe(17);
    for (const r of rows) expect(r.id).toMatch(/^5eed0000-0000-4000-8000-\d{12}$/);
    expect(sql).toMatch(/on conflict \(id\) do update set/);
    expect(sql).not.toMatch(/active = excluded\.active/); // une fiche désactivée dans l'admin le reste
    expect(sql).not.toContain("\r");
  });
  it("thèmes de l'admin, 80 à 160 mots, mots-clés fournis", () => {
    for (const r of rows) {
      expect(KB_TAGS as readonly string[]).toContain(r.tag);
      expect(words(r.text), r.title).toBeGreaterThanOrEqual(80);
      expect(words(r.text), r.title).toBeLessThanOrEqual(160);
      expect(words(r.keywords), r.title).toBeGreaterThanOrEqual(10);
    }
  });
  it("les fiches reconnues par le moteur existent dans la migration", () => {
    for (const id of Object.keys(KB_LEGACY_IDS)) expect(rows.map((r) => r.id)).toContain(id);
  });
  it("aucun numéro en dur, aucun tiret cadratin, carte jamais annoncée comme acceptée, horaires réels", () => {
    const all = rows.map((r) => `${r.title} ${r.text}`).join("\n");
    expect(all).not.toMatch(/\+?229|\b01 ?\d{2} ?\d{2} ?\d{2}/);
    expect(all).not.toContain("—");
    expect(all).not.toMatch(/\bVisa\b|Mastercard|carte bancaire (Visa|accept)/);
    expect(all).not.toMatch(/lundi au samedi|19 h/);
    expect(byTitle("Horaires et contact").text).toMatch(/7 j\/7, de 8 h à 20 h/);
    expect(byTitle("Horaires et contact").text).toMatch(/numéro WhatsApp affiché en bas du site/);
    expect(byTitle("Moyens de paiement").text).toMatch(/carte bancaire n'est pas proposé/);
  });
  it("retours : renvoi à la charge du client hors Cotonou/Calavi, sauf défaut ou erreur (à nos frais)", () => {
    expect(byTitle("Retours et échanges").text).toMatch(/Ailleurs au Bénin.*frais de renvoi sont à votre charge/);
    expect(byTitle("Produit défectueux ou erreur de commande").text).toMatch(/frais de retour sont à notre charge/);
  });
  it("livraison offerte : zone Cotonou/Calavi seulement", () => {
    expect(byTitle("Frais de livraison et livraison offerte").text).toMatch(/livraison offerte ne concerne que la zone Cotonou et Calavi/);
  });
});

describe("0021_kb_seed : recherche", () => {
  const top = (q: string) => (retrieve(expandSynonyms(q), kb, 1)[0] as KbEntry | undefined)?.title;
  it.each([
    ["Combien coûte la livraison ?", "Frais de livraison et livraison offerte"],
    ["La livraison est gratuite à partir de combien ?", "Frais de livraison et livraison offerte"],
    ["Je peux payer avec momo ?", "Moyens de paiement"],
    ["Vous acceptez la carte visa ?", "Moyens de paiement"],
    ["On m'a demandé mon code secret au téléphone", "Paiement sécurisé et code secret"],
    ["Je veux échanger un article, il ne me plaît plus", "Retours et échanges"],
    ["Le produit reçu est cassé", "Produit défectueux ou erreur de commande"],
    ["Vous êtes joignables à quelle heure ?", "Horaires et contact"],
    ["C'est quoi un pack ?", "Les packs"],
    ["Avez-vous un code promo ?", "Promotions et campagnes"],
    ["Comment laisser un avis ?", "Avis clients"],
    ["Que veut dire Wá xɔ ?", "Qui sommes-nous"],
    ["Je n'ai pas de compte, je peux commander ?", "Commander avec ou sans compte"],
    ["Comment annuler ma commande ?", "Modifier ou annuler une commande"],
    ["Où est ma commande, je veux suivre le colis", "Suivre sa commande"],
    ["Si je commande ce soir après 20h je suis livré quand ?", "Livraison Express et heure limite"],
    ["Le livreur va m'appeler avant de venir ?", "Le jour de la livraison"],
    ["À quelle heure je serai livré à Cotonou ?", "Livraison Express et heure limite"],
    ["Vous livrez à Parakou ?", "Zones et délais de livraison"],
    ["Qui voit mes informations, vous les revendez ?", "Confidentialité et vos informations"],
  ])("« %s » → %s", (q, title) => {
    expect(top(q)).toBe(title);
  });

  it("moteur : question de livraison → réponse reconstruite avec les réglages (pas le texte figé)", () => {
    const products = demoCatalog.products.map((p) => ({
      id: p.id,
      slug: p.fr.slug,
      name: p.fr.name,
      description: p.fr.description,
      categoryId: p.categoryId,
      price: p.price,
      comparePrice: p.comparePrice,
      stock: p.stock,
      sold: p.sold,
      keyword: p.keyword,
      bg: p.bg,
      imageUrl: p.imageUrl,
      images: p.imageUrl ? [p.imageUrl] : [],
      createdAt: p.createdAt,
      rating: { average: p.ratingSeed, count: p.ratingSeedCount },
    }));
    const shipping = { ...DEFAULT_SETTINGS.shipping, cotonou: 1500 };
    const p = plan({
      lang: "fr",
      text: "Vous livrez à Parakou ?",
      prevUser: "",
      products,
      categories: [],
      kb,
      shop: { shipping, pay: DEFAULT_SETTINGS.pay, brand: DEFAULT_SETTINGS.brand },
    });
    expect(p.intent).toBe("kb");
    expect(p.llm).toBe("none");
    expect(p.text).toMatch(/1\s?500/);
    expect(p.actions.some((a) => a.href === "/livraison-retours")).toBe(true);
  });
});
