import { describe, expect, it } from "vitest";
import {
  clampQty,
  DEFAULT_SHIPPING,
  enabledPayMethods,
  freeShippingPercent,
  freeShippingRemaining,
  isMobileMoney,
  shippingFee,
} from "@/lib/checkout/shipping";

const cfg = DEFAULT_SHIPPING; // 1000 / 2500 / franco 15 000

describe("shippingFee", () => {
  it("applique le tarif de la zone sous le franco", () => {
    expect(shippingFee(5000, "cotonou", cfg)).toBe(1000);
    expect(shippingFee(5000, "autre", cfg)).toBe(2500);
  });
  it("franco exact : 15 000 F est offert, 14 999 F ne l'est pas", () => {
    expect(shippingFee(15000, "cotonou", cfg)).toBe(0);
    expect(shippingFee(14999, "cotonou", cfg)).toBe(1000);
  });
  it("hors Cotonou : jamais de franco (règle de la maquette)", () => {
    expect(shippingFee(15000, "autre", cfg)).toBe(2500);
    expect(shippingFee(1_000_000, "autre", cfg)).toBe(2500);
  });
  it("franco à 0 = désactivé (règle de place_order)", () => {
    const noFree = { ...cfg, freeFrom: 0 };
    expect(shippingFee(1_000_000, "cotonou", noFree)).toBe(1000);
  });
  it("respecte des tarifs personnalisés", () => {
    expect(shippingFee(100, "autre", { ...cfg, autre: 3000 })).toBe(3000);
  });
});

describe("franco : progression", () => {
  it("calcule le reste à dépenser", () => {
    expect(freeShippingRemaining(12000, cfg)).toBe(3000);
    expect(freeShippingRemaining(15000, cfg)).toBe(0);
    expect(freeShippingRemaining(20000, cfg)).toBe(0);
    expect(freeShippingRemaining(100, { ...cfg, freeFrom: 0 })).toBe(0);
  });
  it("borne la barre entre 0 et 100", () => {
    expect(freeShippingPercent(0, cfg)).toBe(0);
    expect(freeShippingPercent(7500, cfg)).toBe(50);
    expect(freeShippingPercent(99999, cfg)).toBe(100);
  });
});

describe("moyens de paiement", () => {
  it("garde l'ordre de la maquette et retire les moyens désactivés", () => {
    expect(enabledPayMethods(undefined)).toEqual(["momo", "moov", "celtiis", "carte", "cod"]);
    expect(enabledPayMethods({ cod: false, moov: false })).toEqual(["momo", "celtiis", "carte"]);
  });
  it("repère le Mobile Money", () => {
    expect(isMobileMoney("momo")).toBe(true);
    expect(isMobileMoney("celtiis")).toBe(true);
    expect(isMobileMoney("carte")).toBe(false);
    expect(isMobileMoney("cod")).toBe(false);
  });
});

describe("clampQty", () => {
  it("borne par le stock et par 99", () => {
    expect(clampQty(5, 3)).toBe(3);
    expect(clampQty(150, null)).toBe(99);
    expect(clampQty(-2, 10)).toBe(0);
    expect(clampQty(2.9, 10)).toBe(2);
    expect(clampQty(Number.NaN, 10)).toBe(0);
  });
});
