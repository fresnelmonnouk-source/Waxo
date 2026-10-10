import { afterEach, describe, expect, it, vi } from "vitest";
import { ACCOUNTANT_LLM_MODEL, cleanLlmText, isFaithful, numbersIn, rephrase } from "@/lib/accountant/llm";

const NB = " ";
const DRAFT = `En octobre 2026, 10${NB}000${NB}F de publicité pour 28${NB}800${NB}F de ventes : 1 F pour 2,9 F.`;
const reply = (content: string) => (async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })) as unknown as typeof fetch;

afterEach(() => vi.unstubAllEnvs());

describe("garde-fous de reformulation", () => {
  it("le modèle est épinglé, jamais l'alias", () => {
    expect(ACCOUNTANT_LLM_MODEL).not.toBe("deepseek-chat");
    expect(ACCOUNTANT_LLM_MODEL).toMatch(/^deepseek-/);
  });
  it("extrait les nombres sans tenir compte des séparateurs", () => {
    expect([...numbersIn("125 000 F et 125000, 2,9 %")].sort()).toEqual(["125000", "2", "9"].sort());
  });
  it("refuse un nombre inventé, accepte une reformulation fidèle", () => {
    expect(isFaithful(DRAFT, "Vous avez dépensé 10 000 F en pub en octobre 2026 pour 28 800 F de ventes.")).toBe(true);
    expect(isFaithful(DRAFT, "Vous avez dépensé 12 000 F en pub.")).toBe(false);
    expect(isFaithful(DRAFT, "")).toBe(false);
  });
  it("retire le markdown", () => expect(cleanLlmText("**Bonjour**")).toBe("Bonjour"));
});

describe("rephrase", () => {
  it("sans clé : null, aucun appel réseau", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const f = vi.fn();
    expect(await rephrase("q", DRAFT, f as unknown as typeof fetch)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  it("avec clé : renvoie le texte fidèle", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "k");
    expect(await rephrase("q", DRAFT, reply("En octobre 2026, 10 000 F de pub ont rapporté 28 800 F de ventes."))).toContain("28 800");
  });
  it("sortie infidèle, HTTP en erreur ou exception : null", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "k");
    expect(await rephrase("q", DRAFT, reply("Vous avez gagné 99 999 F."))).toBeNull();
    expect(await rephrase("q", DRAFT, (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch)).toBeNull();
    expect(await rephrase("q", DRAFT, (async () => { throw new Error("réseau"); }) as unknown as typeof fetch)).toBeNull();
  });
  it("n'envoie que la question et le brouillon calculé, avec le modèle épinglé", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "k");
    const f = vi.fn<(url: unknown, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({ choices: [{ message: { content: "10 000" } }] })));
    await rephrase("Ma pub ?", DRAFT, f as unknown as typeof fetch);
    const body = JSON.parse(String(f.mock.calls[0][1]?.body));
    expect(body.model).toBe(ACCOUNTANT_LLM_MODEL);
    expect(JSON.stringify(body.messages)).toContain("En octobre 2026");
  });
});
