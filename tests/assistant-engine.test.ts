import { describe, expect, it } from "vitest";
import demoCatalog from "@/lib/demo/catalog.json";
import demoKb from "@/lib/demo/kb.json";
import { plan } from "@/lib/assistant/engine";
import { detectEscalation } from "@/lib/assistant/escalation";
import { retrieve } from "@/lib/assistant/retrieve";
import { expandSynonyms, parseBudget, tokens } from "@/lib/assistant/text";
import type { EngineInput, KbEntry } from "@/lib/assistant/types";
import { DEFAULT_SETTINGS } from "@/lib/catalog";
import type { Product } from "@/lib/catalog/types";
import { fmtXof } from "@/lib/money";

const products: Product[] = demoCatalog.products.map((p) => ({
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
  createdAt: p.createdAt,
  rating: { average: p.ratingSeed, count: p.ratingSeedCount },
}));
const categories = demoCatalog.categories.map((c) => ({ id: c.id, label: c.labelFr }));
const kbFr: KbEntry[] = demoKb.map((d) => ({ id: d.id, tag: d.tag, title: d.title, text: d.text, keywords: d.keywords }));
const kbEn: KbEntry[] = demoKb.map((d) => ({ id: d.id, tag: d.en!.tag, title: d.en!.title, text: d.en!.text, keywords: d.en!.keywords }));

function input(text: string, extra: Partial<EngineInput> = {}): EngineInput {
  return {
    lang: "fr",
    text,
    prevUser: "",
    products,
    categories,
    kb: kbFr,
    shop: { shipping: DEFAULT_SETTINGS.shipping, pay: DEFAULT_SETTINGS.pay, brand: DEFAULT_SETTINGS.brand },
    ...extra,
  };
}
const byId = (id: string) => products.find((p) => p.id === id)!;

describe("assistant — texte", () => {
  it("racines de 6 lettres et mots vides", () => {
    expect(tokens("Aidez-moi à choisir un produit")).toEqual([]);
    expect(tokens("raquette anti-moustiques")).toContain("raquet");
  });
  it("budget : formats courants, bornes", () => {
    expect(parseBudget("un cadeau à moins de 10 000 F")).toBe(10000);
    expect(parseBudget("max 5000 FCFA")).toBe(5000);
    expect(parseBudget("budget 10k")).toBe(10000);
    expect(parseBudget("livré avant 18 h")).toBeNull();
    expect(parseBudget("0197112233")).toBeNull();
  });
  it("synonymes bilingues", () => {
    expect(expandSynonyms("contre les coupures de courant")).toContain("lampe");
    expect(expandSynonyms("power cut")).toContain("batterie");
  });
});

describe("assistant — escalade (avant tout LLM)", () => {
  it.each([
    ["Je veux être remboursé de ma commande", "refund"],
    ["rembourse-moi tout de suite", "refund"],
    ["c'est une arnaque, je vais porter plainte", "refund"],
    ["I want a refund for my order", "refund"],
    ["Je suis allergique, est-ce dangereux ?", "health"],
    ["it gave me a burn on my hand", "health"],
    ["Est-ce légal de revendre ?", "legal"],
    ["I want to delete my data (GDPR)", "legal"],
  ])("%s -> %s", (text, kind) => {
    expect(detectEscalation(text)).toBe(kind);
  });
  it("une question de politique de retour n'escalade pas", () => {
    expect(detectEscalation("Quelle est votre politique de retour ?")).toBeNull();
    expect(detectEscalation("Un cadeau à moins de 10 000 F")).toBeNull();
    expect(detectEscalation("Délais de livraison ?")).toBeNull();
  });
});

describe("assistant — moteur déterministe", () => {
  it("recommande des produits réels en stock, budget respecté", () => {
    const p = plan(input("Un cadeau à moins de 10 000 F"));
    expect(p.intent).toBe("products");
    expect(p.productIds.length).toBeGreaterThan(0);
    expect(p.productIds.length).toBeLessThanOrEqual(3);
    for (const id of p.productIds) {
      expect(byId(id).stock).toBeGreaterThan(0);
      expect(byId(id).price).toBeLessThanOrEqual(10000);
    }
    expect(p.llm).toBe("intro");
  });

  it("coupures de courant -> lampe ou batterie", () => {
    const p = plan(input("Contre les coupures de courant"));
    expect(p.intent).toBe("products");
    expect(p.productIds.some((id) => ["lampe", "batterie"].includes(id))).toBe(true);
  });

  it("ne propose jamais un produit épuisé", () => {
    const soldOut = products.map((x) => (x.id === "lampe" ? { ...x, stock: 0 } : x));
    const p = plan(input("une lampe", { products: soldOut }));
    expect(p.productIds).not.toContain("lampe");
  });

  it("requête vague -> question de précision, aucun produit", () => {
    const p = plan(input("Aidez-moi à choisir un produit"));
    expect(p.intent).toBe("ask");
    expect(p.productIds).toEqual([]);
    expect(p.llm).toBe("question");
  });

  it("aucun produit à ce budget", () => {
    const p = plan(input("un cadeau à moins de 600 F"));
    expect(p.productIds).toEqual([]);
    expect(p.text).toMatch(/rien en stock/);
  });

  it("livraison : chiffres des réglages, pas de texte figé", () => {
    const shipping = { ...DEFAULT_SETTINGS.shipping, cotonou: 1500, freeFrom: 20000 };
    const p = plan(input("Délais de livraison ?", { shop: { shipping, pay: DEFAULT_SETTINGS.pay, brand: DEFAULT_SETTINGS.brand } }));
    expect(p.intent).toBe("kb");
    expect(p.text).toContain(fmtXof(1500));
    expect(p.text).toContain(fmtXof(20000));
    expect(p.llm).toBe("none");
  });

  it("paiement : suit les moyens activés", () => {
    const pay = { ...DEFAULT_SETTINGS.pay, cod: false, carte: false };
    const p = plan(input("Comment puis-je payer ?", { shop: { shipping: DEFAULT_SETTINGS.shipping, pay, brand: DEFAULT_SETTINGS.brand } }));
    expect(p.text).toMatch(/MoMo/);
    expect(p.text).not.toMatch(/carte bancaire|livraison/);
  });

  it("numéro de commande -> page de suivi, aucune consultation", () => {
    const p = plan(input("Où en est ma commande WX-10258 ?"));
    expect(p.intent).toBe("order");
    expect(p.actions.some((a) => a.href === "/suivi")).toBe(true);
    expect(p.productIds).toEqual([]);
  });

  it("question depuis une fiche : description du catalogue, produit affiché", () => {
    const name = byId("blender").name;
    const p = plan(input(`J'ai une question sur « ${name} » : est-ce qu'il me conviendra ?`));
    expect(["productInfo", "kb"]).toContain(p.intent);
    expect(p.productIds).toContain("blender");
  });

  it("produit épuisé nommé : alternatives du même rayon en stock", () => {
    const soldOut = products.map((x) => (x.id === "blender" ? { ...x, stock: 0 } : x));
    const p = plan(input(`Avez-vous « ${byId("blender").name} » ?`, { products: soldOut }));
    expect(p.intent).toBe("productInfo");
    expect(p.productIds).not.toContain("blender");
    for (const id of p.productIds) expect(byId(id).categoryId).toBe("cuisine");
  });

  it("anglais : réponses et recherche", () => {
    const g = plan(input("A gift under 10,000 F", { lang: "en", kb: kbEn }));
    expect(g.intent).toBe("products");
    expect(g.text).toMatch(/Here/);
    const d = plan(input("How long does delivery take?", { lang: "en", kb: kbEn }));
    expect(d.text).toMatch(/Next-day delivery/);
    const c = plan(input("Against power cuts", { lang: "en", kb: kbEn }));
    expect(c.productIds.some((id) => ["lampe", "batterie"].includes(id))).toBe(true);
  });

  it("merci / bonjour : réponse courte sans produit", () => {
    expect(plan(input("Merci beaucoup")).intent).toBe("chat");
    expect(plan(input("Bonjour")).intent).toBe("chat");
  });

  it("BM25 : un mot rare du catalogue classe le bon produit en tête", () => {
    const docs = products.map((p) => ({ id: p.id, title: p.name, keywords: p.keyword, text: p.description }));
    expect(retrieve("tondeuse barbe", docs, 3)[0]?.id).toBe("tondeuse");
  });
});
