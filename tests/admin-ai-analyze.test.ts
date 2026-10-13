import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Orchestration : corpus → DeepSeek → validation tolérante ; journal sans contenu ; demande de l'admin masquée.

const CORPUS_MARK = "CONTENU-DU-CORPUS-SECRET-DE-TEST";
const ANSWER_MARK = "PROBLEME-DE-TEST-UNIQUE";
const callLlmJson = vi.fn();
vi.mock("@/lib/admin/ai/llm", () => ({ callLlmJson: (i: unknown) => callLlmJson(i) }));
vi.mock("@/lib/admin/ai/corpus", () => ({
  loadCorpusSources: async () => ({ settings: { brand: { shopName: "Wá xɔ" } } }),
  buildCorpus: () => ({ text: `## RÉGLAGES\n${CORPUS_MARK}`, chars: 40, truncated: false, sections: [] }),
}));

const answer = JSON.stringify({
  issues: [{ severity: "critique", where: "FAQ", problem: `${ANSWER_MARK} : la carte est annoncée.`, suggestion: "Retirer." }],
  missingTopics: [],
  kbDrafts: [{ tag: "Retours", title: "Retours hors Cotonou", text: "Le renvoi est à votre charge, sauf produit défectueux.", keywords: "retour" }],
});

let logs: string[] = [];
beforeEach(() => {
  callLlmJson.mockReset();
  logs = [];
  vi.spyOn(console, "info").mockImplementation((...a: unknown[]) => void logs.push(a.map(String).join(" ")));
});
afterEach(() => vi.restoreAllMocks());

describe("runAnalysis", () => {
  it("renvoie l'analyse validée et journalise SANS contenu", async () => {
    callLlmJson.mockResolvedValue({ ok: true, text: answer, complete: true, usage: { prompt: 9000, completion: 700 } });
    const { runAnalysis, ANALYSIS_CFG } = await import("@/lib/admin/ai/analyze");
    const r = await runAnalysis();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.analysis.issues[0].severity).toBe("critique");
      expect(r.meta).toMatchObject({ complete: true, repaired: false, usage: { prompt: 9000, completion: 700 } });
    }
    const input = callLlmJson.mock.calls[0][0] as { user: string; maxTokens: number; deadlineMs: number };
    expect(input.user).toContain(CORPUS_MARK);
    expect(input.maxTokens).toBe(ANALYSIS_CFG.maxTokens);
    expect(input.deadlineMs).toBeLessThanOrEqual(50_000); // maxDuration de la page = 60 s
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatch(/^\[admin\/ai\] analyze /);
    expect(logs[0]).not.toContain(CORPUS_MARK);
    expect(logs[0]).not.toContain(ANSWER_MARK);
    expect(logs[0]).not.toContain("Retours");
  });

  it("réponse tronquée → ce qui est valide est gardé", async () => {
    callLlmJson.mockResolvedValue({ ok: true, text: answer.slice(0, answer.indexOf("Le renvoi")), complete: false, usage: null });
    const { runAnalysis } = await import("@/lib/admin/ai/analyze");
    const r = await runAnalysis();
    expect(r.ok && r.analysis.issues.length).toBe(1);
    expect(r.ok && r.meta.repaired).toBe(true);
  });

  it("réponse illisible ou IA en échec → code d'erreur", async () => {
    const { runAnalysis } = await import("@/lib/admin/ai/analyze");
    callLlmJson.mockResolvedValueOnce({ ok: true, text: "Je ne peux pas.", complete: true, usage: null });
    expect(await runAnalysis()).toEqual({ ok: false, code: "unreadable" });
    callLlmJson.mockResolvedValueOnce({ ok: false, code: "timeout" });
    expect(await runAnalysis()).toEqual({ ok: false, code: "timeout" });
    callLlmJson.mockResolvedValueOnce({ ok: false, code: "http", status: 500 });
    expect(await runAnalysis()).toEqual({ ok: false, code: "llm" });
  });
});

describe("runDraft", () => {
  it("masque les données personnelles collées dans la demande", async () => {
    callLlmJson.mockResolvedValue({ ok: true, text: JSON.stringify({ tag: "Retours", title: "Retours hors Cotonou", text: "Le renvoi est à votre charge, sauf produit défectueux.", keywords: "" }), complete: true, usage: null });
    const { runDraft } = await import("@/lib/admin/ai/analyze");
    const r = await runDraft("Fiche retours pour la cliente awa.k@gmail.com au 01 97 55 44 33");
    expect(r.ok).toBe(true);
    const user = (callLlmJson.mock.calls[0][0] as { user: string }).user;
    expect(user).not.toContain("awa.k@gmail.com");
    expect(user).not.toContain("97 55 44 33");
    expect(logs.join("\n")).not.toContain("awa");
  });
});
