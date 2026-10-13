import { describe, expect, it } from "vitest";
import { parseAnalysis, parseKbDraft, parseLenient, tidy } from "@/lib/admin/ai/schema";

const FULL = {
  issues: [
    { severity: "conseil", where: "Accueil", problem: "Le titre peut être plus précis.", suggestion: "Ajouter Calavi." },
    { severity: "critique", where: "FAQ, question 3", problem: "La FAQ annonce la carte bancaire alors qu'elle est désactivée.", suggestion: "Retirer la carte." },
    { severity: "Important", where: "Page Livraison", problem: "Le coût du renvoi hors Cotonou n'est pas précisé.", suggestion: "Préciser." },
  ],
  missingTopics: [{ topic: "Retours hors Cotonou", why: "Question fréquente." }],
  kbDrafts: [
    { tag: "Retours", title: "Retourner un article hors Cotonou", text: "Vous pouvez retourner un article sous 7 jours. Le renvoi est à votre charge, sauf produit défectueux.", keywords: "retour renvoi parakou" },
    { tag: "Paiement", title: "Payer à la livraison", text: "Vous pouvez payer à la livraison, en espèces ou par Mobile Money à la porte.", keywords: ["cash", "espèces"] },
  ],
};

describe("parseAnalysis : JSON complet", () => {
  it("valide, trie par gravité, normalise les gravités et les mots-clés", () => {
    const r = parseAnalysis(JSON.stringify(FULL));
    expect(r).not.toBeNull();
    expect(r!.report).toEqual({ repaired: false, dropped: 0 });
    expect(r!.analysis.issues.map((i) => i.severity)).toEqual(["critique", "important", "conseil"]);
    expect(r!.analysis.kbDrafts[1].keywords).toBe("cash espèces");
    expect(r!.analysis.missingTopics).toHaveLength(1);
  });

  it("tolère les blocs ```json et le texte autour", () => {
    const r = parseAnalysis("Voici l'analyse :\n```json\n" + JSON.stringify(FULL) + "\n```\nBonne journée");
    expect(r!.analysis.issues).toHaveLength(3);
  });

  it("écarte les éléments invalides sans rejeter le reste", () => {
    const bad = { ...FULL, issues: [...FULL.issues, { severity: "inconnu", where: "x", problem: "y y y y y" }, { where: "sans gravité" }], kbDrafts: [...FULL.kbDrafts, { tag: "Retours", title: "Trop court", text: "court" }] };
    const r = parseAnalysis(JSON.stringify(bad));
    expect(r!.analysis.issues).toHaveLength(3);
    expect(r!.analysis.kbDrafts).toHaveLength(2);
    expect(r!.report.dropped).toBe(3);
  });

  it("thème inconnu → « Autre » ; tiret cadratin remplacé", () => {
    const r = parseAnalysis(JSON.stringify({ issues: [], missingTopics: [], kbDrafts: [{ tag: "Divers", title: "Horaires — équipe", text: "Notre équipe répond — sur WhatsApp — tous les jours de 8 h à 20 h.", keywords: "" }] }));
    expect(r!.analysis.kbDrafts[0].tag).toBe("Autre");
    expect(r!.analysis.kbDrafts[0].title).toBe("Horaires, équipe");
    expect(r!.analysis.kbDrafts[0].text).not.toContain("—");
  });

  it("listes vides acceptées (« tout est correct »)", () => {
    expect(parseAnalysis('{"issues":[],"missingTopics":[],"kbDrafts":[]}')!.analysis.issues).toEqual([]);
  });
});

describe("parseAnalysis : JSON tronqué (max_tokens ou délai)", () => {
  const json = JSON.stringify(FULL);

  it("coupé au milieu d'une fiche proposée : problèmes et sujets gardés", () => {
    const cut = json.slice(0, json.indexOf("Payer à la livraison") + 5);
    const r = parseAnalysis(cut);
    expect(r).not.toBeNull();
    expect(r!.report.repaired).toBe(true);
    expect(r!.analysis.issues).toHaveLength(3);
    expect(r!.analysis.missingTopics).toHaveLength(1);
    expect(r!.analysis.kbDrafts).toHaveLength(1);
  });

  it("coupé au milieu d'une chaîne d'un problème : les problèmes complets sont gardés", () => {
    const cut = json.slice(0, json.indexOf("Le coût du renvoi") + 8);
    const r = parseAnalysis(cut);
    expect(r!.analysis.issues.map((i) => i.where)).toEqual(["FAQ, question 3", "Accueil"]);
    expect(r!.analysis.kbDrafts).toEqual([]);
  });

  it("chaque préfixe du JSON se parse sans exception", () => {
    for (let n = 0; n <= json.length; n += 7) expect(() => parseAnalysis(json.slice(0, n))).not.toThrow();
  });

  it("réponse illisible → null", () => {
    expect(parseAnalysis("Désolé, je ne peux pas.")).toBeNull();
    expect(parseAnalysis("")).toBeNull();
    expect(parseAnalysis('{"autre":1}')).toBeNull();
    expect(parseLenient("[1,2")).toBeNull();
  });
});

describe("parseKbDraft", () => {
  const d = { tag: "retours", title: "Retours hors Cotonou", text: "Le renvoi est à votre charge, sauf produit défectueux ou erreur de notre part. Délai : [à confirmer].", keywords: "retour" };
  it("objet direct, enveloppe { draft }, thème insensible à la casse", () => {
    expect(parseKbDraft(JSON.stringify(d))!.tag).toBe("Retours");
    expect(parseKbDraft(JSON.stringify({ draft: d }))!.title).toBe("Retours hors Cotonou");
  });
  it("tronqué dans le texte → null (pas de fiche à moitié écrite)", () => {
    const s = JSON.stringify(d);
    expect(parseKbDraft(s.slice(0, s.indexOf("charge")))).toBeNull();
  });
  it("tronqué après le texte (mots-clés manquants) → fiche gardée", () => {
    const s = JSON.stringify(d);
    expect(parseKbDraft(s.slice(0, s.indexOf(',"keywords"')))!.keywords).toBe("");
  });
});

describe("tidy", () => {
  it("normalise espaces et retours à la ligne", () => {
    expect(tidy("  a — b \r\n\n\n\nc  ")).toBe("a, b\n\nc");
  });
});
