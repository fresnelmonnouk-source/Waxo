import { fmtXof } from "@/lib/money";
import type { Product } from "@/lib/catalog/types";
import { reply } from "./i18n";
import { retrieve, type Doc, type Hit } from "./retrieve";
import { expandSynonyms, firstSentences, norm, parseBudget, tokens } from "./text";
import type { AssistantAction, EngineInput, KbEntry, Plan } from "./types";

/**
 * Moteur déterministe de l'assistant (aucun appel réseau). Choisit l'intention, les produits (recherche BM25 sur le
 * catalogue réel, stock > 0, budget respecté) et une réponse complète. Le LLM, s'il est configuré, ne remplace que la
 * phrase d'accompagnement : il ne choisit, ne nomme ni ne chiffre jamais un produit.
 */

const MAX_PRODUCTS = 3;
const KB_MIN_SCORE = 2;
const SOURCE_MIN_SCORE = 1.5;

const RE_ORDER = /WX-?\s?(\d{4,6})/i;
const RE_DELIVERY = /\b(livr|delai|quand|ville|parakou|porto|deliver|shipping|ship\b|how long|when will|city)/;
const RE_PAYMENT = /\b(paie|payer|momo|moov|celtiis|carte|pay\b|payment|card|cash)/;
const RE_RETURNS = /\b(retour|rembours|echange|return|refund|exchange)/;
const RE_GIFT = /\b(cadeau|offrir|gift|present)/;
const RE_THANKS = /^(merci|thanks|thank you|ok|d accord|parfait|super|great|perfect)\b/;
const RE_HELLO = /^(bonjour|bonsoir|salut|coucou|hello|hi|hey)\b/;
const RE_THIS_PRODUCT = /\b(ce produit|cet article|celui ci|celui-ci|this product|this item|this one)\b/;

type ProductDoc = Doc & { productId: string };

function page(lang: EngineInput["lang"], key: "actContact" | "actFaq" | "actDelivery" | "actTrack" | "actCgv" | "actCatalogue", href: string): AssistantAction {
  return { kind: "page", label: reply(lang, key), href };
}

function empty(intent: Plan["intent"], text: string, extra: Partial<Plan> = {}): Plan {
  return { intent, text, productIds: [], sources: [], actions: [], facts: "", llm: "none", budget: null, ...extra };
}

function methodsList(input: EngineInput): string {
  const { lang, shop } = input;
  const names: string[] = [];
  if (shop.pay.momo) names.push(reply(lang, "payMomo"));
  if (shop.pay.moov) names.push(reply(lang, "payMoov"));
  if (shop.pay.celtiis) names.push(reply(lang, "payCeltiis"));
  if (shop.pay.carte) names.push(reply(lang, "payCarte"));
  if (shop.pay.cod) names.push(reply(lang, "payCod"));
  if (names.length <= 1) return names.join("");
  const last = names[names.length - 1];
  return `${names.slice(0, -1).join(", ")} ${reply(lang, "or")} ${last}`;
}

function deliveryText(input: EngineInput): string {
  const s = input.shop.shipping;
  return reply(input.lang, "delivery", {
    cutoff: s.cutoff,
    cotonou: fmtXof(s.cotonou),
    free: fmtXof(s.freeFrom),
    autre: fmtXof(s.autre),
  });
}
const paymentText = (input: EngineInput) => reply(input.lang, "payment", { methods: methodsList(input) });
const returnsText = (input: EngineInput) => reply(input.lang, "returns", { days: input.shop.shipping.returnDays });

function productDocs(input: EngineInput): ProductDoc[] {
  const labels = new Map(input.categories.map((c) => [c.id, c.label]));
  return input.products.map((p) => ({
    id: `p:${p.id}`,
    productId: p.id,
    title: p.name,
    keywords: `${p.keyword} ${labels.get(p.categoryId) ?? ""} ${p.categoryId}`,
    text: p.description,
  }));
}

/** Produit cité par son nom complet dans le message (ex. question lancée depuis sa fiche). */
function mentionedProduct(input: EngineInput, nq: string): Product | null {
  const found = input.products
    .filter((p) => norm(p.name).length >= 4 && nq.includes(norm(p.name)))
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (found) return found;
  if (input.currentSlug && RE_THIS_PRODUCT.test(nq)) return input.products.find((p) => p.slug === input.currentSlug) ?? null;
  return null;
}

/** Extraits de la base dont le texte contient des chiffres de boutique : on préfère les valeurs des réglages. */
function kbOverride(input: EngineInput, id: string): string | null {
  if (id === "kb1") return deliveryText(input);
  if (id === "kb3") return paymentText(input);
  if (id === "kb4") return returnsText(input);
  return null;
}

function categoryActions(input: EngineInput, products: Product[]): AssistantAction[] {
  const top = products[0];
  if (!top) return [];
  const label = input.categories.find((c) => c.id === top.categoryId)?.label;
  if (!label) return [];
  return [{ kind: "page", label: reply(input.lang, "actCategory", { name: label }), href: `/catalogue?cat=${encodeURIComponent(top.categoryId)}` }];
}

export function plan(input: EngineInput): Plan {
  const { lang } = input;
  const text = input.text.trim();
  const nq = norm(text).replace(/[’']/g, " ");

  // 1. Numéro de commande : jamais de consultation ici, renvoi vers la page de suivi (anti-énumération).
  if (RE_ORDER.test(text)) {
    return empty("order", reply(lang, "order"), { actions: [page(lang, "actTrack", "/suivi"), page(lang, "actContact", "/contact")] });
  }

  // 2. Remerciements / salutations seuls.
  const words = nq.split(/\s+/).filter(Boolean);
  if (words.length <= 4 && RE_THANKS.test(nq)) return empty("chat", reply(lang, "thanks"));
  if (words.length <= 4 && RE_HELLO.test(nq) && tokens(text).length === 0) return empty("chat", reply(lang, "hello"));

  const budget = parseBudget(text);
  const mention = mentionedProduct(input, nq);

  // 3. Base de connaissances + catalogue : le meilleur extrait gagne s'il est assez pertinent (comme la maquette).
  const meaningful = tokens(text).length;
  const query = meaningful < 2 && input.prevUser ? `${text} ${input.prevUser}` : text;
  const kbDocs: (Doc & { kb: KbEntry })[] = input.kb.map((k) => ({ id: `kb:${k.id}`, title: k.title, keywords: k.keywords, text: k.text, kb: k }));
  const pDocs = productDocs(input);
  const expanded = expandSynonyms(query);
  const hits = retrieve(expanded, [...kbDocs, ...pDocs] as Doc[], 4) as Hit<Doc & { kb?: KbEntry }>[];
  const kbHits = hits.filter((h) => h.kb);
  const top = hits[0];
  // Requête d'usage (« coupures de courant », « power cuts »…) : un extrait ne l'emporte sur les produits que s'il est nettement meilleur.
  const bestProduct = hits.find((h) => !h.kb)?.score ?? 0;
  const kbWins = !!top?.kb && top.score > KB_MIN_SCORE && (expanded === query || top.score >= bestProduct * 1.5);
  if (top?.kb && kbWins) {
    const entry = top.kb;
    const override = kbOverride(input, entry.id);
    const answer = override ?? firstSentences(entry.text, 2);
    const sources = kbHits.filter((h) => h.score > SOURCE_MIN_SCORE).slice(0, 2).map((h) => h.kb!.title);
    const facts = kbHits
      .slice(0, 3)
      .map((h) => `${h.kb!.title} : ${h.kb!.text}`)
      .join("\n");
    const actions: AssistantAction[] = [];
    if (entry.id === "kb1" || entry.id === "kb4" || entry.id === "kb5") actions.push(page(lang, "actDelivery", "/livraison-retours"));
    return {
      intent: "kb",
      text: answer,
      productIds: mention ? [mention.id] : [],
      sources,
      actions,
      // Si le texte vient des réglages (override), le LLM ne reformule pas : les chiffres des réglages priment.
      facts,
      llm: override ? "none" : "rephrase",
      budget,
    };
  }

  // 4. Produit nommé : description du catalogue (ou alternatives s'il est épuisé).
  if (mention) {
    if (mention.stock <= 0) {
      const alt = input.products
        .filter((p) => p.id !== mention.id && p.stock > 0 && p.categoryId === mention.categoryId)
        .sort((a, b) => b.sold - a.sold)
        .slice(0, MAX_PRODUCTS);
      return empty("productInfo", reply(lang, "productOut", { name: mention.name }), { productIds: alt.map((p) => p.id), actions: categoryActions(input, alt) });
    }
    return empty("productInfo", reply(lang, "productInfo", { desc: mention.description }), { productIds: [mention.id], budget });
  }

  // 5. Questions pratiques fréquentes, avec les valeurs des réglages.
  if (RE_DELIVERY.test(nq)) {
    return empty("delivery", deliveryText(input), { actions: [page(lang, "actDelivery", "/livraison-retours")] });
  }
  if (RE_PAYMENT.test(nq)) return empty("payment", paymentText(input), { actions: [page(lang, "actFaq", "/faq")] });
  if (RE_RETURNS.test(nq)) {
    return empty("returns", returnsText(input), { actions: [page(lang, "actDelivery", "/livraison-retours")] });
  }

  // 6. Recommandation de produits (déterministe) : stock > 0, budget respecté.
  const inStock = input.products.filter((p) => p.stock > 0);
  const pool = budget ? inStock.filter((p) => p.price <= budget) : inStock;
  const byId = new Map(pool.map((p) => [p.id, p]));
  const productHits = retrieve(expanded, pDocs, 12)
    .map((h) => ({ product: byId.get(h.productId), score: h.score }))
    .filter((h): h is { product: Product; score: number } => !!h.product)
    .sort((a, b) => b.score - a.score || b.product.sold - a.product.sold);
  let picks = productHits.map((h) => h.product);
  let textKey: "products" | "productsBudget" | "productsGift" = "products";
  if (!picks.length && RE_GIFT.test(nq)) {
    picks = [...pool].filter((p) => p.rating.average >= 4.6).sort((a, b) => b.rating.average - a.rating.average || b.sold - a.sold);
    textKey = "productsGift";
  }
  if (!picks.length && budget && meaningful <= 1) {
    picks = [...pool].sort((a, b) => b.sold - a.sold);
    textKey = "productsBudget";
  }
  picks = picks.slice(0, MAX_PRODUCTS);
  if (picks.length) {
    return {
      intent: "products",
      text: reply(lang, textKey),
      productIds: picks.map((p) => p.id),
      sources: [],
      actions: categoryActions(input, picks),
      facts: "",
      llm: "intro",
      budget,
    };
  }
  if (budget && inStock.length && !pool.length) return empty("ask", reply(lang, "noneBudget"), { budget, llm: "question" });
  return empty("ask", reply(lang, "ask"), { budget, llm: "question", actions: [page(lang, "actFaq", "/faq")] });
}
