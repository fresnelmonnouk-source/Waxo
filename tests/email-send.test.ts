import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const load = vi.fn();
vi.mock("@/lib/email/load", () => ({ loadOrderEmail: (...a: unknown[]) => load(...a) }));

import { sendOrderEmail } from "@/lib/email";
import { resetEmailGuard } from "@/lib/email/guard";
import type { OrderEmailData } from "@/lib/email/template";

const data: OrderEmailData = {
  locale: "fr",
  number: "WX-10264",
  name: "Afi Houngbédji",
  items: [{ name: "Gourde", qty: 1, unitPrice: 3000 }],
  total: 3000,
  pay: "momo",
  paid: true,
  deliveryDate: "demain",
  brand: { shopName: "Wá xɔ", whatsapp: "+229 01", waNumber: "2290100000000", email: "contact@waxo.bj", hours: "" },
  siteUrl: "https://waxo.bj",
};

const ID = "3f2b8c1e-5a47-4d9a-9b1e-7c2d4e6f8a10";
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetEmailGuard();
  load.mockReset();
  load.mockResolvedValue({ to: "afi@example.com", data });
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "re_1" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("EMAIL_FROM", "Wá xɔ <commandes@waxo.bj>");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("sendOrderEmail", () => {
  it("sans clé Resend : ne fait rien et ne jette pas", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(sendOrderEmail(ID, "paid")).resolves.toEqual({ sent: false, reason: "not_configured" });
    expect(load).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envoie via Resend avec clé d'idempotence, reply_to et langue de la commande", async () => {
    await expect(sendOrderEmail(ID, "paid")).resolves.toEqual({ sent: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test");
    expect(headers["Idempotency-Key"]).toBe(`waxo-order-${ID}:paid`);
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ to: ["afi@example.com"], from: "Wá xɔ <commandes@waxo.bj>", reply_to: "contact@waxo.bj" });
    expect(body.subject).toBe("Paiement reçu pour la commande WX-10264");
    expect(body.html).toContain("<!doctype html>");
    expect(body.text).toContain("Bonjour Afi,");
  });

  it("jamais d'envoi en double pour (commande, type) ; un autre type part normalement", async () => {
    await sendOrderEmail(ID, "paid");
    await expect(sendOrderEmail(ID, "paid")).resolves.toEqual({ sent: false, reason: "duplicate" });
    await expect(sendOrderEmail(ID, "preparation")).resolves.toEqual({ sent: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("deux appels simultanés : un seul envoi", async () => {
    const [a, b] = await Promise.all([sendOrderEmail(ID, "livree"), sendOrderEmail(ID, "livree")]);
    expect([a.sent, b.sent].filter(Boolean)).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("pas d'adresse e-mail : pas d'envoi, motif explicite", async () => {
    load.mockResolvedValue({ to: null, reason: "no_recipient" });
    await expect(sendOrderEmail(ID, "paid")).resolves.toEqual({ sent: false, reason: "no_recipient" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("échec Resend ou panne réseau : ne jette pas, et un nouvel essai reste possible", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 422 }));
    await expect(sendOrderEmail(ID, "paid")).resolves.toEqual({ sent: false, reason: "rejected" });
    fetchMock.mockRejectedValueOnce(new Error("réseau"));
    await expect(sendOrderEmail(ID, "paid")).resolves.toEqual({ sent: false, reason: "network" });
    await expect(sendOrderEmail(ID, "paid")).resolves.toEqual({ sent: true });
  });

  it("base qui jette : ne jette pas", async () => {
    load.mockRejectedValue(new Error("db down"));
    await expect(sendOrderEmail(ID, "paid")).resolves.toEqual({ sent: false, reason: "error" });
  });

  it("entrée invalide : refus propre", async () => {
    // @ts-expect-error type de message volontairement invalide
    await expect(sendOrderEmail(ID, "spam")).resolves.toEqual({ sent: false, reason: "invalid_input" });
    await expect(sendOrderEmail("", "paid")).resolves.toEqual({ sent: false, reason: "invalid_input" });
  });
});
