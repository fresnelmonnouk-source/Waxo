import "server-only";
import { ASSISTANT_LLM_MODEL } from "@/lib/assistant/prompt";

/**
 * Appel DeepSeek de l'IA de l'admin : mode JSON, réponse en flux (stream) pour qu'un délai dépassé ou une limite de
 * jetons atteinte laisse quand même le texte déjà reçu, que `parseLenient` récupère. Aucun contenu n'est journalisé.
 */

const ENDPOINT = "https://api.deepseek.com/chat/completions";

export const adminLlmConfigured = () => !!process.env.DEEPSEEK_API_KEY;
export const adminLlmModel = () => process.env.ADMIN_AI_LLM_MODEL?.trim() || process.env.ASSISTANT_LLM_MODEL?.trim() || ASSISTANT_LLM_MODEL;

export type LlmJsonOk = {
  ok: true;
  text: string;
  /** false = réponse coupée (max_tokens atteint ou délai dépassé) : à réparer. */
  complete: boolean;
  usage: { prompt: number; completion: number } | null;
};
export type LlmJsonFail = { ok: false; code: "no_key" | "http" | "timeout" | "network" | "empty"; status?: number };
export type LlmJsonResult = LlmJsonOk | LlmJsonFail;

export type LlmJsonInput = {
  system: string;
  user: string;
  maxTokens: number;
  /** Délai total (connexion + génération) au-delà duquel on garde ce qui est arrivé. */
  deadlineMs: number;
  temperature?: number;
  fetchImpl?: typeof fetch;
};

type Chunk = { choices?: { delta?: { content?: unknown }; finish_reason?: unknown }[]; usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } | null };

export async function callLlmJson(input: LlmJsonInput): Promise<LlmJsonResult> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return { ok: false, code: "no_key" };
  const doFetch = input.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, input.deadlineMs);
  let text = "";
  let finish: string | null = null;
  let usage: LlmJsonOk["usage"] = null;
  try {
    const res = await doFetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: adminLlmModel(),
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
        response_format: { type: "json_object" },
        max_tokens: input.maxTokens,
        temperature: input.temperature ?? 0.3,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) return { ok: false, code: "http", status: res.status };
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    const onLine = (line: string) => {
      const l = line.trim();
      if (!l.startsWith("data:")) return;
      const payload = l.slice(5).trim();
      if (!payload || payload === "[DONE]") return;
      try {
        const chunk = JSON.parse(payload) as Chunk;
        const choice = chunk.choices?.[0];
        if (typeof choice?.delta?.content === "string") text += choice.delta.content;
        if (typeof choice?.finish_reason === "string") finish = choice.finish_reason;
        if (chunk.usage && typeof chunk.usage.prompt_tokens === "number" && typeof chunk.usage.completion_tokens === "number") {
          usage = { prompt: chunk.usage.prompt_tokens, completion: chunk.usage.completion_tokens };
        }
      } catch {
        /* ligne partielle ou bruit : ignorée */
      }
    };
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          onLine(buf.slice(0, nl));
          buf = buf.slice(nl + 1);
        }
      }
      if (buf) onLine(buf);
    } catch {
      // Délai dépassé (ou coupure réseau) en cours de flux : on garde le texte déjà reçu.
      if (!text) return { ok: false, code: timedOut ? "timeout" : "network" };
      return { ok: true, text, complete: false, usage };
    }
    if (!text.trim()) return { ok: false, code: "empty" };
    return { ok: true, text, complete: finish === "stop", usage };
  } catch {
    return { ok: false, code: timedOut ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}
