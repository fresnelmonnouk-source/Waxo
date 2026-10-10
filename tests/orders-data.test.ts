import { describe, expect, it } from "vitest";
import adminDemo from "@/lib/demo/admin.json";
import { aggregateClients, filterClients, type ClientProfile } from "@/lib/orders/clients";
import { csvCell, toCsv } from "@/lib/orders/csv";
import { buildDeliveryBoard } from "@/lib/orders/delivery";
import {
  PAGE_SIZE,
  filterOrders,
  filtersToQuery,
  parseOrderFilters,
  parseSelected,
  sanitizeSearch,
  searchOrClause,
} from "@/lib/orders/filters";
import { fmtDate, startOfDayBenin, tourMessage } from "@/lib/orders/format";
import { demoDate, mapDemoOrder, type DemoClient, type DemoOrder } from "@/lib/orders/mapping";
import type { AdminOrder, Courier } from "@/lib/orders/types";
import { courierFieldsSchema, setStatusSchema } from "@/lib/orders/validation";

const NOW = new Date("2026-10-09T12:00:00+01:00").getTime();
const clients = adminDemo.clients as unknown as DemoClient[];
const demo = (adminDemo.orders as unknown as DemoOrder[]).map((o) => mapDemoOrder(o, clients));

function order(p: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    number: "WX-10300",
    createdAt: "2026-10-08T08:00:00.000Z",
    userId: null,
    name: "Awa Test",
    phone: "0197112233",
    email: null,
    address: "Cotonou, rue 12",
    note: null,
    zone: "cotonou",
    pay: "cod",
    status: "nouvelle",
    subtotal: 5000,
    shippingFee: 1000,
    total: 6000,
    paid: false,
    paidAt: null,
    courierId: null,
    codVerified: false,
    deliveredAt: null,
    items: [],
    ...p,
  };
}

describe("export CSV", () => {
  it("neutralise l'injection de formule", () => {
    for (const bad of ["=1+1", "+229", "-5", "@SUM(A1)", "\tx", "\rx"]) {
      expect(csvCell(bad).startsWith("\"'")).toBe(true);
    }
    expect(csvCell("Awa")).toBe('"Awa"');
  });
  it("échappe les guillemets, écrit les nombres tels quels, BOM + séparateur ;", () => {
    expect(csvCell('dit "oui"')).toBe('"dit ""oui"""');
    expect(csvCell(6000)).toBe('"6000"');
    expect(csvCell(null)).toBe('""');
    const csv = toCsv([["a", 1], ["=x", true]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe('"a";"1"\r\n"\'=x";"oui"\r\n');
  });
});

describe("filtres de commandes", () => {
  it("analyse les paramètres d'URL de façon sûre", () => {
    expect(parseOrderFilters({ statut: "livree", periode: "30", q: " Awa ", page: "3" })).toEqual({
      status: "livree",
      period: "30",
      q: "Awa",
      page: 3,
    });
    expect(parseOrderFilters({ statut: "hack", periode: "999", page: "-4" })).toEqual({ status: "all", period: "all", q: "", page: 1 });
    expect(parseSelected({ commande: "wx-10262" })).toBe("WX-10262");
    expect(parseSelected({ commande: "WX-1; drop" })).toBeNull();
  });
  it("assainit la recherche (pas de caractères PostgREST)", () => {
    expect(sanitizeSearch("a,b(c)%_\"d")).toBe("a b c d");
    expect(searchOrClause("Awa 0197")).toContain("phone.ilike.%0197%");
    expect(searchOrClause("Awa")).not.toContain("phone");
    expect(searchOrClause("%,")).toBeNull();
    expect(sanitizeSearch("x".repeat(200)).length).toBe(60);
  });
  it("filtre statut, nom, numéro, téléphone et période", () => {
    expect(demo.length).toBe(adminDemo.orders.length);
    const nouvelles = filterOrders(demo, { status: "nouvelle", q: "", period: "all" }, NOW);
    expect(nouvelles.length).toBe(2);
    expect(filterOrders(demo, { status: "all", q: "zinsou", period: "all" }, NOW).map((o) => o.number)).toContain("WX-10262");
    expect(filterOrders(demo, { status: "all", q: "10262", period: "all" }, NOW)).toHaveLength(1);
    expect(filterOrders(demo, { status: "all", q: "+229 01 67 00 11 22", period: "all" }, NOW).length).toBeGreaterThan(0);
    const w7 = filterOrders(demo, { status: "all", q: "", period: "7" }, NOW);
    expect(w7.every((o) => new Date(o.createdAt).getTime() >= NOW - 7 * 86_400_000)).toBe(true);
    const sorted = filterOrders(demo, { status: "all", q: "", period: "all" }, NOW);
    expect(sorted[0].createdAt >= sorted[sorted.length - 1].createdAt).toBe(true);
  });
  it("reconstruit une query string sans valeurs par défaut", () => {
    expect(filtersToQuery({ status: "all", period: "all", q: "", page: 1 })).toBe("");
    expect(filtersToQuery({ status: "livree", q: "Awa", page: 2 }, { commande: "WX-1" })).toBe("?statut=livree&q=Awa&page=2&commande=WX-1");
    expect(PAGE_SIZE).toBeLessThanOrEqual(200);
  });
});

describe("repli démo", () => {
  it("lit les dates à l'heure du Bénin", () => {
    expect(demoDate("2026-10-08T09:41:00")).toBe("2026-10-08T08:41:00.000Z");
    expect(demoDate("2026-10-08")).toBe("2026-10-07T23:00:00.000Z");
  });
  it("dérive paiement, e-mail et livreur", () => {
    const koffi = demo.find((o) => o.number === "WX-10261");
    expect(koffi).toMatchObject({ userId: "u_koffi", email: "koffi.a@exemple.bj", paid: true, pay: "momo" });
    const cod = demo.find((o) => o.number === "WX-10262");
    expect(cod).toMatchObject({ pay: "cod", paid: false });
    expect(demo.find((o) => o.number === "WX-10258")).toMatchObject({ status: "livraison", courierId: "c1" });
    expect(demo.filter((o) => o.status === "annulee").every((o) => !o.paid)).toBe(true);
  });
});

describe("heure du Bénin", () => {
  it("minuit local = 23 h UTC de la veille", () => {
    expect(new Date(startOfDayBenin(Date.parse("2026-10-09T12:00:00Z"))).toISOString()).toBe("2026-10-08T23:00:00.000Z");
    expect(new Date(startOfDayBenin(Date.parse("2026-10-09T23:30:00Z"))).toISOString()).toBe("2026-10-09T23:00:00.000Z");
  });
  it("formate dans le fuseau du Bénin", () => {
    expect(fmtDate("2026-10-08T23:30:00Z", { day: "numeric", month: "long" })).toContain("9");
    expect(fmtDate(null)).toBe("");
    expect(fmtDate("n'importe quoi")).toBe("");
  });
});

describe("tableau des livraisons", () => {
  const couriers: Courier[] = (adminDemo.couriers as Courier[]).map((c) => ({ ...c }));
  const active = demo.filter((o) => ["nouvelle", "preparation", "livraison"].includes(o.status));
  const board = buildDeliveryBoard({
    active,
    recentDelivered: demo.filter((o) => o.status === "livree").slice(0, 10),
    deliveredToday: 0,
    delivered30: [{ courierId: "c1" }, { courierId: "c1" }, { courierId: "c2" }],
    couriers,
    zone: "all",
    now: NOW,
  });
  it("calcule les indicateurs de la démo", () => {
    expect(board.kpis.toShip).toBe(3);
    expect(board.kpis.toShipNew).toBe(2);
    expect(board.kpis.onRoad).toBe(1);
    expect(board.kpis.couriersOut).toBe(1);
    expect(board.kpis.codDue).toBe(12400);
    expect(board.delivered.length).toBe(6);
  });
  it("filtre par zone mais compte toutes les zones dans les pastilles", () => {
    const autre = buildDeliveryBoard({ active, recentDelivered: [], deliveredToday: 0, delivered30: [], couriers, zone: "autre", now: NOW });
    expect(autre.toShip.every((o) => o.zone === "autre")).toBe(true);
    expect(autre.zoneCounts.all).toBe(board.zoneCounts.all);
  });
  it("cartes livreurs : tournée seulement s'il y a des livraisons et que le livreur est actif", () => {
    const c1 = board.couriers.find((c) => c.id === "c1");
    expect(c1).toMatchObject({ inRoad: 1, delivered30: 2, codDue: 12400 });
    expect(c1?.routeHref).toContain("https://wa.me/2290166112200?text=");
    expect(board.couriers.find((c) => c.id === "c2")?.routeHref).toBeNull();
    const paused = buildDeliveryBoard({
      active,
      recentDelivered: [],
      deliveredToday: 0,
      delivered30: [],
      couriers: couriers.map((c) => ({ ...c, active: false })),
      zone: "all",
      now: NOW,
    });
    expect(paused.couriers.every((c) => c.routeHref === null)).toBe(true);
  });
  it("message de tournée : adresses, téléphones, montants à encaisser", () => {
    const msg = tourMessage([order({ courierId: "c1" }), order({ number: "WX-10301", pay: "momo", paid: true, total: 9000 })], NOW);
    expect(msg).toContain("2 livraisons");
    expect(msg).toContain("1. WX-10300 · Awa Test · 01 97 11 22 33 · Cotonou, rue 12 · À encaisser 6");
    expect(msg).toContain("Déjà payée");
    expect(msg).toContain("Total à encaisser : 6");
  });
});

describe("clients", () => {
  const profiles: ClientProfile[] = clients.map((c) => ({
    id: c.id,
    firstName: c.first,
    lastName: c.last,
    email: c.email,
    phone: c.phone,
    address: c.address,
    news: c.news,
    createdAt: demoDate(c.created),
  }));
  const lites = demo.map((o) => ({ userId: o.userId, total: o.total, status: o.status, createdAt: o.createdAt }));
  it("agrège les commandes hors annulées, tri par dépense décroissante", () => {
    const rows = aggregateClients(profiles, lites);
    expect(rows).toHaveLength(4);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].spent).toBeGreaterThanOrEqual(rows[i].spent);
    const koffi = rows.find((r) => r.id === "u_koffi");
    const expected = demo.filter((o) => o.userId === "u_koffi" && o.status !== "annulee");
    expect(koffi?.orders).toBe(expected.length);
    expect(koffi?.spent).toBe(expected.reduce((a, o) => a + o.total, 0));
    expect(koffi?.initials).toBe("KA");
  });
  it("ignore les commandes annulées et sans compte", () => {
    const rows = aggregateClients(profiles.slice(0, 1), [
      { userId: profiles[0].id, total: 5000, status: "annulee", createdAt: "2026-10-01" },
      { userId: null, total: 9999, status: "livree", createdAt: "2026-10-01" },
    ]);
    expect(rows[0]).toMatchObject({ orders: 0, spent: 0, lastOrderAt: null });
  });
  it("recherche par nom, e-mail, téléphone et filtre newsletter", () => {
    const rows = aggregateClients(profiles, lites);
    expect(filterClients(rows, "houngbedji")).toHaveLength(1);
    expect(filterClients(rows, "mariam.s@")).toHaveLength(1);
    expect(filterClients(rows, "+229 01 61 22 33 44")).toHaveLength(1);
    expect(filterClients(rows, "", true).every((r) => r.news)).toBe(true);
  });
});

describe("validation des actions", () => {
  it("accepte uniquement des uuid et des statuts connus", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect(setStatusSchema.safeParse({ orderId: id, to: "livraison", courierId: id }).success).toBe(true);
    expect(setStatusSchema.safeParse({ orderId: "WX-1", to: "livraison" }).success).toBe(false);
    expect(setStatusSchema.safeParse({ orderId: id, to: "supprimee" }).success).toBe(false);
  });
  it("livreur : nom, téléphone 01XXXXXXXX normalisé, zone", () => {
    const ok = courierFieldsSchema.safeParse({ name: "  Awa K ", phone: "+229 01 97 11 22 33", zone: "autre" });
    expect(ok.success && ok.data).toEqual({ name: "Awa K", phone: "0197112233", zone: "autre" });
    expect(courierFieldsSchema.safeParse({ name: "A", phone: "0197112233", zone: "autre" }).success).toBe(false);
    expect(courierFieldsSchema.safeParse({ name: "Awa", phone: "0297112233", zone: "autre" }).success).toBe(false);
    expect(courierFieldsSchema.safeParse({ name: "Awa", phone: "0197112233", zone: "mars" }).success).toBe(false);
  });
});
