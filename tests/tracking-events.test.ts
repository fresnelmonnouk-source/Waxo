import { describe, expect, it } from "vitest";
import {
  cartAdditions,
  eventValue,
  isCatalogPath,
  isCheckoutPath,
  isThanksPath,
  productSlugFromPath,
  sanitizePayload,
  stripLocale,
  toGa,
  toMeta,
} from "@/lib/tracking/events";

const items = [
  { id: "p1", name: "Savon", price: 2500, quantity: 2 },
  { id: "p2", name: "Seau", price: 1000, quantity: 1 },
];

describe("événements : GA4", () => {
  it("add_to_cart : valeur en XOF calculée depuis les lignes", () => {
    const c = toGa({ name: "add_to_cart", items });
    expect(c.name).toBe("add_to_cart");
    expect(c.params.currency).toBe("XOF");
    expect(c.params.value).toBe(6000);
    expect(c.params.items).toEqual([
      { item_id: "p1", item_name: "Savon", price: 2500, quantity: 2 },
      { item_id: "p2", item_name: "Seau", price: 1000, quantity: 1 },
    ]);
  });
  it("purchase : transaction_id et valeur explicite prioritaires", () => {
    const c = toGa({ name: "purchase", transactionId: "WX-1042", value: 7500, items });
    expect(c.params).toMatchObject({ transaction_id: "WX-1042", value: 7500, currency: "XOF" });
  });
  it("search / generate_lead / sign_up", () => {
    expect(toGa({ name: "search", searchTerm: "seau" })).toEqual({ name: "search", params: { search_term: "seau" } });
    expect(toGa({ name: "generate_lead" }).name).toBe("generate_lead");
    expect(toGa({ name: "sign_up" }).params).toEqual({ method: "email" });
  });
});

describe("événements : Meta Pixel", () => {
  it("noms standards Meta", () => {
    expect(toMeta({ name: "view_item", items }).name).toBe("ViewContent");
    expect(toMeta({ name: "add_to_cart", items }).name).toBe("AddToCart");
    expect(toMeta({ name: "begin_checkout", items }).name).toBe("InitiateCheckout");
    expect(toMeta({ name: "purchase", items, value: 6000 }).name).toBe("Purchase");
    expect(toMeta({ name: "search", searchTerm: "x" }).name).toBe("Search");
    expect(toMeta({ name: "generate_lead" }).name).toBe("Lead");
    expect(toMeta({ name: "sign_up" }).name).toBe("CompleteRegistration");
  });
  it("Purchase : valeur XOF, ids et nombre d'articles", () => {
    const c = toMeta({ name: "purchase", items, value: 6000 });
    expect(c.params).toMatchObject({ value: 6000, currency: "XOF", content_ids: ["p1", "p2"], content_type: "product", num_items: 3 });
  });
  it("n'envoie aucune donnée personnelle (aucune clé nom / e-mail / téléphone)", () => {
    const json = JSON.stringify([toMeta({ name: "purchase", items, transactionId: "WX-1" }), toGa({ name: "purchase", items, transactionId: "WX-1" })]);
    expect(json).not.toMatch(/phone|email|mail|address|customer/i);
  });
});

describe("événements : nettoyage et chemins", () => {
  it("sanitizePayload borne et nettoie une charge non fiable", () => {
    const p = sanitizePayload({
      items: [{ id: "a", price: -5, quantity: 0 }, { id: "" }, { price: 1 }, ...Array.from({ length: 80 }, (_, i) => ({ id: `x${i}` }))],
      value: 12.6,
      searchTerm: "y".repeat(500),
    });
    expect(p.items?.length).toBe(48); // 50 lues, 2 sans id écartées
    expect(p.items?.[0]).toMatchObject({ id: "a", price: 0, quantity: 1 });
    expect(p.value).toBe(13);
    expect(p.searchTerm?.length).toBe(80);
    expect(sanitizePayload("n'importe quoi")).toMatchObject({});
  });
  it("eventValue", () => {
    expect(eventValue({ items })).toBe(6000);
    expect(eventValue({ items, value: 100 })).toBe(100);
    expect(eventValue({})).toBe(0);
  });
  it("chemins avec ou sans langue", () => {
    expect(stripLocale("/fr/produit/x")).toBe("/produit/x");
    expect(stripLocale("/en")).toBe("/");
    expect(stripLocale("/fr")).toBe("/");
    expect(productSlugFromPath("/fr/produit/savon-noir")).toBe("savon-noir");
    expect(productSlugFromPath("/en/produit/a%20b")).toBe("a b");
    expect(productSlugFromPath("/fr/catalogue")).toBeNull();
    expect(isCheckoutPath("/fr/commande")).toBe(true);
    expect(isCheckoutPath("/fr/commande/merci")).toBe(false);
    expect(isThanksPath("/en/commande/merci")).toBe(true);
    expect(isCatalogPath("/fr/catalogue")).toBe(true);
  });
});

describe("panier : détection des ajouts", () => {
  const l = (id: string, qty: number) => ({ kind: "product", id, qty, name: id, price: 1000 });
  it("ne signale que les augmentations", () => {
    expect(cartAdditions([l("a", 1)], [l("a", 3), l("b", 1)])).toEqual([
      { id: "a", name: "a", price: 1000, quantity: 2 },
      { id: "b", name: "b", price: 1000, quantity: 1 },
    ]);
    expect(cartAdditions([l("a", 3)], [l("a", 2)])).toEqual([]);
    expect(cartAdditions([l("a", 1)], [l("a", 1)])).toEqual([]);
  });
  it("hydratation : base identique = aucun ajout fantôme", () => {
    const cart = [l("a", 2), l("b", 1)];
    expect(cartAdditions(cart, cart)).toEqual([]);
  });
  it("préfixe les packs", () => {
    expect(cartAdditions([], [{ kind: "pack", id: "k1", qty: 1, name: "Pack", price: 9000 }])[0].id).toBe("pack:k1");
  });
});
