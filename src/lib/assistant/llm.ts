import "server-only";
import { ASSISTANT_LLM_MODEL } from "./prompt";

const ENDPOINT = "https://api.deepseek.com/chat/completions";
const TIMEOUT_MS = 7000;

export type LlmTurn = { role: "user" | "assistant"; content: string };

export const llmConfigured = () => !!process.env.DEEPSEEK_API_KEY;

/**
 * Appel DeepSeek (compatible OpenAI). Renvoie le texte brut ou null au moindre problème (clé absente, erreur HTTP,
 * délai dépassé, réponse inattendue) : l'appelant retombe alors sur la réponse déterministe. Aucun contenu n'est journalisé.
 */
export async function callLlm(system: string, turns: LlmTurn[]): Promise<string | null> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const model = process.env.ASSISTANT_LLM_MODEL?.trim() || ASSISTANT_LLM_MODEL;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, ...turns],
        max_tokens: 220,
        temperature: 0.4,
        stream: false,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
    const content = data.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
