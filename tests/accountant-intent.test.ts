import { describe, expect, it } from "vitest";
import { detectCategory, matchProduct, monthFromText, norm, parseAmount, parseIntent } from "@/lib/accountant/intent";

const NOW = Date.UTC(2026, 9, 9, 10, 0); // 9 oct. 2026

describe("parseAmount", () => {
  it.each([
    ["J'ai payé 20 000 F de pub", 20000],
    ["20 000 FCFA", 20000],
    ["15k de pub", 15000],
    ["15 mille", 15000],
    ["1,5 million de stock", 1_500_000],
    ["acheté 125000", 125000],
    ["le 3 octobre 12 500 F", 12500],
  ])("%s", (t, n) => expect(parseAmount(t)).toBe(n));
  it("refuse l'absence ou l'excès de montant", () => {
    expect(parseAmount("bonjour")).toBeNull();
    expect(parseAmount("999 999 999 999 F")).toBeNull();
  });
});

describe("catégories", () => {
  it.each([
    ["pub facebook", "pub"], ["paye le zem", "livraison"], ["cartons", "emballage"], ["facture electricite", "loyer"],
    ["salaire", "salaire"], ["reassort fournisseur", "stock"], ["divers", "autre"],
  ])("%s → %s", (t, c) => expect(detectCategory(norm(t))).toBe(c));
});

describe("parseIntent", () => {
  it("note une dépense avec date relative (hier = veille, Bénin)", () => {
    expect(parseIntent("J'ai payé 20 000 F de pub hier", NOW)).toMatchObject({ kind: "add_expense", amount: 20000, cat: "pub", date: "2026-10-08" });
  });
  it("reprend l'exemple de la maquette", () => {
    expect(parseIntent("Ajoute 15 000 F de pub Facebook aujourd'hui", NOW)).toMatchObject({
      kind: "add_expense", amount: 15000, cat: "pub", date: "2026-10-09", label: "15 000 F de pub Facebook",
    });
  });
  it("une question n'écrit jamais", () => {
    expect(parseIntent("Combien ai-je payé de pub ?", NOW).kind).toBe("ads");
    expect(parseIntent("Quelle est ma marge ce mois-ci ?", NOW).kind).toBe("margin");
  });
  it("prix d'achat", () => {
    expect(parseIntent("prix d'achat lampe 4 500 F", NOW)).toMatchObject({ kind: "set_cost", amount: 4500 });
    expect(parseIntent("quels produits n'ont pas de prix d'achat ?", NOW).kind).toBe("missing");
  });
  it("autres intentions", () => {
    expect(parseIntent("Ma publicité est-elle rentable ?", NOW).kind).toBe("ads");
    expect(parseIntent("Quels produits me rapportent le plus ?", NOW).kind).toBe("top");
    expect(parseIntent("compare avec le mois dernier", NOW).kind).toBe("compare");
    expect(parseIntent("un conseil ?", NOW).kind).toBe("advice");
    expect(parseIntent("mes dépenses par catégorie", NOW).kind).toBe("expenses");
    expect(parseIntent("aide", NOW).kind).toBe("help");
    expect(parseIntent("bonjour", NOW).kind).toBe("summary");
  });
});

describe("monthFromText", () => {
  it("résout un mois cité", () => {
    expect(monthFromText("en septembre", "2026-10")).toBe("2026-09");
    expect(monthFromText("en decembre", "2026-10")).toBe("2025-12");
    expect(monthFromText("le mois dernier", "2026-01")).toBe("2025-12");
    expect(monthFromText("ma marge", "2026-10")).toBeNull();
  });
});

describe("matchProduct", () => {
  const products = [
    { id: "lampe", name: "Lampe LED rechargeable", price: 1, cost: null },
    { id: "ventilo", name: "Mini ventilateur USB", price: 1, cost: null },
    { id: "batterie", name: "Batterie externe", price: 1, cost: null },
  ];
  it("trouve par racine de mot, null si absent", () => {
    expect(matchProduct("prix d'achat de la lampe 4500", products)?.id).toBe("lampe");
    expect(matchProduct("prix d'achat ventilateur", products)?.id).toBe("ventilo");
    expect(matchProduct("prix d'achat tapis", products)).toBeNull();
  });
});
