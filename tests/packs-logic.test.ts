import { describe, expect, it } from "vitest";
import { buildPack, itemCount, itemsTotal, packSaving, packStock, type PackItem } from "@/components/packs/logic";

const item = (over: Partial<PackItem> = {}): PackItem => ({
  productId: "p",
  slug: "p",
  name: "P",
  qty: 1,
  price: 1000,
  stock: 10,
  keyword: "k",
  bg: "#fff",
  imageUrl: null,
  ...over,
});

describe("packs : somme et économie", () => {
  it("somme = Σ prix × quantité", () => {
    expect(itemsTotal([item({ price: 2900 }), item({ price: 3500, qty: 2 })])).toBe(9900);
    expect(itemsTotal([])).toBe(0);
  });

  it("économie exacte et pourcentage arrondi", () => {
    expect(packSaving(8900, 10900)).toEqual({ saving: 2000, percent: 18 });
    expect(packSaving(17900, 21500)).toEqual({ saving: 3600, percent: 17 });
    expect(packSaving(11900, 14900)).toEqual({ saving: 3000, percent: 20 });
  });

  it("jamais d'économie négative ou nulle affichée", () => {
    expect(packSaving(10000, 10000)).toEqual({ saving: 0, percent: 0 });
    expect(packSaving(12000, 10000)).toEqual({ saving: 0, percent: 0 });
    expect(packSaving(500, 0)).toEqual({ saving: 0, percent: 0 });
  });
});

describe("packs : stock = min des stocks / quantité", () => {
  it("plus petit quotient entier", () => {
    expect(packStock([item({ stock: 22 }), item({ stock: 17 }), item({ stock: 26 })])).toBe(17);
    expect(packStock([item({ stock: 9, qty: 2 }), item({ stock: 20, qty: 1 })])).toBe(4);
    expect(packStock([item({ stock: 3, qty: 4 })])).toBe(0);
  });

  it("un produit épuisé épuise le pack", () => {
    expect(packStock([item({ stock: 0 }), item({ stock: 50 })])).toBe(0);
  });

  it("pack vide ou produit manquant = non vendable", () => {
    expect(packStock([])).toBe(0);
    expect(packStock([item({ stock: 10 })], 2)).toBe(0);
  });

  it("stock négatif en entrée ramené à 0", () => {
    expect(packStock([item({ stock: -3 })])).toBe(0);
  });
});

describe("packs : assemblage", () => {
  it("buildPack calcule total, économie, stock et pastel", () => {
    const pack = buildPack({ id: "x", slug: "s", name: "N", description: "D", price: 8900, imageUrl: null }, [
      item({ price: 2900, stock: 22, bg: null }),
      item({ price: 3500, stock: 17, bg: "#abc" }),
      item({ price: 3000, stock: 26 }),
      item({ price: 1500, stock: 48 }),
    ]);
    expect(pack.itemsTotal).toBe(10900);
    expect(pack.saving).toBe(2000);
    expect(pack.savingPercent).toBe(18);
    expect(pack.stock).toBe(17);
    expect(pack.bg).toBe("#abc");
  });

  it("buildPack avec un produit manquant donne un stock de 0", () => {
    const pack = buildPack({ id: "x", slug: "s", name: "N", description: "", price: 100, imageUrl: null }, [item()], 2);
    expect(pack.stock).toBe(0);
  });

  it("itemCount additionne les quantités", () => {
    expect(itemCount([item({ qty: 2 }), item({ qty: 3 })])).toBe(5);
  });
});
