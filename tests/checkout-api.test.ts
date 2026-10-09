import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const createAdminClient = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => createAdminClient() }));
vi.mock("@/lib/supabase/env", () => ({ supabasePublicEnv: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createSessionClient: vi.fn() }));

import { POST } from "@/app/api/checkout/route";
import { resetRateLimit } from "@/lib/checkout/rate-limit";

const UUID = "3f2b8c1e-5a47-4d9a-9b1e-7c2d4e6f8a10";
const body = (over: Record<string, unknown> = {}) => ({
  items: [{ kind: "product", id: UUID, qty: 2 }],
  customer: { name: "Afi Houngbédji", phone: "01 97 00 00 00", address: "Fidjrossè, portail bleu" },
  zone: "cotonou",
  pay: "cod",
  lang: "fr",
  website: "",
  t: Date.now() - 10_000,
  ...over,
});
const call = (payload: unknown, ip = "1.1.1.1") =>
  POST(
    new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: typeof payload === "string" ? payload : JSON.stringify(payload),
    }),
  );

beforeEach(() => {
  resetRateLimit();
  rpc.mockReset();
  createAdminClient.mockReset();
  createAdminClient.mockReturnValue({ rpc });
});

describe("POST /api/checkout", () => {
  it("crée une commande à la livraison et renvoie les montants OFFICIELS de la base", async () => {
    rpc.mockResolvedValue({
      data: [{ order_id: "o1", order_number: "WX-10263", subtotal: 17800, shipping_fee: 0, total: 17800 }],
      error: null,
    });
    const res = await call(body({ total: 1, shippingFee: 999 }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, order: { number: "WX-10263", total: 17800 }, payment: { kind: "cod" } });
    const args = rpc.mock.calls[0];
    expect(args[0]).toBe("place_order");
    expect(JSON.stringify(args[1])).not.toContain("999");
    expect(args[1].p_customer.phone).toBe("0197000000");
    expect(args[1].p_items).toEqual([{ kind: "product", id: UUID, qty: 2 }]);
  });

  it("paiement en ligne : commande créée, paiement « pending » via le provider mock", async () => {
    rpc.mockResolvedValue({
      data: [{ order_id: "o1", order_number: "WX-10264", subtotal: 6000, shipping_fee: 1000, total: 7000 }],
      error: null,
    });
    const res = await call(body({ pay: "momo", payerPhone: "01 96 00 00 00" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.payment).toEqual({ kind: "pending" });
  });

  it("traduit out_of_stock en 409 localisé, sans fuite interne", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "out_of_stock", code: "P0001" } });
    const res = await call(body({ lang: "en" }));
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.code).toBe("out_of_stock");
    expect(json.message).toMatch(/no longer available/i);
    expect(JSON.stringify(json)).not.toContain("P0001");
  });

  it("erreur SQL inconnue : 500 générique, message interne jamais renvoyé", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'relation "orders" secret', code: "42P01" } });
    const res = await call(body());
    const json = await res.json();
    expect(res.status).toBe(500);
    expect(json.code).toBe("server_error");
    expect(JSON.stringify(json)).not.toContain("secret");
  });

  it("Supabase absent : 503 propre", async () => {
    createAdminClient.mockImplementation(() => {
      throw new Error("Supabase service_role non configuré");
    });
    const res = await call(body());
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("unavailable");
  });

  it("bloque honeypot rempli et envoi trop rapide", async () => {
    expect((await call(body({ website: "http://spam" }))).status).toBe(400);
    expect((await call(body({ t: Date.now() - 500 }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuse JSON invalide, panier invalide et champs invalides", async () => {
    expect((await call("{pas du json")).status).toBe(400);
    expect((await call(body({ items: [] }))).status).toBe(422);
    const bad = await call(body({ customer: { name: "Afi H", phone: "123", address: "Fidjrossè" } }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).fields).toEqual(["phone"]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("limite le débit par IP", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "out_of_stock" } });
    let last = 200;
    for (let i = 0; i < 9; i++) last = (await call(body(), "9.9.9.9")).status;
    expect(last).toBe(429);
    expect((await call(body(), "8.8.8.8")).status).toBe(409);
  });
});
