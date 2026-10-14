// Régression (audits Raphaël, Tariq, Victor V1 — 2026-10-14) : la case « livraison offerte » est décochée pendant que le
// client est sur /commande (page et API en cache). La commande ne doit JAMAIS être créée avec des frais plus élevés que ceux
// affichés : 409 shipping_changed + liste « livraison offerte » à jour, aucun appel place_order.
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const findByIdem = vi.fn();
const getProductsByIds = vi.fn();
const getAllPacks = vi.fn();
const getSettings = vi.fn();
const createCheckout = vi.fn();
const orderUpdate = vi.fn();
const SHIP = { cotonou: 1000, autre: 2500, freeFrom: 15000, cutoff: 20, returnDays: 7 };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => findByIdem() }) }),
      update: (patch: unknown) => ({ eq: async () => (orderUpdate(patch), { error: null }) }),
    }),
  }),
}));
vi.mock("@/lib/supabase/env", () => ({ supabasePublicEnv: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createSessionClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }));
vi.mock("@/lib/email", () => ({ sendOrderEmail: async () => undefined }));
vi.mock("@/lib/email/shop", () => ({ sendShopNewOrderEmail: async () => ({ sent: true }) }));
vi.mock("@/lib/payment", () => ({ getPaymentProvider: () => ({ name: "test", createCheckout: (...a: unknown[]) => createCheckout(...a) }) }));
vi.mock("@/lib/catalog", () => ({
  getProductsByIds: (...a: unknown[]) => getProductsByIds(...a),
  getSettings: (...a: unknown[]) => getSettings(...a),
}));
// Devis : TOUS les packs actifs, masqués compris (V8) → getAllPacks. `getPacks` (liste boutique, packs masqués exclus) est
// vide : un pack trouvé ici est donc un pack masqué de la boutique mais commandable (V15).
vi.mock("@/lib/catalog/packs", () => ({
  getPacks: async () => [],
  getAllPacks: (...a: unknown[]) => getAllPacks(...a),
  getPacksEnabled: async () => true,
}));

import { POST } from "@/app/api/checkout/route";
import { resetRateLimit } from "@/lib/checkout/rate-limit";
import { cartShipsFree, parseShippingConfig, shippingFee } from "@/lib/checkout/shipping";

const P = "3f2b8c1e-5a47-4d9a-9b1e-7c2d4e6f8a10";
const Q = "4a3c9d2f-6b58-4e0b-8c2f-8d3e5f7a9b21";
const PACK = "5b4d0e3a-7c69-4f1c-9d3a-9e4f6a8b0c32";
const body = (items: { kind: "product" | "pack"; id: string; qty: number }[], expectedShipping?: number, zone = "cotonou") => ({
  items,
  customer: { name: "Afi Houngbédji", phone: "01 97 00 00 00", address: "Fidjrossè, portail bleu" },
  zone,
  pay: "cod",
  lang: "fr",
  website: "",
  t: Date.now() - 10_000,
  expectedSubtotal: 5000,
  ...(expectedShipping === undefined ? {} : { expectedShipping }),
});
const call = (b: unknown) =>
  POST(new Request("http://localhost/api/checkout", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "8.8.4.4" }, body: JSON.stringify(b) }));

beforeEach(() => {
  resetRateLimit();
  rpc.mockReset();
  findByIdem.mockReset();
  getProductsByIds.mockReset();
  getAllPacks.mockReset();
  getSettings.mockReset();
  createCheckout.mockReset();
  orderUpdate.mockReset();
  getAllPacks.mockResolvedValue([]);
  getSettings.mockResolvedValue({ shipping: SHIP });
  createCheckout.mockResolvedValue({ redirectUrl: "https://pay.example/checkout" });
  findByIdem.mockResolvedValue({ data: null, error: null });
  rpc.mockResolvedValue({ data: [{ order_id: "o-1", order_number: "WX-10400", subtotal: 5000, shipping_fee: 0, total: 5000 }], error: null });
});

describe("POST /api/checkout — frais de livraison changés depuis l'affichage", () => {
  it("le client voyait « offerte » (0 F), la case a été décochée → 409 shipping_changed, aucune commande", async () => {
    getProductsByIds.mockResolvedValue([{ id: P, price: 5000, freeShipping: false }]);
    const res = await call(body([{ kind: "product", id: P, qty: 1 }], 0));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("shipping_changed");
    expect(json.free).toEqual([]);
    expect(json.message).toMatch(/frais de livraison ont changé/);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("toujours offerte → commande créée", async () => {
    getProductsByIds.mockResolvedValue([{ id: P, price: 5000, freeShipping: true }]);
    expect((await call(body([{ kind: "product", id: P, qty: 1 }], 0))).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("place_order", expect.anything());
  });
  it("devenue offerte (frais en baisse) → pas de blocage", async () => {
    getProductsByIds.mockResolvedValue([{ id: P, price: 5000, freeShipping: true }]);
    expect((await call(body([{ kind: "product", id: P, qty: 1 }], 1000))).status).toBe(200);
  });
  it("panier mixte affiché à 1 000 F → commande créée (frais identiques)", async () => {
    getProductsByIds.mockResolvedValue([
      { id: P, price: 3000, freeShipping: true },
      { id: Q, price: 2000, freeShipping: false },
    ]);
    const res = await call(body([{ kind: "product", id: P, qty: 1 }, { kind: "product", id: Q, qty: 1 }], 1000));
    expect(res.status).toBe(200);
  });
  it("pack (0026) : sa case a été décochée → 409, même si tous ses produits sont cochés", async () => {
    getAllPacks.mockResolvedValue([{ id: PACK, price: 5000, freeShipping: false, items: [{ productId: P }, { productId: Q }] }]);
    getProductsByIds.mockResolvedValue([
      { id: P, price: 3000, freeShipping: true },
      { id: Q, price: 2500, freeShipping: true },
    ]);
    const res = await call(body([{ kind: "pack", id: PACK, qty: 1 }], 0));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("shipping_changed");
    expect(json.free).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("pack coché (0026) → offert même avec un produit non coché : commande créée", async () => {
    getAllPacks.mockResolvedValue([{ id: PACK, price: 5000, freeShipping: true, items: [{ productId: P }, { productId: Q }] }]);
    getProductsByIds.mockResolvedValue([]);
    expect((await call(body([{ kind: "pack", id: PACK, qty: 1 }], 0))).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("place_order", expect.anything());
  });
  it("pack coché + produit non coché affichés « offerte » → 409 (un seul article payant suffit)", async () => {
    getAllPacks.mockResolvedValue([{ id: PACK, price: 4000, freeShipping: true, items: [{ productId: Q }] }]);
    getProductsByIds.mockResolvedValue([{ id: P, price: 1000, freeShipping: false }]);
    const res = await call(body([{ kind: "pack", id: PACK, qty: 1 }, { kind: "product", id: P, qty: 1 }], 0));
    expect(res.status).toBe(409);
  });
  it("hors Cotonou & Calavi : la case ne change rien (2 500 F attendus → créée)", async () => {
    getProductsByIds.mockResolvedValue([{ id: P, price: 5000, freeShipping: true }]);
    expect((await call(body([{ kind: "product", id: P, qty: 1 }], 2500, "autre"))).status).toBe(200);
  });
  it("ancien client sans expectedShipping → comportement inchangé", async () => {
    getProductsByIds.mockResolvedValue([{ id: P, price: 5000, freeShipping: false }]);
    expect((await call(body([{ kind: "product", id: P, qty: 1 }]))).status).toBe(200);
  });
});

type Line = { kind: "product" | "pack"; id: string; qty: number };
/** Corps libre : sous-total et frais attendus (ce que le navigateur a affiché), moyen de paiement, zone. */
const order = (items: Line[], expectedSubtotal: number, expectedShipping: number, pay = "cod", zone = "cotonou") => ({
  ...body(items, expectedShipping, zone),
  expectedSubtotal,
  pay,
});
/** place_order (mock) renvoie ce montant ; cancel_order renvoie `cancel`. */
function placeOrderReturns(subtotal: number, shipping_fee: number, cancel: { data: unknown; error: unknown } = { data: true, error: null }) {
  rpc.mockImplementation(async (fn: string) =>
    fn === "cancel_order"
      ? cancel
      : { data: [{ order_id: "o-1", order_number: "WX-10400", subtotal, shipping_fee, total: subtotal + shipping_fee }], error: null },
  );
}
const placeCalls = () => rpc.mock.calls.filter((c) => c[0] === "place_order").length;
const cancelCalls = () => rpc.mock.calls.filter((c) => c[0] === "cancel_order");

describe("POST /api/checkout — pack masqué de la boutique mais commandable (V15)", () => {
  it("sa case a été décochée → 409 shipping_changed, aucune commande", async () => {
    getAllPacks.mockResolvedValue([{ id: PACK, price: 5000, freeShipping: false, items: [] }]);
    getProductsByIds.mockResolvedValue([]);
    const res = await call(order([{ kind: "pack", id: PACK, qty: 1 }], 5000, 0));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("shipping_changed");
    expect(json.free).toEqual([]);
    expect(json.shipping).toEqual(SHIP);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("son prix a augmenté → 409 price_changed avec son prix à jour, aucune commande", async () => {
    getAllPacks.mockResolvedValue([{ id: PACK, price: 6000, freeShipping: true, items: [] }]);
    getProductsByIds.mockResolvedValue([]);
    const res = await call(order([{ kind: "pack", id: PACK, qty: 1 }], 5000, 0));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("price_changed");
    expect(json.prices).toEqual({ [PACK]: 6000 });
    expect(json.free).toEqual([PACK]);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("POST /api/checkout — on compare le TOTAL affiché, jamais les frais seuls (Z1)", () => {
  it("un prix baisse sous le franco (frais 0 → 1 000 F, total 15 000 → 14 500 F) → commande créée, pas de boucle", async () => {
    getProductsByIds.mockResolvedValue([{ id: P, price: 13500, freeShipping: false }]);
    placeOrderReturns(13500, 1000);
    const res = await call(order([{ kind: "product", id: P, qty: 1 }], 15000, 0));
    expect(res.status).toBe(200);
    expect((await res.json()).order.total).toBe(14500);
    expect(placeCalls()).toBe(1);
    expect(cancelCalls()).toHaveLength(0);
  });
  it("prix en hausse mais livraison devenue offerte, total plus bas → commande créée", async () => {
    getProductsByIds.mockResolvedValue([{ id: P, price: 5500, freeShipping: true }]);
    placeOrderReturns(5500, 0);
    expect((await call(order([{ kind: "product", id: P, qty: 1 }], 5000, 1000))).status).toBe(200);
  });
  it("frais relevés dans les réglages (1 000 → 1 500 F) → 409 avec prix, réglages et liste à jour ; le nouvel essai passe", async () => {
    const items: Line[] = [{ kind: "product", id: P, qty: 1 }];
    getProductsByIds.mockResolvedValue([{ id: P, price: 5000, freeShipping: false }]);
    getSettings.mockResolvedValue({ shipping: { ...SHIP, cotonou: 1500 } });
    placeOrderReturns(5000, 1500);
    const res = await call(order(items, 5000, 1000));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("shipping_changed");
    expect(json.prices).toEqual({ [P]: 5000 });
    expect(json.shipping).toEqual({ ...SHIP, cotonou: 1500 });
    expect(json.free).toEqual([]);
    expect(placeCalls()).toBe(0);

    // Le navigateur applique les données renvoyées (comme CheckoutFlow) et recalcule le total affiché.
    const cfg = parseShippingConfig(json.shipping);
    expect(cfg).not.toBeNull();
    const sub = items.reduce((n, i) => n + json.prices[i.id] * i.qty, 0);
    const ship = shippingFee(sub, "cotonou", cfg!, cartShipsFree(items, json.free));
    expect(sub + ship).toBe(6500);
    const again = await call(order(items, sub, ship));
    expect(again.status).toBe(200);
    expect(placeCalls()).toBe(1);
    expect(cancelCalls()).toHaveLength(0);
  });
  it("prix en hausse ET total en hausse → 409 price_changed avec les réglages de livraison", async () => {
    getProductsByIds.mockResolvedValue([{ id: P, price: 6000, freeShipping: false }]);
    const json = await (await call(order([{ kind: "product", id: P, qty: 1 }], 5000, 1000))).json();
    expect(json.code).toBe("price_changed");
    expect(json.prices).toEqual({ [P]: 6000 });
    expect(json.shipping).toEqual(SHIP);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("POST /api/checkout — filet après place_order : la base facture plus que le total affiché (Z2)", () => {
  it("la base facture la livraison que le code croyait offerte → cancel_order, 409, aucune transaction de paiement", async () => {
    getProductsByIds.mockResolvedValue([{ id: P, price: 5000, freeShipping: true }]);
    placeOrderReturns(5000, 1000); // règle SQL divergente (retour arrière, 0025 rejouée…) : 1 000 F facturés
    const res = await call(order([{ kind: "product", id: P, qty: 1 }], 5000, 0, "carte"));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("shipping_changed");
    expect(json.free).toEqual([]); // le navigateur affichera le tarif facturé par la base
    expect(json.shipping).toEqual(SHIP);
    expect(json.order).toBeUndefined();
    expect(cancelCalls()).toEqual([["cancel_order", { p_order: "o-1" }]]);
    expect(createCheckout).not.toHaveBeenCalled();
    expect(orderUpdate).not.toHaveBeenCalled(); // clé d'idempotence non posée : le nouvel essai crée une nouvelle commande
  });
  it("sous-total facturé plus élevé → price_changed, commande annulée", async () => {
    getProductsByIds.mockResolvedValue([{ id: P, price: 5000, freeShipping: false }]);
    placeOrderReturns(5500, 1000);
    const json = await (await call(order([{ kind: "product", id: P, qty: 1 }], 5000, 1000, "carte"))).json();
    expect(json.code).toBe("price_changed");
    expect(cancelCalls()).toHaveLength(1);
    expect(createCheckout).not.toHaveBeenCalled();
  });
  it("lecture du catalogue et des réglages en échec : le garde n'est plus sauté en silence, le filet annule", async () => {
    getProductsByIds.mockRejectedValue(new Error("timeout"));
    getSettings.mockRejectedValue(new Error("settings_unavailable"));
    placeOrderReturns(5000, 1000);
    const res = await call(order([{ kind: "product", id: P, qty: 1 }], 5000, 0, "carte"));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("shipping_changed");
    expect(json.free).toEqual([]);
    expect(cancelCalls()).toHaveLength(1);
    expect(createCheckout).not.toHaveBeenCalled();
  });
  it("lecture du catalogue en échec mais total facturé conforme → commande créée, paiement lancé", async () => {
    getProductsByIds.mockRejectedValue(new Error("timeout"));
    placeOrderReturns(5000, 1000);
    const res = await call(order([{ kind: "product", id: P, qty: 1 }], 5000, 1000, "carte"));
    expect(res.status).toBe(200);
    expect(cancelCalls()).toHaveLength(0);
    expect(createCheckout).toHaveBeenCalledTimes(1);
  });
  it("annulation en échec : toujours 409, jamais de paiement", async () => {
    getProductsByIds.mockResolvedValue([{ id: P, price: 5000, freeShipping: true }]);
    placeOrderReturns(5000, 1000, { data: null, error: { code: "XX000", message: "boom" } });
    const res = await call(order([{ kind: "product", id: P, qty: 1 }], 5000, 0, "carte"));
    expect(res.status).toBe(409);
    expect(createCheckout).not.toHaveBeenCalled();
  });
  it("ancien client (sous-total seul) : le filet compare le sous-total facturé", async () => {
    getProductsByIds.mockResolvedValue([{ id: P, price: 5000, freeShipping: false }]);
    placeOrderReturns(5000, 1000); // frais inconnus du client : pas de blocage
    expect((await call(body([{ kind: "product", id: P, qty: 1 }]))).status).toBe(200);
    placeOrderReturns(6000, 1000);
    expect((await call(body([{ kind: "product", id: P, qty: 1 }]))).status).toBe(409);
  });
});
