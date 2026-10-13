import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callLlmJson } from "@/lib/admin/ai/llm";

const enc = new TextEncoder();
const sse = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;
const delta = (content: string, finish: string | null = null) => sse({ choices: [{ delta: { content }, finish_reason: finish }] });

/** Réponse en flux : morceaux envoyés avec un délai, interrompue par le signal d'abandon. */
function streamResponse(parts: string[], gapMs = 0, status = 200): (url: string, init?: RequestInit) => Promise<Response> {
  return async (_url, init) => {
    const signal = init?.signal;
    const body = new ReadableStream<Uint8Array>({
      async start(ctrl) {
        for (const p of parts) {
          if (gapMs) await new Promise((r) => setTimeout(r, gapMs));
          if (signal?.aborted) {
            ctrl.error(new DOMException("aborted", "AbortError"));
            return;
          }
          ctrl.enqueue(enc.encode(p));
        }
        ctrl.close();
      },
    });
    return new Response(body, { status });
  };
}

const base = { system: "s", user: "u", maxTokens: 100, deadlineMs: 2000 };

beforeEach(() => vi.stubEnv("DEEPSEEK_API_KEY", "sk-test-key-for-unit-tests-000000"));
afterEach(() => vi.unstubAllEnvs());

describe("callLlmJson (flux DeepSeek)", () => {
  it("assemble le texte, lit l'usage, complet si finish_reason = stop", async () => {
    const f = streamResponse([delta('{"a":'), delta("1}"), delta("", "stop"), sse({ choices: [], usage: { prompt_tokens: 1200, completion_tokens: 40 } }), "data: [DONE]\n\n"]);
    const r = await callLlmJson({ ...base, fetchImpl: f as typeof fetch });
    expect(r).toEqual({ ok: true, text: '{"a":1}', complete: true, usage: { prompt: 1200, completion: 40 } });
  });

  it("max_tokens atteint (finish_reason = length) → incomplet", async () => {
    const r = await callLlmJson({ ...base, fetchImpl: streamResponse([delta('{"issues":[{"a"'), delta("", "length")]) as typeof fetch });
    expect(r).toMatchObject({ ok: true, complete: false, text: '{"issues":[{"a"' });
  });

  it("délai dépassé en plein flux → garde le texte déjà reçu", async () => {
    const f = streamResponse([delta('{"issues":['), delta('{"x":1}'), delta(",{"), delta("..."), delta("]}", "stop")], 40);
    const r = await callLlmJson({ ...base, deadlineMs: 100, fetchImpl: f as typeof fetch });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.complete).toBe(false);
      expect(r.text.startsWith('{"issues":[')).toBe(true);
    }
  });

  it("délai dépassé avant tout texte → timeout", async () => {
    const r = await callLlmJson({ ...base, deadlineMs: 30, fetchImpl: streamResponse([delta("x")], 80) as typeof fetch });
    expect(r).toEqual({ ok: false, code: "timeout" });
  });

  it("clé absente → no_key, aucun appel réseau", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const f = vi.fn();
    expect(await callLlmJson({ ...base, fetchImpl: f as unknown as typeof fetch })).toEqual({ ok: false, code: "no_key" });
    expect(f).not.toHaveBeenCalled();
  });

  it("erreur HTTP, réseau, réponse vide", async () => {
    expect(await callLlmJson({ ...base, fetchImpl: streamResponse([], 0, 401) as typeof fetch })).toEqual({ ok: false, code: "http", status: 401 });
    expect(await callLlmJson({ ...base, fetchImpl: (async () => Promise.reject(new TypeError("fetch failed"))) as typeof fetch })).toEqual({ ok: false, code: "network" });
    expect(await callLlmJson({ ...base, fetchImpl: streamResponse(["data: [DONE]\n\n"]) as typeof fetch })).toEqual({ ok: false, code: "empty" });
  });

  it("demande le mode JSON, le flux et des max_tokens explicites", async () => {
    const f = vi.fn(streamResponse([delta("{}", "stop")]));
    await callLlmJson({ ...base, maxTokens: 4096, fetchImpl: f as unknown as typeof fetch });
    const body = JSON.parse(String((f.mock.calls[0][1] as RequestInit).body));
    expect(body).toMatchObject({ response_format: { type: "json_object" }, stream: true, max_tokens: 4096 });
    expect(body.model).not.toBe("deepseek-chat");
  });
});
