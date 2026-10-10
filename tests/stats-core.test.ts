import { describe, expect, it } from "vitest";
import adminDemo from "@/lib/demo/admin.json";
import catalogDemo from "@/lib/demo/catalog.json";
import {
  adBreakEven,
  checkEntry,
  computeAccount,
  computeDashboard,
  computeStats,
  csvCell,
  dayKeyOf,
  deltaPct,
  isMonthKey,
  ledgerCsv,
  listMonths,
  marginRate,
  monthKeyOf,
  normPhone,
  parseAmount,
  parseTs,
  toCsv,
  watParts,
  type LedgerEntry,
  type StatOrder,
  type StatProduct,
} from "@/lib/stats";

const NOW = parseTs("2026-10-09T12:00:00");

function order(over: Partial<StatOrder> & { id: string; date: string }): StatOrder {
  return {
    number: over.id,
    name: "Client",
    phone: "0197112233",
    zone: "cotonou",
    pay: "momo",
    status: "livree",
    sub: 10000,
    ship: 1000,
    total: 11000,
    items: [{ pid: "a", name: "Produit A", price: 10000, qty: 1 }],
    ...over,
  };
}
const prod = (over: Partial<StatProduct> & { id: string }): StatProduct => ({
  name: over.id,
  cat: "maison",
  price: 10000,
  cost: 6000,
  stock: 10,
  sold: 0,
  active: true,
  bg: null,
  imageUrl: null,
  ...over,
});

describe("calendrier du Bénin", () => {
  it("lit les dates sans fuseau en heure du Bénin (UTC+1)", () => {
    expect(new Date(parseTs("2026-10-08T09:41:00")).toISOString()).toBe("2026-10-08T08:41:00.000Z");
    expect(new Date(parseTs("2026-10-08")).toISOString()).toBe("2026-10-07T23:00:00.000Z");
  });
  it("classe 23 h 30 UTC dans le jour suivant au Bénin", () => {
    const ts = Date.parse("2026-10-08T23:30:00Z");
    expect(dayKeyOf(ts)).toBe("2026-10-09");
    expect(monthKeyOf(Date.parse("2026-09-30T23:30:00Z"))).toBe("2026-10");
  });
  it("jour de semaine : lundi = 0", () => {
    expect(watParts(parseTs("2026-10-05T10:00:00")).wd).toBe(0);
    expect(watParts(parseTs("2026-10-11T10:00:00")).wd).toBe(6);
  });
  it("valide les clés de mois", () => {
    expect(isMonthKey("2026-10")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-1")).toBe(false);
    expect(isMonthKey(undefined)).toBe(false);
  });
});

describe("tableau de bord", () => {
  it("calcule CA 30 j hors annulées, à traiter (anciennes d'abord) et stock faible", () => {
    const orders = [
      order({ id: "o1", date: "2026-10-08T10:00:00", status: "nouvelle", total: 7000 }),
      order({ id: "o2", date: "2026-10-05T10:00:00", status: "preparation", total: 5000 }),
      order({ id: "o3", date: "2026-10-01T10:00:00", status: "annulee", total: 99999 }),
      order({ id: "o4", date: "2026-08-01T10:00:00", status: "livree", total: 40000 }),
    ];
    const products = [prod({ id: "a", stock: 5, sold: 3 }), prod({ id: "b", stock: 6 }), prod({ id: "c", stock: 0, sold: 9 }), prod({ id: "d", stock: 1, active: false })];
    const d = computeDashboard(orders, products, NOW);
    expect(d.rev30).toBe(12000);
    expect(d.count30).toBe(2);
    expect(d.avg30).toBe(6000);
    expect(d.todo.map((o) => o.id)).toEqual(["o2", "o1"]);
    expect(d.newCount).toBe(1);
    expect(d.low.map((p) => p.id)).toEqual(["c", "a"]);
    expect(d.topSold[0].id).toBe("c");
  });
  it("gère l'absence de commandes", () => {
    const d = computeDashboard([], [], NOW);
    expect(d.avg30).toBe(0);
    expect(d.todo).toEqual([]);
  });
});

describe("statistiques", () => {
  const orders = [
    order({ id: "o1", date: "2026-10-08T10:00:00", total: 11000, pay: "momo", zone: "cotonou" }),
    order({ id: "o2", date: "2026-10-08T15:00:00", total: 6000, pay: "cod", zone: "autre", phone: "+229 01 97 11 22 33" }),
    order({ id: "o3", date: "2026-10-07T09:00:00", total: 3000, status: "annulee" }),
    order({ id: "o4", date: "2026-09-30T09:00:00", total: 8000 }),
  ];
  it("agrège la période et compare avec la précédente", () => {
    const s = computeStats(orders, [prod({ id: "a", cat: "tech" })], 7, NOW);
    expect(s.ca).toBe(17000);
    expect(s.count).toBe(2);
    expect(s.avg).toBe(8500);
    expect(s.prevCount).toBe(1);
    expect(s.prevCa).toBe(8000);
    expect(s.cancelledCount).toBe(1);
    expect(s.cancelRate).toBeCloseTo(1 / 3);
    expect(s.buyers).toBe(1); // même numéro, formats différents
    expect(s.bars).toHaveLength(7);
    expect(s.bars[s.bars.length - 1].v).toBe(0); // aujourd'hui (9 oct) sans vente
    expect(s.bars[s.bars.length - 2].v).toBe(17000); // 8 oct
    expect(s.byCategory[0].key).toBe("tech");
    expect(s.byPay.map((r) => r.key).sort()).toEqual(["cod", "momo"]);
    expect(s.weekCounts[3]).toBe(2); // jeudi 8 octobre
  });
  it("90 jours : 13 barres hebdomadaires", () => {
    expect(computeStats(orders, [], 90, NOW).bars).toHaveLength(13);
  });
  it("variation null sans base de comparaison", () => {
    expect(deltaPct(10, 0)).toBeNull();
    expect(deltaPct(150, 100)).toBe(0.5);
  });
  it("normalise les numéros béninois", () => {
    expect(normPhone("+229 01 97 11 22 33")).toBe("0197112233");
    expect(normPhone("00229 0197112233")).toBe("0197112233");
    expect(normPhone("0197112233")).toBe("0197112233");
  });
  it("tourne sur les données de démonstration sans erreur", () => {
    const costs = adminDemo.cost as Record<string, number>;
    const products = catalogDemo.products.map((p) =>
      prod({ id: p.id, name: p.fr.name, cat: p.categoryId, price: p.price, cost: costs[p.id] ?? null, stock: p.stock, sold: p.sold }),
    );
    const demoOrders = adminDemo.orders.map((o) =>
      order({ id: o.id, date: o.date, status: o.status as StatOrder["status"], total: o.total, sub: o.sub, ship: o.ship, items: o.items }),
    );
    const s = computeStats(demoOrders, products, 30, NOW);
    expect(s.count).toBeGreaterThan(0);
    expect(s.topRev.length).toBeGreaterThan(0);
    expect(s.byCategory.every((r) => r.share >= 0 && r.share <= 1)).toBe(true);
  });
});

describe("carnet de comptes", () => {
  const products = [prod({ id: "a", price: 10000, cost: 6000 }), prod({ id: "b", price: 5000, cost: null })];
  const orders = [
    order({ id: "o1", date: "2026-10-02T10:00:00", sub: 20000, ship: 1000, total: 21000, items: [{ pid: "a", name: "A", price: 10000, qty: 2 }] }),
    order({ id: "o2", date: "2026-10-03T10:00:00", sub: 5000, ship: 0, total: 5000, items: [{ pid: "b", name: "B", price: 5000, qty: 1 }] }),
    order({ id: "o3", date: "2026-10-04T10:00:00", status: "annulee", sub: 9999, ship: 0, total: 9999, items: [{ pid: "a", name: "A", price: 10000, qty: 1 }] }),
    order({ id: "o4", date: "2026-09-04T10:00:00", sub: 10000, ship: 1000, total: 11000 }),
  ];
  const ledger: LedgerEntry[] = [
    { id: "l1", date: "2026-10-05", cat: "pub", label: "Pub", amount: 5000 },
    { id: "l2", date: "2026-10-06", cat: "stock", label: "Réassort", amount: 100000 },
    { id: "l3", date: "2026-09-30", cat: "loyer", label: "Loyer", amount: 40000 },
  ];
  it("compte de résultat : stock exclu des charges, annulées exclues, coût manquant signalé", () => {
    const a = computeAccount("2026-10", orders, products, ledger);
    expect(a.orders).toBe(2);
    expect(a.sales).toBe(25000);
    expect(a.shipF).toBe(1000);
    expect(a.ca).toBe(26000);
    expect(a.cogs).toBe(12000);
    expect(a.gross).toBe(14000);
    expect(a.opex).toBe(5000);
    expect(a.stockBuy).toBe(100000);
    expect(a.net).toBe(9000);
    expect(a.roas).toBe(5);
    expect(a.missing).toEqual(["B"]);
    expect(a.byProduct[0].pid).toBe("a");
    expect(a.entries).toHaveLength(2);
  });
  it("mois triés du plus récent, mois courant toujours présent", () => {
    expect(listMonths(orders, ledger, NOW)).toEqual(["2026-10", "2026-09"]);
    expect(listMonths([], [], NOW)).toEqual(["2026-10"]);
  });
  it("marge et seuil de rentabilité pub", () => {
    expect(marginRate(10000, 6000)).toBeCloseTo(0.4);
    expect(marginRate(10000, null)).toBeNull();
    expect(adBreakEven(0.5)).toBe(2);
    expect(adBreakEven(0)).toBe(100);
  });
  it("coût d'un pack porté par la ligne de commande", () => {
    const o = order({ id: "p1", date: "2026-10-02T10:00:00", sub: 9000, ship: 0, total: 9000, items: [{ pid: "pack:x", name: "Pack", price: 9000, qty: 1, cost: 5000 }] });
    const a = computeAccount("2026-10", [o], products, []);
    expect(a.cogs).toBe(5000);
    expect(a.missing).toEqual([]);
  });
});

describe("saisie d'une écriture", () => {
  const today = "2026-10-09";
  it("accepte une écriture valide et normalise le montant", () => {
    const r = checkEntry({ date: "2026-10-05", cat: "pub", label: "  Pub   Facebook ", amount: "15 000 F" }, today);
    expect(r).toEqual({ ok: true, value: { date: "2026-10-05", cat: "pub", label: "Pub Facebook", amount: 15000 } });
  });
  it("date absente = aujourd'hui", () => {
    const r = checkEntry({ cat: "autre", label: "Divers", amount: 100 }, today);
    expect(r.ok && r.value.date).toBe(today);
  });
  it("refuse montant nul, libellé court, date impossible, catégorie inconnue", () => {
    expect(checkEntry({ cat: "pub", label: "Pub", amount: "" }, today)).toMatchObject({ ok: false, field: "amount" });
    expect(checkEntry({ cat: "pub", label: "P", amount: 10 }, today)).toMatchObject({ ok: false, field: "label" });
    expect(checkEntry({ date: "2026-02-31", cat: "pub", label: "Pub", amount: 10 }, today)).toMatchObject({ ok: false, field: "date" });
    expect(checkEntry({ cat: "hack", label: "Pub", amount: 10 }, today)).toMatchObject({ ok: false, field: "cat" });
    expect(checkEntry({ cat: "pub", label: "x".repeat(121), amount: 10 }, today)).toMatchObject({ ok: false, field: "label" });
  });
  it("parseAmount : chiffres seuls, plafonné, jamais négatif", () => {
    expect(parseAmount("1 250,5")).toBe(12505);
    expect(parseAmount(-5)).toBe(0);
    expect(parseAmount(Number.NaN)).toBe(0);
    expect(parseAmount("99999999999999")).toBe(2_000_000_000);
  });
});

describe("export CSV", () => {
  it("neutralise les formules et double les guillemets", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell("+33")).toBe(`"'+33"`);
    expect(csvCell("-1")).toBe(`"'-1"`);
    expect(csvCell("@cmd")).toBe(`"'@cmd"`);
    expect(csvCell('dit "oui"')).toBe(`"dit ""oui"""`);
    expect(csvCell(5000)).toBe('"5000"');
  });
  it("BOM UTF-8, séparateur point-virgule, plus récent d'abord", () => {
    const csv = ledgerCsv([
      { id: "1", date: "2026-10-01", cat: "pub", label: "A", amount: 1 },
      { id: "2", date: "2026-10-05", cat: "stock", label: "=B", amount: 2 },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe('"Date";"Catégorie";"Libellé";"Montant (F)"');
    expect(lines[1]).toBe(`"2026-10-05";"Achat de stock";"'=B";"2"`);
  });
  it("toCsv sans ligne", () => {
    expect(toCsv([])).toBe("﻿\r\n");
  });
});
