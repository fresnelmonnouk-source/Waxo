import "server-only";
import { ASSISTANT_LLM_MODEL } from "@/lib/assistant/prompt";
import { fmtXof } from "@/lib/money";
import { redactPii } from "./redact";
import type { Author, Category, Lang } from "./types";

/**
 * « Brouillon IA » de l'admin (Discussions). Décision de Fresnel : AUCUNE donnée personnelle de client chez DeepSeek.
 * Le modèle reçoit seulement : la catégorie, le statut de la commande citée (sans son numéro), le fil PSEUDONYMISÉ
 * (sans nom, téléphone, e-mail, adresse, numéro de commande ni lien ; notes internes exclues) et les faits de la boutique.
 * Le prénom est remis localement, après coup. Rien n'est envoyé au client sans l'admin.
 */

export type DraftFacts = {
  shopName: string;
  shipping: { cotonou: number; autre: number; freeFrom: number; cutoff: number; returnDays: number };
  pay: { online: boolean; cod: boolean };
  /** Extraits de la base de connaissances pertinents (titres + textes), déjà en clair et sans donnée client. */
  kb: { title: string; text: string }[];
};

export type DraftThreadMessage = { author: Author; body: string };

const CATEGORY_FOR_AI: Record<Lang, Record<Category, string>> = {
  fr: { question: "Question", plainte: "Plainte", retour: "Retour ou remboursement", commande: "Commande", autre: "Autre" },
  en: { question: "Question", plainte: "Complaint", retour: "Return or refund", commande: "Order", autre: "Other" },
};

export const FIRST_NAME_MARK = "{{prenom}}";

/** Faits de la boutique (source : réglages en base + décisions validées du brief). Pur. */
export function shopFactsText(lang: Lang, f: DraftFacts): string[] {
  const s = f.shipping;
  if (lang === "en") {
    return [
      `Express Delivery in Cotonou and Abomey-Calavi: same day for orders placed before ${s.cutoff}:00, otherwise the next day, 7 days a week. Fee: ${fmtXof(s.cotonou)}. Free delivery from ${fmtXof(s.freeFrom)} in this area only.`,
      `Other towns in Benin: 48 to 72 hours, fee ${fmtXof(s.autre)}.`,
      f.pay.online ? "Online payment by Mobile Money (MTN MoMo, Moov Money, Celtiis Cash). Bank cards are not accepted." : "No online payment for now.",
      ...(f.pay.cod ? ["Cash on delivery: in cash or by Mobile Money at the door. For cash on delivery, the cut-off time applies at confirmation on WhatsApp."] : []),
      `Returns within ${s.returnDays} days. Outside Cotonou and Calavi, the customer pays for the return shipping, unless the product is defective or we made a mistake (then we pay).`,
      "The team is available on WhatsApp 7 days a week, 8 am to 8 pm.",
    ];
  }
  return [
    `Livraison Express à Cotonou et Abomey-Calavi : le jour même pour une commande passée avant ${s.cutoff} h, sinon le lendemain, 7 j/7. Frais : ${fmtXof(s.cotonou)}. Livraison offerte dès ${fmtXof(s.freeFrom)} dans cette zone seulement.`,
    `Autres villes du Bénin : 48 à 72 h, frais ${fmtXof(s.autre)}.`,
    f.pay.online ? "Paiement en ligne par Mobile Money (MTN MoMo, Moov Money, Celtiis Cash). La carte bancaire n'est pas acceptée." : "Pas de paiement en ligne pour le moment.",
    ...(f.pay.cod ? ["Paiement à la livraison : en espèces ou par Mobile Money à la porte. Pour un paiement à la livraison, l'heure limite s'apprécie à la confirmation sur WhatsApp."] : []),
    `Retours sous ${s.returnDays} jours. Hors Cotonou et Calavi, le renvoi est à la charge du client, sauf produit défectueux ou erreur de notre part (à nos frais).`,
    "Équipe joignable sur WhatsApp 7 j/7, de 8 h à 20 h.",
  ];
}

export type DraftPromptInput = {
  lang: Lang;
  category: Category;
  orderStatusLabel: string | null;
  messages: DraftThreadMessage[];
  /** Nom saisi par le client : sert SEULEMENT à le masquer dans les messages. */
  customerName: string;
  facts: DraftFacts;
};

/** Construit (system, user) pour DeepSeek. Pur : tout ce qui sort d'ici peut partir chez le prestataire. */
export function buildDraftPrompt(i: DraftPromptInput): { system: string; user: string } {
  const en = i.lang === "en";
  const shop = i.facts.shopName || "Wá xɔ";
  const system = en
    ? `You write a DRAFT reply for the customer service of ${shop}, an online shop in Benin. A team member will review it before anything is sent. Rules: reply in English, warm and direct, 120 words at most. Use ONLY the facts provided; if information is missing, say the team is checking and will get back to the customer. Never promise a refund, a discount or a timeframe that is not in the facts. For a complaint, acknowledge the problem and state the next step. The markers [nom], [téléphone], [e-mail], [adresse], [commande] and [lien] replace hidden data: do not copy them and never invent personal data. Start with "Hello ${FIRST_NAME_MARK}," and do not add a signature.`
    : `Tu rédiges un BROUILLON de réponse du service client de ${shop}, boutique en ligne au Bénin. Un membre de l'équipe le relira avant tout envoi. Règles : réponds en français, ton chaleureux et direct, 120 mots au plus. Appuie-toi UNIQUEMENT sur les faits fournis ; si une information manque, dis que l'équipe vérifie et revient vers le client. Ne promets jamais de remboursement, de geste commercial ni de délai absent des faits. Pour une plainte, reconnais le problème et indique la prochaine étape. Les marqueurs [nom], [téléphone], [e-mail], [adresse], [commande] et [lien] remplacent des données masquées : ne les recopie pas et n'invente aucune donnée personnelle. Commence par « Bonjour ${FIRST_NAME_MARK}, » et ne mets pas de signature.`;

  const names = [i.customerName];
  const thread = i.messages
    .filter((m) => m.author !== "note_interne")
    .slice(-12)
    .map((m) => `${m.author === "client" ? (en ? "Customer" : "Client") : en ? "Team" : "Équipe"} : ${redactPii(m.body, names).replace(/\s+/g, " ").trim().slice(0, 1500)}`)
    .join("\n");
  const facts = [...shopFactsText(i.lang, i.facts), ...i.facts.kb.slice(0, 3).map((k) => `${k.title} : ${k.text.replace(/\s+/g, " ").slice(0, 600)}`)]
    .map((f) => `- ${f}`)
    .join("\n");
  const user = [
    `${en ? "Category" : "Catégorie"} : ${CATEGORY_FOR_AI[i.lang][i.category]}`,
    i.orderStatusLabel ? `${en ? "Status of the order mentioned" : "Statut de la commande citée"} : ${i.orderStatusLabel}` : "",
    "",
    `${en ? "Shop facts" : "Faits de la boutique"} :`,
    facts,
    "",
    `${en ? "Conversation (oldest first)" : "Fil de la discussion (du plus ancien au plus récent)"} :`,
    thread,
    "",
    en ? "Write the team's next reply." : "Rédige la prochaine réponse de l'équipe.",
  ]
    .filter((l, idx, arr) => l !== "" || arr[idx - 1] !== "")
    .join("\n");
  return { system, user };
}

/** Texte final : prénom remis localement, marqueurs résiduels retirés, signature ajoutée, 3 000 caractères au plus. Pur. */
export function finalizeDraft(raw: string, firstName: string, sign: string, lang: Lang): string {
  const hello = lang === "en" ? "Hello" : "Bonjour";
  let t = raw.trim().replace(/^["«»\s]+|["«»\s]+$/g, "");
  t = t.replace(/\{\{\s*pr[ée]nom\s*\}\}/gi, firstName).replace(new RegExp(`^(${hello})\\s*,`), `${hello},`);
  t = t.replace(/^(Bonjour|Hello) ,/, "$1,");
  t = t.replace(/\[(nom|téléphone|e-mail|adresse|commande|lien)\]/gi, "").replace(/[ \t]{2,}/g, " ").replace(/ ([,.])/g, "$1");
  const body = t.slice(0, 2800).trim();
  return sign ? `${body}\n\n${sign}` : body;
}

const ENDPOINT = "https://api.deepseek.com/chat/completions";
const TIMEOUT_MS = 15_000;

export const draftLlmConfigured = () => !!process.env.DEEPSEEK_API_KEY?.trim();

/** Appel DeepSeek. null au moindre problème (l'admin retombe sur le modèle automatique). Aucun contenu journalisé. */
export async function callDraftLlm(prompt: { system: string; user: string }, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) return null;
  const model = process.env.ASSISTANT_LLM_MODEL?.trim() || ASSISTANT_LLM_MODEL;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        max_tokens: 600,
        temperature: 0.3,
        stream: false,
      }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
    const content = data.choices?.[0]?.message?.content;
    return typeof content === "string" && content.trim() ? content : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
