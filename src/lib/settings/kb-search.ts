import { validEmail } from "./phone";

// Base de connaissances : recherche déterministe (BM25 simplifié sur racines de 6 lettres, comme la maquette)
// + modèle de brouillon de réponse. Fonctions pures (client + serveur), aucune IA.

export const KB_TAGS = ["Livraison", "Paiement", "Retours", "Compte", "Boutique", "Produit", "Autre"] as const;
export type KbTag = (typeof KB_TAGS)[number];

export type KbEntry = { id: string; tag: string; title: string; text: string; keywords: string };
export type KbDoc = KbEntry & { kind: "kb" | "produit" };
export type KbHit = KbDoc & { score: number };

const STOP = new Set(
  "les des une est sont pour par sur avec dans cet cette ces que qui quoi quel quelle quels quelles vous nous ils elles mon mes votre vos notre nos pas plus bonjour merci svp peut peux faire fait avez aussi tres bien est-ce comment".split(
    " ",
  ),
);

export const norm = (s: string): string =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function tokens(s: string): string[] {
  return norm(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => w.slice(0, 6));
}

/** BM25 simplifié : renvoie les `k` meilleurs documents (score > 0,4), du plus pertinent au moins pertinent. */
export function retrieve(query: string, docs: KbDoc[], k = 4): KbHit[] {
  const qt = [...new Set(tokens(query))];
  if (!qt.length || !docs.length) return [];
  const toks = docs.map((d) => tokens(`${d.title} ${d.title} ${d.keywords} ${d.text}`));
  const N = docs.length;
  const avg = toks.reduce((a, t) => a + t.length, 0) / N || 1;
  const df: Record<string, number> = {};
  qt.forEach((t) => {
    df[t] = toks.filter((ts) => ts.includes(t)).length;
  });
  return docs
    .map((d, i) => {
      const ts = toks[i];
      let score = 0;
      qt.forEach((t) => {
        const f = ts.filter((x) => x === t).length;
        if (!f) return;
        const idf = Math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5));
        score += (idf * f * 2.2) / (f + 1.2 * (0.25 + (0.75 * ts.length) / avg));
      });
      return { ...d, score };
    })
    .filter((d) => d.score > 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export function snippet(text: string, max = 120): string {
  return text.length > max ? text.slice(0, max - 2) + "…" : text;
}

// ───────────────────────── Brouillon de réponse (modèle automatique) ─────────────────────────
export type DraftInput = {
  name: string;
  contact: string;
  subject: string;
  text: string;
  orderNumber: string | null;
  orderStatusLabel: string | null;
  aiSign: string;
};
export type Draft = { text: string; mode: string; sources: { title: string; tag: string }[] };

/** Même modèle que le repli de la maquette : salutation, statut de commande cité, 2 phrases de la meilleure fiche, signature. */
export function buildDraft(input: DraftInput, docs: KbDoc[]): Draft {
  const hits = retrieve(`${input.subject} ${input.text}`, docs, 4);
  const first = (input.name.trim().split(/\s+/)[0] || "").slice(0, 60);
  const top = hits[0];
  const order = input.orderNumber && input.orderStatusLabel ? `Votre commande ${input.orderNumber} est au statut « ${input.orderStatusLabel} ». ` : "";
  const body = top ? (top.text.split(/(?<=\.)\s/).slice(0, 2).join(" ")) : "Nous vérifions et revenons vers vous très vite.";
  const text = `Bonjour ${first},\n\nMerci pour votre message. ${order}${body}\n\n${input.aiSign}`;
  return { text, mode: "Modèle automatique", sources: hits.slice(0, 3).map((h) => ({ title: h.title, tag: h.tag })) };
}

/** Lien de réponse : e-mail si le contact en est un, WhatsApp sinon. Le texte du brouillon est pré-rempli. */
export function replyLink(contact: string, shopName: string, draft: string | null): { href: string; channel: "email" | "whatsapp" } {
  const c = contact.trim();
  if (validEmail(c)) {
    const body = draft ? `&body=${encodeURIComponent(draft)}` : "";
    const addr = encodeURIComponent(c).replace(/%40/g, "@"); // jamais de paramètre mailto injecté via le contact
    return { href: `mailto:${addr}?subject=${encodeURIComponent(`Votre message à ${shopName}`)}${body}`, channel: "email" };
  }
  const d = c.replace(/\D/g, "");
  const wa = d.length === 13 && d.startsWith("229") ? d : d.length === 10 || d.length === 8 ? `229${d.length === 8 ? "01" + d : d}` : d;
  return { href: `https://wa.me/${wa}${draft ? `?text=${encodeURIComponent(draft)}` : ""}`, channel: "whatsapp" };
}
