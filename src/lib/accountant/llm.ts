// Reformulation OPTIONNELLE par DeepSeek. Le LLM ne calcule jamais : il reçoit une réponse DÉJÀ calculée
// (agrégats uniquement : aucune donnée client, aucun libellé d'écriture) et la reformule. Toute sortie qui
// contient un nombre absent du brouillon est rejetée → repli sur la réponse déterministe.

/** Modèle épinglé (jamais l'alias `deepseek-chat`). Surchargeable par DEEPSEEK_ACCOUNTANT_MODEL. */
export const ACCOUNTANT_LLM_MODEL = "deepseek-v4-flash";
export const ACCOUNTANT_LLM_TIMEOUT_MS = 8000;
const ENDPOINT = "https://api.deepseek.com/chat/completions";
const MAX_REPLY_CHARS = 900;

const SYSTEM = [
  "Tu es le comptable IA d'une petite boutique en ligne à Cotonou (Bénin). Tu REFORMULES une réponse déjà calculée pour le gérant.",
  "Règles strictes :",
  "- N'ajoute, ne calcule et ne modifie AUCUN chiffre, montant, pourcentage, date ni nom de produit : reprends-les à l'identique.",
  "- Français clair et chaleureux, 2 à 6 phrases courtes, montants en F CFA tels qu'écrits. Pas de markdown, pas de liste, pas de tableau.",
  "- N'invente aucune information. Si le texte signale une donnée manquante, garde cette alerte.",
  "- Tu n'es pas un expert-comptable agréé : ne donne aucun avis fiscal.",
].join("\n");

/** Ensemble des nombres d'un texte (chiffres seuls : « 125 000 F » et « 125000 » donnent « 125000 »). */
export function numbersIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\d{1,3}(?:[ \u00a0\u202f.]\d{3})+|\d+/g)) out.add(m[0].replace(/\D/g, "").replace(/^0+(?=\d)/, ""));
  return out;
}

/** Vrai si la reformulation n'introduit aucun nombre nouveau et reste raisonnable. */
export function isFaithful(draft: string, candidate: string): boolean {
  const c = candidate.trim();
  if (!c || c.length > MAX_REPLY_CHARS) return false;
  const allowed = numbersIn(draft);
  for (const n of numbersIn(c)) if (!allowed.has(n)) return false;
  return true;
}

export function cleanLlmText(t: string): string {
  return t.replace(/\*\*|__|`|^#+\s*/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}

/** Renvoie la reformulation validée, ou null (pas de clé, erreur, délai dépassé, sortie infidèle). */
export async function rephrase(question: string, draft: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const model = process.env.DEEPSEEK_ACCOUNTANT_MODEL || ACCOUNTANT_LLM_MODEL;
  if (model === "deepseek-chat") return null;
  try {
    const res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 500,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Question du gérant : ${question.slice(0, 300)}\n\nRéponse calculée à reformuler :\n${draft}` },
        ],
      }),
      signal: AbortSignal.timeout(ACCOUNTANT_LLM_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    const text = cleanLlmText(content);
    return isFaithful(draft, text) ? text : null;
  } catch {
    return null;
  }
}
