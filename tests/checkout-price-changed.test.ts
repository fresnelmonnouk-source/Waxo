// Régression (audit Tariq) : une campagne finit pendant que le client est sur /commande. La commande ne doit JAMAIS
// être créée à un total plus élevé que celui affiché : 409 price_changed + prix à jour, aucun appel place_order.
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const findByIdem = vi.fn();
const getProductsByIds = vi.fn();

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
vi.mock("@/lib/catalog", () => ({ getProductsByIds: (...a: unknown[]) => getProductsByIds(...a) }));
vi.mock("@/lib/catalog/packs", () => ({ getPacks: async () => [], getPacksEnabled: async () => true }));

import { POST } from "@/app/api/checkout/route";
import { resetRateLimit } from "@/lib/checkout/rate-limit";

const UUID = "3f2b8c1e-5a47-4d9a-9b1e-7c2d4e6f8a10";
const body = (expectedSubtotal?: number) => ({
  items: [{ kind: "product", id: UUID, qty: 2 }],
  customer: { name: "Afi Houngbédji", phone: "01 97 00 00 00", address: "Fidjrossè, portail bleu" },
  zone: "cotonou",
  pay: "cod",
  lang: "fr",
  website: "",
  t: Date.now() - 10_000,
  ...(expectedSubtotal === undefined ? {} : { expectedSubtotal }),
});
const call = (b: unknown) =>
  POST(new Request("http://localhost/api/checkout", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "8.8.8.8" }, body: JSON.stringify(b) }));

beforeEach(() => {
  resetRateLimit();
  rpc.mockReset();
  findByIdem.mockReset();
  getProductsByIds.mockReset();
  findByIdem.mockResolvedValue({ data: null, error: null });
  rpc.mockResolvedValue({ data: [{ order_id: "o-1", order_number: "WX-10300", subtotal: 27800, shipping_fee: 0, total: 27800 }], error: null });
});

describe("POST /api/checkout — prix changé depuis l'affichage", () => {
  it("prix AUGMENTÉ (fin de campagne) → 409 price_changed, prix à jour, aucune commande créée", async () => {
    getProductsByIds.mockResolvedValue([{ id: UUID, price: 13900 }]);
    const res = await call(body(2 * 9730)); // le client voyait 9 730 F
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("price_changed");
    expect(json.prices).toEqual({ [UUID]: 13900 });
    expect(json.message).toMatch(/prix a changé/);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("prix inchangé → commande créée", async () => {
    getProductsByIds.mockResolvedValue([{ id: UUID, price: 13900 }]);
    const res = await call(body(27800));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("place_order", expect.anything());
  });
  it("prix BAISSÉ (campagne qui commence) → pas de blocage : le client paie moins", async () => {
    getProductsByIds.mockResolvedValue([{ id: UUID, price: 9730 }]);
    expect((await call(body(27800))).status).toBe(200);
  });
  it("ancien client sans expectedSubtotal → comportement inchangé", async () => {
    expect((await call(body())).status).toBe(200);
    expect(getProductsByIds).not.toHaveBeenCalled();
  });
  it("article introuvable au catalogue → place_order tranche (pas de faux price_changed)", async () => {
    getProductsByIds.mockResolvedValue([]);
    await call(body(1));
    expect(rpc).toHaveBeenCalled();
  });
});
