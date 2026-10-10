import { describe, expect, it } from "vitest";
import { parseTransaction, isApproved, isFailed } from "@/lib/payment/transaction";
import { paymentStateFor, transactionMatchesOrder } from "@/lib/payment/state";

const OID = "3f2b8c1e-5a47-4d9a-9b1e-7c2d4e6f8a10";
const entity = {
  id: 987,
  status: "approved",
  amount: 7000,
  currency: { iso: "XOF" },
  merchant_reference: "WX-10264",
  custom_metadata: { order_id: OID, order_number: "WX-10264" },
};

describe("parseTransaction", () => {
  it("lit l'entité nue et l'enveloppe d'API", () => {
    const a = parseTransaction(entity);
    expect(a).toMatchObject({ id: "987", status: "approved", amount: 7000, currency: "XOF", orderId: OID, orderNumber: "WX-10264" });
    expect(parseTransaction({ "v1/transaction": entity })).toEqual(a);
    expect(parseTransaction({ transaction: entity })).toEqual(a);
  });
  it("rejette les données inexploitables", () => {
    expect(parseTransaction(null)).toBeNull();
    expect(parseTransaction({ ...entity, id: undefined })).toBeNull();
    expect(parseTransaction({ ...entity, id: "a b" })).toBeNull();
    expect(parseTransaction({ ...entity, status: 5 })).toBeNull();
    expect(parseTransaction({ ...entity, amount: 10.5 })).toBeNull();
    expect(parseTransaction({ ...entity, amount: -1 })).toBeNull();
    expect(parseTransaction({ ...entity, amount: "abc" })).toBeNull();
  });
  it("ignore une métadonnée de commande mal formée et retombe sur la référence marchand", () => {
    const tx = parseTransaction({ ...entity, custom_metadata: { order_id: "pas-un-uuid", order_number: "x" } });
    expect(tx?.orderId).toBeNull();
    expect(tx?.orderNumber).toBe("WX-10264");
  });
  it("classe les statuts", () => {
    expect(isApproved(parseTransaction(entity)!)).toBe(true);
    expect(isFailed(parseTransaction({ ...entity, status: "declined" })!)).toBe(true);
    expect(isFailed(parseTransaction({ ...entity, status: "pending" })!)).toBe(false);
  });
});

describe("état de paiement montré au client", () => {
  const order = { id: OID, number: "WX-10264", total: 7000 };
  it("transactionMatchesOrder refuse une autre commande ou un autre montant", () => {
    const tx = parseTransaction(entity)!;
    expect(transactionMatchesOrder(tx, order)).toBe(true);
    expect(transactionMatchesOrder(tx, { ...order, id: "3f2b8c1e-5a47-4d9a-9b1e-000000000000" })).toBe(false);
    expect(transactionMatchesOrder(tx, { ...order, total: 7001 })).toBe(false);
    expect(transactionMatchesOrder(parseTransaction({ ...entity, currency: { iso: "EUR" } })!, order)).toBe(false);
  });
  it("paymentStateFor", () => {
    expect(paymentStateFor(null, null)).toBe("unknown");
    expect(paymentStateFor({ paid: true, status: "nouvelle" }, null)).toBe("paid");
    expect(paymentStateFor({ paid: false, status: "annulee" }, null)).toBe("failed");
    expect(paymentStateFor({ paid: false, status: "nouvelle" }, parseTransaction({ ...entity, status: "declined" }))).toBe("failed");
    expect(paymentStateFor({ paid: false, status: "nouvelle" }, null)).toBe("pending");
  });
});
