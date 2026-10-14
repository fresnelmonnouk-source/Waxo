// Rédacteur IA des fiches produit : server action (garde admin, entrée, clé absente, lien en échec, sortie LLM invalide
// ou partielle), lecture tolérante de la réponse (limites, fromLink) et application au formulaire (sans écrasement).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_DETAILS } from "@/lib/catalog/details";
import { applyDraft, draftConflicts, type DraftTarget } from "@/lib/admin/ai/product-draft";
import { normalizeFromLink, parseProductDraft } from "@/lib/admin/ai/product-writer-schema";

const assertAdmin = vi.fn();
vi.mock("@/lib/admin/guard", () => ({ assertAdmin: () => assertAdmin(), requireAdmin: () => assertAdmin() }));

const callLlmJson = vi.fn();
vi.mock("@/lib/admin/ai/llm", () => ({
  adminLlmConfigured: () => !!process.env.DEEPSEEK_API_KEY,
  callLlmJson: (i: unknown) => callLlmJson(i),
}));

const fetchPageText = vi.fn();
vi.mock("@/lib/admin/ai/fetch-page", async (orig) => ({
  ...(await orig<typeof import("@/lib/admin/ai/fetch-page")>()),
  fetchPageText: (u: unknown) => fetchPageText(u),
}));

const GOOD = {
  nameFr: "Gourde isotherme inox 750 ml",
  nameEn: "Stainless steel insulated bottle 750 ml",
  descriptionFr: "Une gourde pour garder votre eau fraîche toute la journée.",
  descriptionEn: "A bottle that keeps your water cool all day.",
  word: "Gourde",
  detailsFr: { color: "Noir", materials: "Acier inoxydable", specs: "Contenance : 750 ml\nHauteur : 26 cm", highlights: "", uses: "Bureau\nSport", care: "" },
  detailsEn: { color: "Black", materials: "Stainless steel", specs: "Capacity: 750 ml", highlights: "", uses: "Office", care: "" },
  fromLink: ["specs", "descriptionFr"],
};
const llmOk = (value: unknown, complete = true) => ({ ok: true, text: typeof value === "string" ? value : JSON.stringify(value), complete, usage: null });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ""); // limiteur : repli mémoire
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  vi.stubEnv("DEEPSEEK_API_KEY", "sk-test-key-for-unit-tests-000000");
  assertAdmin.mockReset().mockResolvedValue({ id: "admin-1", email: "a@waxo.bj" });
  callLlmJson.mockReset().mockResolvedValue(llmOk(GOOD));
  fetchPageText.mockReset().mockResolvedValue({ ok: true, url: "https://boutique.com/p", page: { text: "Titre de la page : Gourde", truncated: false }, bytes: 10, cut: false, redirects: 0 });
});
afterEach(() => vi.unstubAllEnvs());

const load = async () => (await import("@/app/admin/(panel)/produits/ai-actions")).draftProductAction;

describe("draftProductAction", () => {
  it("non-admin refusé, sans lecture du lien ni appel au modèle", async () => {
    assertAdmin.mockResolvedValue(null);
    const r = await (await load())({ url: "https://boutique.com/p", notes: "", rayon: "Maison" });
    expect(r).toMatchObject({ ok: false, code: "unauthorized" });
    expect(fetchPageText).not.toHaveBeenCalled();
    expect(callLlmJson).not.toHaveBeenCalled();
  });
  it("rien de fourni (ni lien ni notes) → erreur claire", async () => {
    const act = await load();
    for (const input of [{}, { url: "", notes: "  " }, { notes: "ab" }]) {
      const r = await act(input);
      expect(r).toMatchObject({ ok: false, code: "invalid" });
    }
    expect(callLlmJson).not.toHaveBeenCalled();
  });
  it("entrée hors contrat → invalid (champ inconnu, notes trop longues)", async () => {
    const act = await load();
    expect(await act({ notes: "abc", extra: 1 })).toMatchObject({ ok: false, code: "invalid" });
    expect(await act({ notes: "x".repeat(4001) })).toMatchObject({ ok: false, code: "invalid" });
    expect(await act("texte")).toMatchObject({ ok: false, code: "invalid" });
  });
  it("clé DeepSeek absente → indisponible, aucun appel", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const r = await (await load())({ notes: "Gourde noire 750 ml" });
    expect(r).toMatchObject({ ok: false, code: "unavailable" });
    if (!r.ok) expect(r.message).toContain("DEEPSEEK_API_KEY");
    expect(callLlmJson).not.toHaveBeenCalled();
  });
  it("notes seules (sans lien) : pas de lecture de page, PAGE vide, fromLink vidé", async () => {
    const r = await (await load())({ notes: "Gourde noire 750 ml, je l'ai en main", rayon: "Cuisine" });
    expect(r.ok).toBe(true);
    expect(fetchPageText).not.toHaveBeenCalled();
    const call = callLlmJson.mock.calls[0][0] as { system: string; user: string; maxTokens: number };
    expect(call.user).toContain("<RAYON>Cuisine</RAYON>");
    expect(call.user).toContain("<NOTES>\nGourde noire 750 ml, je l'ai en main\n</NOTES>");
    expect(call.user).toContain("<PAGE>\n\n</PAGE>");
    expect(call.maxTokens).toBeGreaterThanOrEqual(4096);
    if (r.ok) {
      expect(r.draft.name).toBe("Gourde isotherme inox 750 ml");
      expect(r.draft.keyword).toBe("gourde");
      expect(r.draft.fromLink).toEqual([]);
    }
  });
  it("lien + notes : texte de la page envoyé ; TOUS les champs remplis marqués « à vérifier » (fromLink du modèle ignoré)", async () => {
    const r = await (await load())({ url: "https://boutique.com/p", notes: "Noire", rayon: "Cuisine" });
    expect(fetchPageText).toHaveBeenCalledWith("https://boutique.com/p");
    expect((callLlmJson.mock.calls[0][0] as { user: string }).user).toContain("<PAGE>\nTitre de la page : Gourde\n</PAGE>");
    expect(r.ok && [...r.draft.fromLink].sort()).toEqual(
      ["name", "nameEn", "description", "descriptionEn", "keyword", "fr.color", "fr.materials", "fr.specs", "fr.uses", "en.color", "en.materials", "en.specs", "en.uses"].sort(),
    );
  });
  it("page piégée : fromLink vide déclaré par le modèle → les champs restent « à vérifier » (Zoé Z7)", async () => {
    callLlmJson.mockResolvedValue(llmOk({ ...GOOD, fromLink: [] }));
    const r = await (await load())({ url: "https://boutique.com/p", notes: "" });
    expect(r.ok && r.draft.fromLink).toContain("description");
    expect(r.ok && r.draft.fromLink).toContain("fr.specs");
  });
  it("sortie : liens, e-mails, pseudos et numéros retirés de tous les champs (Raphaël 🟡2)", async () => {
    callLlmJson.mockResolvedValue(
      llmOk({
        ...GOOD,
        nameFr: "Gourde inox www.autre-boutique.bj",
        descriptionFr: "Une gourde pour garder votre eau fraîche. Commandez sur WhatsApp au +229 01 97 12 34 56. Livrée avec un bouchon.",
        descriptionEn: "A bottle. Order at https://evil.example/shop now. Keeps water cool.",
        detailsFr: { ...GOOD.detailsFr, care: "Laver à la main\nGarantie : voir sav-xyz.bj\nÉcrire à sav@autre.bj", uses: "Bureau\nSuivez @autre_boutique" },
      }),
    );
    const r = await (await load())({ url: "https://boutique.com/p", notes: "" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const all = JSON.stringify(r.draft);
    for (const bad of ["www.", "autre-boutique", "+229", "97 12 34", "https://", "evil.example", "sav-xyz", "sav@", "@autre_boutique", "WhatsApp"]) {
      expect(all).not.toContain(bad);
    }
    expect(r.draft.name).toBe("Gourde inox");
    expect(r.draft.description).toBe("Une gourde pour garder votre eau fraîche. Livrée avec un bouchon.");
    expect(r.draft.descriptionEn).toBe("A bottle. Keeps water cool.");
    expect(r.draft.details.care).toBe("Laver à la main");
    expect(r.draft.details.uses).toBe("Bureau");
    expect(r.draft.warnings?.description?.[0]).toMatch(/retiré/);
  });
  it("notes : numéros de téléphone masqués, mais tailles, modèles et normes envoyés tels quels (Zoé Z3)", async () => {
    await (await load())({ notes: "Coque iPhone 12 13 14 15, pointures 36 37 38 39 40 41, USB 2.0 3.0 3.1. Fournisseur : 01 97 12 34 56, a@b.bj" });
    const user = (callLlmJson.mock.calls[0][0] as { user: string }).user;
    expect(user).toContain("iPhone 12 13 14 15");
    expect(user).toContain("36 37 38 39 40 41");
    expect(user).toContain("USB 2.0 3.0 3.1");
    expect(user).not.toContain("01 97 12 34 56");
    expect(user).not.toContain("a@b.bj");
  });
  it("lien en échec → consigne « notez les caractéristiques de votre article », aucun appel au modèle", async () => {
    fetchPageText.mockResolvedValue({ ok: false, code: "refused", status: 403 });
    const r = await (await load())({ url: "https://boutique.com/p", notes: "" });
    expect(r).toMatchObject({
      ok: false,
      code: "invalid",
      message: "Le site refuse la lecture automatique : notez dans vos notes les caractéristiques de votre article (mesures, matières, contenu de la boîte).",
    });
    expect(callLlmJson).not.toHaveBeenCalled();
  });
  it("lien interdit (SSRF) → message clair", async () => {
    fetchPageText.mockResolvedValue({ ok: false, code: "blocked" });
    const r = await (await load())({ url: "https://intranet.local/p" });
    expect(r).toMatchObject({ ok: false, code: "invalid" });
    if (!r.ok) expect(r.message).toMatch(/pas autorisé/);
  });
  it("sortie LLM illisible → erreur propre ; délai → message dédié", async () => {
    callLlmJson.mockResolvedValue(llmOk("Désolé, je ne peux pas."));
    expect(await (await load())({ notes: "Gourde noire" })).toMatchObject({ ok: false, code: "error", message: "La réponse de l'IA était illisible. Relancez la rédaction." });
    callLlmJson.mockResolvedValue({ ok: false, code: "timeout" });
    const r = await (await load())({ notes: "Gourde noire" });
    expect(r).toMatchObject({ ok: false, code: "error" });
    if (!r.ok) expect(r.message).toMatch(/trop de temps/);
  });
  it("sortie LLM tronquée (max_tokens) → récupérée, champs complets gardés", async () => {
    const full = JSON.stringify(GOOD);
    const cut = full.slice(0, full.indexOf('"detailsEn"') + 30);
    callLlmJson.mockResolvedValue(llmOk(cut, false));
    const r = await (await load())({ notes: "Gourde noire" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.draft.description).toBe(GOOD.descriptionFr);
      expect(r.draft.details.specs).toBe("Contenance : 750 ml\nHauteur : 26 cm");
      expect(r.meta.repaired).toBe(true);
      expect(r.meta.complete).toBe(false);
    }
  });
  it("limiteur : 30 rédactions par heure et par admin", async () => {
    const act = await load();
    for (let i = 0; i < 30; i++) expect((await act({ notes: "Gourde noire" })).ok).toBe(true);
    expect(await act({ notes: "Gourde noire" })).toMatchObject({ ok: false, code: "rate_limited" });
  });
});

describe("parseProductDraft : limites et nettoyage", () => {
  it("applique les limites du formulaire", () => {
    const long = {
      nameFr: `**Gourde** ${"très ".repeat(60)}pratique`,
      descriptionFr: "mot ".repeat(800),
      word: "Gourde isotherme",
      detailsFr: {
        color: "Noir\nBlanc\n- Rouge",
        materials: "x".repeat(400),
        specs: Array.from({ length: 20 }, (_, i) => `- Ligne ${i + 1} : ${i}`).join("\n"),
        highlights: "1. Un\n2. Deux\n3. Trois\n4. Quatre\n5. Cinq\n6. Six",
        uses: ["Bureau", "Sport"],
        care: 42,
      },
    };
    const out = parseProductDraft(JSON.stringify(long));
    expect(out).not.toBeNull();
    const d = out!.draft;
    expect(d.name.length).toBeLessThanOrEqual(120);
    expect(d.name.startsWith("Gourde très")).toBe(true);
    expect(d.description.length).toBeLessThanOrEqual(2000);
    expect(d.keyword).toBe("gourde");
    expect(d.details.color).toBe("Noir, Blanc, Rouge");
    expect(d.details.materials.length).toBeLessThanOrEqual(200);
    expect(d.details.specs.split("\n")).toHaveLength(12);
    expect(d.details.specs.split("\n")[0]).toBe("Ligne 1 : 0");
    expect(d.details.highlights).toBe("Un\nDeux\nTrois\nQuatre\nCinq");
    expect(d.details.uses).toBe("Bureau\nSport");
    expect(d.details.care).toBe("42");
    expect(d.detailsEn).toEqual(EMPTY_DETAILS);
  });
  it("tiret cadratin et markdown retirés ; champ illisible vidé sans perdre le reste", () => {
    const out = parseProductDraft(JSON.stringify({ nameFr: "Lampe — solaire", descriptionFr: { oops: 1 }, detailsFr: { specs: "## Autonomie : 6 h" } }));
    expect(out!.draft.name).toBe("Lampe, solaire");
    expect(out!.draft.description).toBe("");
    expect(out!.draft.details.specs).toBe("Autonomie : 6 h");
    expect(out!.report.dropped).toBe(1);
  });
  it("réponse vide ou sans aucun champ → null", () => {
    expect(parseProductDraft("")).toBeNull();
    expect(parseProductDraft("[]")).toBeNull();
    expect(parseProductDraft(JSON.stringify({ nameFr: "", detailsFr: {} }))).toBeNull();
  });
  it("fromLink : alias, langues, champs vides écartés", () => {
    const base = parseProductDraft(JSON.stringify(GOOD))!.draft;
    expect(normalizeFromLink(["nameFr", "detailsEn.color", "materialsFr", "uses_en", "word", "inconnu", 3], base).sort()).toEqual(
      ["en.color", "en.uses", "fr.materials", "keyword", "name"].sort(),
    );
    // « highlights » est vide dans les deux langues : rien à vérifier.
    expect(normalizeFromLink(["highlights", "care"], base)).toEqual([]);
    expect(normalizeFromLink("descriptionEn, specs", base).sort()).toEqual(["descriptionEn", "en.specs", "fr.specs"]);
    expect(normalizeFromLink(["detailsFr"], base).sort()).toEqual(["fr.color", "fr.materials", "fr.specs", "fr.uses"]);
    expect(normalizeFromLink({ x: 1 }, base)).toEqual([]);
  });
});

describe("application au formulaire", () => {
  const empty: DraftTarget = { name: "", nameEn: "", description: "", descriptionEn: "", keyword: "", details: { ...EMPTY_DETAILS }, detailsEn: { ...EMPTY_DETAILS } };
  const draft = parseProductDraft(JSON.stringify(GOOD))!.draft;

  it("formulaire vide : tout est rempli, aucun conflit", () => {
    expect(draftConflicts(empty, draft)).toEqual([]);
    const { values, filled } = applyDraft(empty, draft, "replace");
    expect(values.name).toBe(draft.name);
    expect(values.details.specs).toBe(draft.details.specs);
    expect(filled).toContain("en.uses");
    expect(empty.details.specs).toBe(""); // pas de mutation
  });
  it("champs déjà remplis : conflit signalé ; « champs vides » garde la saisie, « remplacer » l'écrase", () => {
    const mine = { ...empty, name: "Ma gourde", details: { ...EMPTY_DETAILS, color: "Noir" } };
    expect(draftConflicts(mine, draft)).toEqual(["name"]); // « Noir » identique : pas un conflit
    const keep = applyDraft(mine, draft, "fill-empty");
    expect(keep.values.name).toBe("Ma gourde");
    expect(keep.values.description).toBe(draft.description);
    expect(keep.filled).not.toContain("name");
    expect(applyDraft(mine, draft, "replace").values.name).toBe(draft.name);
  });
  it("un champ laissé vide par l'IA ne touche jamais la saisie", () => {
    const mine = { ...empty, details: { ...EMPTY_DETAILS, care: "Laver à la main" } };
    expect(applyDraft(mine, draft, "replace").values.details.care).toBe("Laver à la main");
  });
});
