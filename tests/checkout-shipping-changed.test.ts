// Régression (audits Raphaël, Tariq, Victor V1 — 2026-10-14) : la case « livraison offerte » est décochée pendant que le
// client est sur /commande (page et API en cache). La commande ne doit JAMAIS être créée avec des frais plus élevés que ceux
// affichés : 409 shipping_changed + liste « livraison offerte » à jour, aucun appel place_order.
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const findByIdem = vi.fn();
const getProductsByIds = vi.fn();
const getPacks = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => findByIdem() }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}));
vi.mock("@/lib/supabase/env", () => ({ supabasePublicEnv: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createSessionClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }));
vi.mock("@/lib/email", () => ({ sendOrderEmail: async () => undefined }));
vi.mock("@/lib/email/shop", () => ({ sendShopNewOrderEmail: async () => ({ sent: true }) }));
vi.mock("@/lib/payment", () => ({ getPaymentProvider: () => ({ name: "test", createCheckout: vi.fn() }) }));
vi.mock("@/lib/catalog", () => ({
  getProductsByIds: (...a: unknown[]) => getProductsByIds(...a),
  getSettings: async () => ({ shipping: { cotonou: 1000, autre: 2500, freeFrom: 15000, cutoff: 20, returnDays: 7 } }),
}));
vi.mock("@/lib/catalog/packs", () => ({ getPacks: (...a: unknown[]) => getPacks(...a), getPacksEnabled: async () => true }));

import { POST } from "@/app/api/checkout/route";
import { resetRateLimit } from "@/lib/checkout/rate-limit";

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
  getPacks.mockReset();
  getPacks.mockResolvedValue([]);
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
  it("pack : offert seulement si tous ses produits le sont ; un produit décoché → 409", async () => {
    getPacks.mockResolvedValue([{ id: PACK, price: 5000, items: [{ productId: P }, { productId: Q }] }]);
    getProductsByIds.mockResolvedValue([
      { id: P, price: 3000, freeShipping: true },
      { id: Q, price: 2500, freeShipping: false },
    ]);
    const res = await call(body([{ kind: "pack", id: PACK, qty: 1 }], 0));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("shipping_changed");
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
