import { describe, expect, it } from "vitest";
import { accountFor, answerAds, answerAdvice, answerCompare, answerExpenses, answerMargin, answerTopProducts, beninDate, monthKeyOf, monthsOf, prevMonthKey } from "@/lib/accountant/engine";
import { fmtXof } from "@/lib/money";
import { DATA } from "./accountant-fixture";

describe("dates", () => {
  it("lit un mois sans fuseau tel quel et décale les UTC vers le Bénin", () => {
    expect(monthKeyOf("2026-10-08T09:41:00")).toBe("2026-10");
    expect(monthKeyOf("2026-10-31")).toBe("2026-10");
    expect(monthKeyOf("2026-10-31T23:30:00Z")).toBe("2026-11");
    expect(monthKeyOf("")).toBe("");
  });
  it("beninDate = UTC+1 avec décalage en jours", () => {
    expect(beninDate(Date.UTC(2026, 9, 9, 23, 30))).toBe("2026-10-10");
    expect(beninDate(Date.UTC(2026, 9, 9, 12), -1)).toBe("2026-10-08");
  });
  it("mois précédent à cheval sur l'année", () => {
    expect(prevMonthKey("2026-01")).toBe("2025-12");
    expect(prevMonthKey("2026-10")).toBe("2026-09");
  });
  it("liste les mois connus du plus récent au plus ancien", () => {
    expect(monthsOf(DATA, "2026-10")).toEqual(["2026-10", "2026-09"]);
  });
});

describe("accountFor", () => {
  const a = accountFor(DATA, "2026-10");
  it("exclut les commandes annulées", () => {
    expect(a.orders).toBe(3);
    expect(a.sales).toBe(17800 + 6000 + 5000);
    expect(a.shipF).toBe(2000);
    expect(a.ca).toBe(30800);
  });
  it("calcule coût d'achat, marge brute et signale les coûts manquants", () => {
    expect(a.cogs).toBe(4600 * 2 + 3100);
    expect(a.gross).toBe(30800 - 12300);
    expect(a.missing).toEqual(["Gourde isotherme"]);
  });
  it("sépare achats de stock (trésorerie) et charges", () => {
    expect(a.stockBuy).toBe(200000);
    expect(a.opex).toBe(15000);
    expect(a.net).toBe(a.gross - 15000);
  });
  it("calcule le retour sur pub", () => {
    expect(a.roas).toBeCloseTo(28800 / 10000);
    expect(accountFor(DATA, "2026-08").roas).toBeNull();
  });
  it("trie les produits par marge", () => {
    expect(a.byP[0].name).toBe("Lampe LED rechargeable");
    expect(a.byP[0].margin).toBe((8900 - 4600) * 2);
  });
  it("un mois vide ne divise pas par zéro", () => {
    const e = accountFor(DATA, "2025-01");
    expect(e.grossPct).toBe(0);
    expect(e.net).toBe(0);
  });
});

describe("réponses", () => {
  const a = accountFor(DATA, "2026-10");
  const p = accountFor(DATA, "2026-09");
  it("marge : chiffres et alerte de coût manquant", () => {
    const t = answerMargin(a).text;
    expect(t).toContain(fmtXof(18500));
    expect(t).toContain("Gourde isotherme");
  });
  it("pub : ratio, seuil de rentabilité et verdict", () => {
    const t = answerAds(a).text;
    expect(t).toContain(`${fmtXof(10000)} de publicité`);
    expect(t).toContain("2,9");
    expect(answerAds(accountFor(DATA, "2026-08")).text).toContain("Aucune dépense de publicité");
  });
  it("top produits", () => {
    expect(answerTopProducts(a).text).toContain(`Lampe LED rechargeable (${fmtXof(8600)} de marge)`);
    expect(answerTopProducts(accountFor(DATA, "2026-08")).text).toContain("Pas encore de vente");
  });
  it("dépenses par catégorie, stock à part", () => {
    const t = answerExpenses(a).text;
    expect(t).toContain(`Achat de stock ${fmtXof(200000)}`);
    expect(t).toContain("pas déduits du résultat");
  });
  it("comparaison mois sur mois, mois courant signalé partiel", () => {
    const t = answerCompare(a, p, true).text;
    expect(t).toContain("septembre 2026");
    expect(t).toContain("pas terminé");
    expect(answerCompare(a, accountFor(DATA, "2026-07"), false).text).toContain("comparaison impossible");
  });
  it("conseils basés sur les chiffres", () => {
    expect(answerAdvice(a, p).text).toContain("Gourde isotherme");
  });
});
