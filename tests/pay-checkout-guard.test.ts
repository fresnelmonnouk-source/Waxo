import { describe, expect, it } from "vitest";
import { MAX_QTY_PER_LINE, MAX_UNITS_PER_ORDER, parseIdemKey, submitTiming, withinQuantityCaps } from "@/app/api/checkout/guard";
import { clearIdempotencyKey, idempotencyKeyFor, orderSignature } from "@/components/checkout/idempotency";
import { parseReturnParams } from "@/components/checkout/return-params";

const NOW = 1_800_000_000_000;
const ID = "3f2b8c1e-5a47-4d9a-9b1e-7c2d4e6f8a10";
const ID2 = "3f2b8c1e-5a47-4d9a-9b1e-7c2d4e6f8a11";

describe("délai anti-robot tolérant à l'horloge", () => {
  it("honeypot rempli = robot", () => {
    expect(submitTiming({ website: "x", elapsed: 9000 }, NOW)).toBe("bot");
  });
  it("sans aucune mesure de temps = robot", () => {
    expect(submitTiming({}, NOW)).toBe("bot");
  });
  it("`elapsed` prime sur l'horloge : un téléphone en avance de 1 h n'est plus bloqué", () => {
    expect(submitTiming({ elapsed: 12_000, t: NOW + 3_600_000 }, NOW)).toBe("ok");
    expect(submitTiming({ elapsed: 800, t: NOW - 60_000 }, NOW)).toBe("too_fast");
  });
  it("repli sur `t` : seul l'envoi manifestement trop rapide est refusé", () => {
    expect(submitTiming({ t: NOW - 1000 }, NOW)).toBe("too_fast");
    expect(submitTiming({ t: NOW - 3000 }, NOW)).toBe("ok");
    expect(submitTiming({ t: NOW + 2 * 3_600_000 }, NOW)).toBe("ok"); // horloge en avance : indécidable, on laisse passer
    expect(submitTiming({ t: NOW - 7 * 3_600_000 }, NOW)).toBe("ok"); // horloge en retard
  });
});

describe("plafonds de quantité", () => {
  it("par article et au total", () => {
    expect(withinQuantityCaps([{ kind: "product", id: ID, qty: MAX_QTY_PER_LINE }])).toBe(true);
    expect(withinQuantityCaps([{ kind: "product", id: ID, qty: MAX_QTY_PER_LINE + 1 }])).toBe(false);
    expect(withinQuantityCaps([{ kind: "product", id: ID, qty: 99 }])).toBe(false);
    expect(
      withinQuantityCaps([
        { kind: "product", id: ID, qty: 10 },
        { kind: "product", id: ID2, qty: 10 },
      ]),
    ).toBe(true);
    expect(
      withinQuantityCaps([
        { kind: "product", id: ID, qty: 10 },
        { kind: "product", id: ID2, qty: 10 },
        { kind: "pack", id: ID, qty: 1 },
      ]),
    ).toBe(false);
    expect(MAX_UNITS_PER_ORDER).toBe(20);
  });
  it("un même article répété est cumulé (contournement par lignes multiples)", () => {
    expect(
      withinQuantityCaps([
        { kind: "product", id: ID, qty: 6 },
        { kind: "product", id: ID.toUpperCase(), qty: 6 },
      ]),
    ).toBe(false);
  });
});

describe("clé d'idempotence", () => {
  it("parseIdemKey n'accepte qu'un UUID", () => {
    expect(parseIdemKey(ID)).toBe(ID);
    expect(parseIdemKey(ID.toUpperCase())).toBe(ID);
    expect(parseIdemKey("abc")).toBeNull();
    expect(parseIdemKey(12)).toBeNull();
  });
  function memory() {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  }
  const parts = { items: [{ kind: "product", id: ID, qty: 2 }], zone: "cotonou", pay: "momo", phone: "0197000000", name: "Afi H", address: "Fidjrossè" };
  it("même commande = même clé ; commande modifiée = nouvelle clé ; effacement après succès", () => {
    const s = memory();
    const sig = orderSignature(parts);
    const k1 = idempotencyKeyFor(sig, s);
    expect(parseIdemKey(k1)).toBe(k1);
    expect(idempotencyKeyFor(sig, s)).toBe(k1);
    expect(idempotencyKeyFor(orderSignature({ ...parts, items: [{ kind: "product", id: ID, qty: 3 }] }), s)).not.toBe(k1);
    clearIdempotencyKey(s);
    expect(s.getItem("waxo:checkout-idem:v1")).toBeNull();
  });
  it("la signature ignore l'ordre des lignes", () => {
    const a = orderSignature({ ...parts, items: [{ kind: "product", id: ID, qty: 1 }, { kind: "pack", id: ID2, qty: 1 }] });
    const b = orderSignature({ ...parts, items: [{ kind: "pack", id: ID2, qty: 1 }, { kind: "product", id: ID, qty: 1 }] });
    expect(a).toBe(b);
  });
  it("fonctionne sans stockage", () => {
    expect(parseIdemKey(idempotencyKeyFor("x", null))).not.toBeNull();
  });
});

describe("paramètres de retour de paiement", () => {
  it("valide chaque paramètre par motif", () => {
    expect(parseReturnParams("?n=WX-10264&k=" + "a".repeat(32) + "&id=987&p=unavailable")).toEqual({
      number: "WX-10264",
      token: "a".repeat(32),
      transactionId: "987",
      unavailable: true,
    });
    expect(parseReturnParams("?n=<script>&k=zz&id=../x")).toEqual({ number: null, token: null, transactionId: null, unavailable: false });
    expect(parseReturnParams("")).toEqual({ number: null, token: null, transactionId: null, unavailable: false });
  });
});
