import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanLlmText, validateLlmText } from "@/lib/assistant/guard";
import { ASSISTANT_LLM_MODEL, buildSystemPrompt } from "@/lib/assistant/prompt";
import { normalizeMessages, requestSchema } from "@/lib/assistant/schema";
import { numbersIn } from "@/lib/assistant/text";

const ctx = (allowed: string[] = []) => ({
  productNames: ["Lampe LED rechargeable", "Mini ventilateur USB", "Gourde isotherme 750 ml"],
  allowedNumbers: new Set(allowed),
});

describe("assistant — garde-fou de la sortie LLM", () => {
  it("accepte une phrase générique", () => {
    expect(validateLlmText("Voici quelques idées utiles pour vos soirées.", ctx())).toBe("Voici quelques idées utiles pour vos soirées.");
  });
  it("refuse un nom de produit du catalogue", () => {
    expect(validateLlmText("Je vous conseille la Lampe LED rechargeable.", ctx())).toBeNull();
    expect(validateLlmText("Prenez le mini ventilateur usb !", ctx())).toBeNull();
  });
  it("refuse un prix ou un nombre inventé", () => {
    expect(validateLlmText("Ça coûte 8 900 F seulement.", ctx())).toBeNull();
    expect(validateLlmText("Livraison en 3 jours.", ctx())).toBeNull();
  });
  it("accepte un nombre venu du contexte fiable (budget du visiteur)", () => {
    expect(validateLlmText("Dans votre budget de 10 000 F, voici des idées.", ctx(["10000"]))).not.toBeNull();
  });
  it("refuse liens, e-mails, texte vide ou trop long", () => {
    expect(validateLlmText("Voir https://exemple.com", ctx())).toBeNull();
    expect(validateLlmText("Écrivez à moi@exemple.bj", ctx())).toBeNull();
    expect(validateLlmText("  ", ctx())).toBeNull();
    expect(validateLlmText("a".repeat(700), ctx())).toBeNull();
  });
  it("retire le markdown", () => {
    expect(cleanLlmText("**Bonjour** :\n- idée\n# titre")).toBe("Bonjour : idée titre");
  });
  it("extrait les nombres sans séparateurs", () => {
    expect(numbersIn("15 000 F et 18 h")).toEqual(["15000", "18"]);
  });
});

describe("assistant — prompt et requête", () => {
  it("modèle épinglé, jamais l'alias deepseek-chat", () => {
    expect(ASSISTANT_LLM_MODEL).not.toBe("deepseek-chat");
    expect(ASSISTANT_LLM_MODEL).toMatch(/^deepseek-v\d/);
  });
  it("le prompt interdit de nommer ou chiffrer un produit et ne contient aucun produit", () => {
    const p = buildSystemPrompt({ lang: "fr", role: "intro", facts: "", productCount: 3, budget: 10000, shopName: "Wá xɔ" });
    expect(p).toMatch(/Ne nomme AUCUN produit/);
    expect(p).toContain("3 fiche");
    expect(p).not.toMatch(/Lampe|ventilateur/i);
  });
  it("schéma : historique borné", () => {
    const ok = requestSchema.safeParse({ lang: "fr", messages: [{ role: "user", text: "Bonjour" }] });
    expect(ok.success).toBe(true);
    expect(requestSchema.safeParse({ lang: "de", messages: [{ role: "user", text: "x" }] }).success).toBe(false);
    expect(requestSchema.safeParse({ lang: "fr", messages: [{ role: "user", text: "x".repeat(501) }] }).success).toBe(false);
    expect(requestSchema.safeParse({ lang: "fr", messages: Array.from({ length: 11 }, () => ({ role: "user", text: "x" })) }).success).toBe(false);
    expect(requestSchema.safeParse({ lang: "fr", messages: [] }).success).toBe(false);
    expect(requestSchema.safeParse({ lang: "fr", messages: [{ role: "user", text: "x" }], page: { product: "../etc" } }).success).toBe(false);
  });
  it("normalisation : commence et finit par le visiteur, contrôles retirés", () => {
    const out = normalizeMessages([
      { role: "assistant", text: "Bonjour" },
      { role: "user", text: "salut\u0000  toi" },
      { role: "assistant", text: "Oui ?" },
    ]);
    expect(out).toEqual([{ role: "user", text: "salut toi" }]);
  });
});

describe("assistant — answer() de bout en bout (démo, sans Supabase)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sans clé LLM : mode 100 % déterministe, fiches réelles", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { answer } = await import("@/lib/assistant/answer");
    const r = await answer({ lang: "fr", messages: [{ role: "user", text: "Un cadeau à moins de 10 000 F" }] });
    expect(r.mode).toBe("deterministic");
    expect(r.products.length).toBeGreaterThan(0);
    r.products.forEach((p) => expect(p.price).toBeLessThanOrEqual(10000));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("escalade : redirection WhatsApp/contact, aucun appel LLM même avec une clé", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { answer } = await import("@/lib/assistant/answer");
    const r = await answer({ lang: "fr", messages: [{ role: "user", text: "Je veux être remboursé" }] });
    expect(r.mode).toBe("escalation");
    expect(r.products).toEqual([]);
    expect(r.actions.map((a) => a.href)).toContain("/contact");
    expect(r.actions.some((a) => a.href.startsWith("https://wa.me/"))).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("LLM : une phrase propre habille la liste, les fiches viennent du catalogue", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    const fetchSpy = vi.fn(async (_url: string, init?: { body?: string }) => {
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe(ASSISTANT_LLM_MODEL);
      expect(body.messages[0].content).not.toMatch(/Lampe LED/);
      return new Response(JSON.stringify({ choices: [{ message: { content: "Voici de quoi garder la lumière quand le courant coupe." } }] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchSpy);
    const { answer } = await import("@/lib/assistant/answer");
    const r = await answer({ lang: "fr", messages: [{ role: "user", text: "Contre les coupures de courant" }] });
    expect(r.mode).toBe("llm");
    expect(r.text).toBe("Voici de quoi garder la lumière quand le courant coupe.");
    expect(r.products.length).toBeGreaterThan(0);
  });

  it("LLM qui nomme un produit ou un prix : refusé, repli déterministe", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "Prenez la Lampe LED rechargeable à 8 900 F." } }] }), { status: 200 })),
    );
    const { answer } = await import("@/lib/assistant/answer");
    const r = await answer({ lang: "fr", messages: [{ role: "user", text: "Contre les coupures de courant" }] });
    expect(r.mode).toBe("deterministic");
    expect(r.text).not.toMatch(/8 900/);
  });

  it("LLM en panne : repli déterministe sans erreur", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("network"))));
    const { answer } = await import("@/lib/assistant/answer");
    const r = await answer({ lang: "en", messages: [{ role: "user", text: "A gift under 10,000 F" }] });
    expect(r.mode).toBe("deterministic");
    expect(r.products.length).toBeGreaterThan(0);
  });
});
