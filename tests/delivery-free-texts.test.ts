// Textes « livraison offerte par article ou pack » (validés par le propriétaire le 2026-10-15) : présents en FR et EN,
// avec les variables attendues, et jamais de promesse sans condition.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const load = (lang: string, file: string) =>
  JSON.parse(readFileSync(new URL(`../src/messages/${lang}/${file}.json`, import.meta.url), "utf8")) as Record<string, Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe.each(["fr", "en"] as const)("textes livraison offerte (%s)", (lang) => {
  const assistant = load(lang, "assistant");
  const account = load(lang, "account");
  const common = load(lang, "common");
  const checkout = load(lang, "checkout");

  it("la réponse de l'assistant garde ses variables et annonce la règle des articles à livraison offerte", () => {
    const text: string = assistant.Assistant.reply.delivery;
    for (const v of ["{cutoff}", "{cotonou}", "{free}", "{autre}"]) expect(text).toContain(v);
    expect(text).toMatch(lang === "fr" ? /tous les articles de votre panier/ : /every item in your cart/);
    expect(text).not.toMatch(/tous nos articles|all our (items|products)/i);
  });

  it("la page Livraison et retours (repli) décrit la règle : un seul frais, case du pack propre au pack, hors zone inchangé", () => {
    const s = account.Legal.shipping;
    for (const k of ["freeH", "freeP1", "freeP2", "freeP3"]) expect(typeof s[k]).toBe("string");
    expect(s.freeP2).toContain("{cotonou}");
    expect(s.freeP2).toContain("{freeShip}");
    expect(s.freeP3).toContain("{autre}");
    expect(s.r1f).toContain(lang === "fr" ? "livraison offerte" : "free delivery");
  });

  it("la note de la fiche dit « article à livraison offerte » (pas une promesse sans condition) et rappelle le tarif habituel", () => {
    expect(common.Express.noteZoneFreeProduct).toMatch(lang === "fr" ? /article à livraison offerte/ : /free-delivery item/);
    expect(common.Express.noteFreeProductCond).toMatch(lang === "fr" ? /tarif habituel/ : /usual fee/);
  });

  it("le panier explique pourquoi la livraison redevient payante quand un article n'est pas à livraison offerte", () => {
    expect(typeof checkout.Cart.mixedFree).toBe("string");
    expect(checkout.Cart.mixedFree.length).toBeGreaterThan(20);
  });

  it("les CGV (repli) disent qu'un seul frais est compté par commande", () => {
    const p: string = account.Legal.cgv.s6.p;
    expect(p).toMatch(lang === "fr" ? /Un seul frais de livraison est compté par commande/ : /One delivery fee is charged per order/);
  });
});
