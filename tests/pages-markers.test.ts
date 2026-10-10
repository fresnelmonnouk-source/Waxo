import { describe, expect, it } from "vitest";
import { MARKER_DOCS, makeMarkerResolver, type MarkerContext } from "@/lib/pages/markers";
import { EMPTY_LEGAL, LEGAL_KEYS, normalizeLegal } from "@/lib/pages/types";

const shop = {
  brand: { shopName: "Wá xɔ", whatsapp: "+229 01 00 00 00 00", email: "contact@waxo.bj" },
  shipping: { cotonou: 1000, autre: 2500, freeFrom: 15000, cutoff: 18, returnDays: 7 },
  pay: { cod: true },
};
const ctx = (over: Partial<MarkerContext> = {}): MarkerContext => ({ locale: "fr", shop, legal: { ...EMPTY_LEGAL }, ...over });
const text = (c: MarkerContext, key: string) => {
  const r = makeMarkerResolver(c)(key);
  return r.status === "ok" ? r.text : r.status;
};
const days = (n: number) => ({ ...shop, shipping: { ...shop.shipping, returnDays: n } });

describe("pages : marqueurs de réglages", () => {
  it("formate les montants en F (espace insécable) et le délai de retour au pluriel de la langue", () => {
    expect(text(ctx(), "shipping.freeFrom")).toBe((15000).toLocaleString("fr-FR") + " F");
    expect(text(ctx(), "shipping.cotonou")).toBe((1000).toLocaleString("fr-FR") + " F");
    expect(text(ctx(), "shipping.returnDays")).toBe("7 jours");
    expect(text(ctx({ shop: days(1) }), "shipping.returnDays")).toBe("1 jour");
    expect(text(ctx({ shop: days(0) }), "shipping.returnDays")).toBe("0 jour");
    expect(text(ctx({ locale: "en" }), "shipping.returnDays")).toBe("7 days");
    expect(text(ctx({ locale: "en", shop: days(1) }), "shipping.returnDays")).toBe("1 day");
    expect(text(ctx(), "shipping.cutoff")).toBe("18");
  });
  it("les mentions « paiement à la livraison » disparaissent si le paiement est coupé", () => {
    expect(text(ctx(), "pay.codCgv")).toContain("paiement à la livraison");
    expect(text(ctx({ locale: "en" }), "pay.codShip")).toContain("payment on delivery");
    const off = ctx({ shop: { ...shop, pay: { cod: false } } });
    expect(text(off, "pay.codCgv")).toBe("");
    expect(text(off, "pay.codShip")).toBe("");
  });
  it("une valeur légale vide rend « à compléter », renseignée rend la valeur, inconnue reste inconnue", () => {
    expect(makeMarkerResolver(ctx())("legal.companyName")).toEqual({ status: "empty", label: "[à compléter]" });
    expect(makeMarkerResolver(ctx({ locale: "en" }))("legal.ifu")).toEqual({ status: "empty", label: "[to be completed]" });
    expect(text(ctx({ legal: { ...EMPTY_LEGAL, ifu: "123" } }), "legal.ifu")).toBe("123");
    expect(text(ctx(), "legal.nope")).toBe("unknown");
    expect(text(ctx(), "constructor")).toBe("unknown");
    expect(text(ctx(), "__proto__")).toBe("unknown");
  });
  it("le catalogue d'insertion couvre toutes les clés légales et chaque clé se résout", () => {
    for (const k of LEGAL_KEYS) expect(MARKER_DOCS.some((m) => m.key === `legal.${k}`), k).toBe(true);
    const full = ctx({ legal: Object.fromEntries(LEGAL_KEYS.map((k) => [k, "v"])) as typeof EMPTY_LEGAL });
    for (const m of MARKER_DOCS) expect(text(full, m.key), m.key).not.toBe("unknown");
  });
  it("normalizeLegal ne garde que les clés connues, en chaînes rognées", () => {
    const n = normalizeLegal({ companyName: "  Waxo SARL ", ifu: 42, evil: "x", address: "a".repeat(900) });
    expect(n.companyName).toBe("Waxo SARL");
    expect(n.ifu).toBe("");
    expect("evil" in n).toBe(false);
    expect(n.address.length).toBe(500);
    expect(normalizeLegal(null)).toEqual(EMPTY_LEGAL);
    expect(normalizeLegal("x")).toEqual(EMPTY_LEGAL);
  });
});
