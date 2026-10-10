import { beforeEach, describe, expect, it, vi } from "vitest";
import { signFedapayPayload } from "@/lib/payment/signature";

const settle = vi.fn();
const fetchTransaction = vi.fn();

vi.mock("@/lib/payment/settle", () => ({ settleApprovedTransaction: (...a: unknown[]) => settle(...a) }));
vi.mock("@/lib/payment/fedapay", () => ({ fetchTransaction: (...a: unknown[]) => fetchTransaction(...a) }));

import { POST } from "@/app/api/webhooks/fedapay/route";

const SECRET = "whsec_test";
const OID = "3f2b8c1e-5a47-4d9a-9b1e-7c2d4e6f8a10";
const entity = { id: 77, status: "approved", amount: 7000, currency: { iso: "XOF" }, merchant_reference: "WX-10264", custom_metadata: { order_id: OID } };

function req(body: string, header?: string | null) {
  const headers = new Headers({ "content-type": "application/json" });
  if (header !== null) headers.set("x-fedapay-signature", header ?? signFedapayPayload(body, SECRET, Math.floor(Date.now() / 1000)));
  return new Request("http://localhost/api/webhooks/fedapay", { method: "POST", headers, body });
}
const evt = (over: Record<string, unknown> = {}) => JSON.stringify({ name: "transaction.approved", entity, ...over });

beforeEach(() => {
  settle.mockReset();
  fetchTransaction.mockReset();
  vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("FEDAPAY_SECRET_KEY", "");
});

describe("POST /api/webhooks/fedapay", () => {
  it("503 si le secret n'est pas configuré (le prestataire réessaiera)", async () => {
    vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", "");
    expect((await POST(req(evt()))).status).toBe(503);
    expect(settle).not.toHaveBeenCalled();
  });

  it("401 sans signature, avec une mauvaise signature ou un corps altéré", async () => {
    expect((await POST(req(evt(), null))).status).toBe(401);
    expect((await POST(req(evt(), "t=1800000000,s=deadbeef"))).status).toBe(401);
    const body = evt();
    const h = signFedapayPayload(body, SECRET, Math.floor(Date.now() / 1000));
    expect((await POST(req(body.replace("7000", "1"), h))).status).toBe(401);
    expect(settle).not.toHaveBeenCalled();
  });

  it("transaction approuvée : règle la commande avec un id d'événement idempotent", async () => {
    settle.mockResolvedValue("paid");
    const res = await POST(req(evt()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, result: "paid" });
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle.mock.calls[0][0]).toMatchObject({ id: "77", amount: 7000, orderId: OID });
    expect(settle.mock.calls[0][1]).toBe("transaction.approved:77");
  });

  it("doublon : 200 (mark_paid répond « duplicate »)", async () => {
    settle.mockResolvedValue("duplicate");
    const res = await POST(req(evt()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, result: "duplicate" });
  });

  it("événements non pertinents, JSON invalide, entité illisible : 200, jamais de règlement", async () => {
    expect((await POST(req(evt({ name: "transaction.declined" })))).status).toBe(200);
    expect((await POST(req("pas du json"))).status).toBe(200);
    expect((await POST(req(evt({ entity: { id: "x y" } })))).status).toBe(200);
    expect(settle).not.toHaveBeenCalled();
  });

  it("avec une clé API : relit la transaction chez FedaPay et ne croit pas le corps", async () => {
    vi.stubEnv("FEDAPAY_SECRET_KEY", "sk_sandbox_x");
    // Le corps du webhook prétend « approved », FedaPay dit « pending » : on ne règle pas.
    fetchTransaction.mockResolvedValue({ ...entity, id: "77", status: "pending", currency: "XOF", reference: "WX-10264", orderId: OID, orderNumber: "WX-10264" });
    const res = await POST(req(evt()));
    expect(res.status).toBe(200);
    expect(settle).not.toHaveBeenCalled();
  });

  it("avec une clé API : utilise le montant relu chez FedaPay", async () => {
    vi.stubEnv("FEDAPAY_SECRET_KEY", "sk_sandbox_x");
    fetchTransaction.mockResolvedValue({ id: "77", status: "approved", amount: 7000, currency: "XOF", reference: "WX-10264", orderId: OID, orderNumber: "WX-10264" });
    settle.mockResolvedValue("paid");
    const forged = evt({ entity: { ...entity, amount: 1 } });
    await POST(req(forged));
    expect(settle.mock.calls[0][0].amount).toBe(7000);
  });

  it("panne transitoire (API/base) : 503 pour déclencher un nouvel essai, sans fuite", async () => {
    settle.mockRejectedValue(new Error("connection refused db.internal:5432"));
    const res = await POST(req(evt()));
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain("5432");
  });
});
