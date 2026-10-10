import "server-only";
import { getCategories, getProducts, getSettings } from "@/lib/catalog";
import type { Product } from "@/lib/catalog/types";
import { plan } from "./engine";
import { detectEscalation, type EscalationKind } from "./escalation";
import { validateLlmText } from "./guard";
import { reply } from "./i18n";
import { loadKb } from "./kb";
import { callLlm, llmConfigured } from "./llm";
import { buildSystemPrompt } from "./prompt";
import { normalizeMessages, type AssistantRequest } from "./schema";
import { numbersIn } from "./text";
import type { AssistantAction, AssistantReply, CardProduct, Lang } from "./types";

const ESC_KEY = { refund: "escRefund", health: "escHealth", legal: "escLegal" } as const;

export function toCard(p: Product): CardProduct {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    price: p.price,
    comparePrice: p.comparePrice,
    stock: p.stock,
    bg: p.bg,
    imageUrl: p.imageUrl,
  };
}

function escalationActions(lang: Lang, kind: EscalationKind, waNumber: string): AssistantAction[] {
  const digits = waNumber.replace(/\D/g, "").slice(0, 15);
  const actions: AssistantAction[] = [];
  if (digits.length >= 8) actions.push({ kind: "whatsapp", label: reply(lang, "actWhatsapp"), href: `https://wa.me/${digits}` });
  actions.push({ kind: "page", label: reply(lang, "actContact"), href: "/contact" });
  if (kind === "legal") actions.push({ kind: "page", label: reply(lang, "actCgv"), href: "/cgv" });
  return actions;
}

/**
 * Cœur de POST /api/assistant. Ordre : filtre d'escalade (aucun appel LLM) → moteur déterministe → habillage par le
 * LLM seulement si une clé est présente ET si sa phrase passe le garde-fou. Ne lève pas d'exception de lecture :
 * le catalogue se replie lui-même sur la démo.
 */
export async function answer(req: AssistantRequest): Promise<AssistantReply> {
  const lang = req.lang;
  const messages = normalizeMessages(req.messages);
  const last = messages[messages.length - 1];
  if (!last) return { ok: true, text: reply(lang, "ask"), products: [], sources: [], actions: [], mode: "deterministic" };
  const userTexts = messages.filter((m) => m.role === "user").map((m) => m.text);
  const prevUser = userTexts.length > 1 ? userTexts[userTexts.length - 2] : "";

  const kind = detectEscalation(last.text);
  if (kind) {
    const settings = await getSettings();
    return {
      ok: true,
      text: reply(lang, ESC_KEY[kind]),
      products: [],
      sources: [],
      actions: escalationActions(lang, kind, settings.brand.waNumber),
      mode: "escalation",
    };
  }

  const [products, categories, settings, kb] = await Promise.all([getProducts(lang, { sort: "popular" }), getCategories(lang), getSettings(), loadKb(lang)]);
  const p = plan({
    lang,
    text: last.text,
    prevUser,
    products,
    categories: categories.map((c) => ({ id: c.id, label: c.label })),
    kb,
    shop: { shipping: settings.shipping, pay: settings.pay, brand: settings.brand },
    currentSlug: req.page?.product,
  });

  const byId = new Map(products.map((x) => [x.id, x]));
  const cards = p.productIds.map((id) => byId.get(id)).filter((x): x is Product => !!x).map(toCard);

  let text = p.text;
  let mode: AssistantReply["mode"] = "deterministic";
  if (p.llm !== "none" && llmConfigured()) {
    const system = buildSystemPrompt({
      lang,
      role: p.llm,
      facts: p.facts,
      productCount: cards.length,
      budget: p.budget,
      shopName: settings.brand.shopName,
    });
    const raw = await callLlm(
      system,
      messages.slice(-10).map((m) => ({ role: m.role, content: m.text })),
    );
    if (raw) {
      const allowed = new Set([...numbersIn(p.facts), ...userTexts.flatMap(numbersIn), ...(p.budget ? [String(p.budget)] : [])]);
      const checked = validateLlmText(raw, { productNames: products.map((x) => x.name), allowedNumbers: allowed });
      if (checked) {
        text = checked;
        mode = "llm";
      }
    }
  }

  return { ok: true, text, products: cards, sources: p.sources, actions: p.actions, mode };
}
