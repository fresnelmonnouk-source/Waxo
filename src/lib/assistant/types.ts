import type { BrandSettings, PaySettings, Product, ShippingSettings } from "@/lib/catalog/types";

export type Lang = "fr" | "en";

/** Entrée de la base de connaissances (table `kb` ou repli démo), déjà localisée. */
export type KbEntry = { id: string; tag: string; title: string; text: string; keywords: string };

/** Fiche produit renvoyée au widget : champs d'affichage uniquement, lus dans le catalogue (jamais écrits par le LLM). */
export type CardProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  comparePrice: number | null;
  stock: number;
  bg: string | null;
  imageUrl: string | null;
};

/** Bouton d'action sous une réponse. `href` est un chemin interne ("/contact") ou un lien wa.me. */
export type AssistantAction = { kind: "page" | "whatsapp"; label: string; href: string };

export type Intent =
  | "escalation"
  | "order"
  | "kb"
  | "delivery"
  | "payment"
  | "returns"
  | "productInfo"
  | "products"
  | "ask"
  | "chat";

/** Rôle du LLM pour cette réponse : aucun, introduction de la liste, reformulation d'un extrait, question de précision. */
export type LlmRole = "none" | "intro" | "rephrase" | "question";

export type Plan = {
  intent: Intent;
  /** Réponse déterministe complète (utilisée telle quelle sans LLM ou si la sortie du LLM est refusée). */
  text: string;
  productIds: string[];
  sources: string[];
  actions: AssistantAction[];
  /** Extraits fiables fournis au LLM (base de connaissances) ; vide pour une liste de produits. */
  facts: string;
  llm: LlmRole;
  budget: number | null;
};

export type EngineInput = {
  lang: Lang;
  text: string;
  /** Message précédent du visiteur (contexte des relances courtes). */
  prevUser: string;
  products: Product[];
  categories: { id: string; label: string }[];
  kb: KbEntry[];
  shop: { shipping: ShippingSettings; pay: PaySettings; brand: BrandSettings };
  /** Slug de la fiche produit consultée, si le visiteur est sur une fiche. */
  currentSlug?: string;
};

export type AssistantReply = {
  ok: true;
  text: string;
  products: CardProduct[];
  sources: string[];
  actions: AssistantAction[];
  /** "llm" seulement si la coquille conversationnelle vient du modèle ; sinon réponse 100 % déterministe. */
  mode: "escalation" | "deterministic" | "llm";
};
