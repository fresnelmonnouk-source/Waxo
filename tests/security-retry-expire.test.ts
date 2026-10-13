// Audit 2026-10-12 : panier conservé après un paiement échoué (Mia 9) ; expiration bornée en temps et opportuniste (Tariq E4).
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
const createAdminClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => createAdminClient() }));
vi.mock("@/lib/email", () => ({ sendOrderEmail: async () => ({ sent: true }) }));

import { readCheckoutSnapshot, saveCheckoutSnapshot, saveResume, takeResume, whatsappHref } from "@/components/checkout/retry";
import { inBoundedBatches, maybeSweepStaleOrders, resetSweepThrottle } from "@/lib/payment/expire";
import { parseReplaceRef } from "@/lib/payment/replace";

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}
const line = { kind: "product" as const, id: "p-1", qty: 2, slug: "a", name: "Pagne", price: 5000, bg: null, imageUrl: null };
const snap = { number: "WX-10300", lines: [line], zone: "autre" as const, pay: "momo" as const, form: { name: "Afi H", phone: "0197000000", email: "", address: "Fidjrossè" } };

describe("instantané du panier (retry.ts)", () => {
  it("sauvé au départ vers le paiement, relu pour la même commande seulement, 24 h au plus", () => {
    const s = memoryStorage();
    saveCheckoutSnapshot(snap, s, 1_000_000);
    expect(readCheckoutSnapshot("WX-10300", s, 1_000_000 + 60_000)).toMatchObject({ number: "WX-10300", lines: [line], zone: "autre", pay: "momo" });
    expect(readCheckoutSnapshot("WX-10301", s, 1_000_000)).toBeNull();
    expect(readCheckoutSnapshot("WX-10300", s, 1_000_000 + 25 * 3600_000)).toBeNull();
    expect(readCheckoutSnapshot(null, s)).toBeNull();
  });
  it("contenu altéré : lignes invalides écartées, rien d'exécutable", () => {
    const s = memoryStorage();
    s.setItem("waxo:checkout-snapshot:v1", JSON.stringify({ ...snap, at: 5, lines: [{ kind: "x", id: 1, qty: -1 }] }));
    expect(readCheckoutSnapshot("WX-10300", s, 10)).toBeNull();
    s.setItem("waxo:checkout-snapshot:v1", "{pas du json");
    expect(readCheckoutSnapshot("WX-10300", s, 10)).toBeNull();
  });
  it("reprise : moyen imposé (paiement à la livraison), jeton de l'ancienne commande, lecture UNIQUE", () => {
    const s = memoryStorage();
    saveCheckoutSnapshot(snap, s, 1);
    const read = readCheckoutSnapshot("WX-10300", s, 2)!;
    saveResume(read, { pay: "cod", token: "a".repeat(32) }, s);
    expect(takeResume(s)).toEqual({ form: snap.form, zone: "autre", pay: "cod", replaces: { n: "WX-10300", k: "a".repeat(32) } });
    expect(takeResume(s)).toBeNull();
    saveResume(read, { token: null }, s);
    expect(takeResume(s)).toMatchObject({ pay: "momo", replaces: null });
  });
  it("lien WhatsApp prérempli, seulement avec un vrai numéro", () => {
    expect(whatsappHref("+229 01 97 00 00 00", "Commande WX-1 : échec")).toBe("https://wa.me/2290197000000?text=Commande%20WX-1%20%3A%20%C3%A9chec");
    expect(whatsappHref("", "x")).toBeNull();
  });
  it("parseReplaceRef : numéro et jeton validés par motif", () => {
    expect(parseReplaceRef({ n: "WX-10300", k: "ab".repeat(16) })).toEqual({ number: "WX-10300", token: "ab".repeat(16) });
    for (const bad of [null, "x", { n: "WX-1; drop", k: "ab".repeat(16) }, { n: "WX-1", k: "zz" }]) expect(parseReplaceRef(bad)).toBeNull();
  });
});

describe("expiration (expire.ts)", () => {
  beforeEach(() => {
    rpc.mockReset();
    createAdminClient.mockReset();
    resetSweepThrottle();
  });
  it("inBoundedBatches : tranches parallèles, arrêt dès l'échéance passée", async () => {
    let clock = 0;
    const seen: number[] = [];
    const done = await inBoundedBatches([1, 2, 3, 4, 5, 6, 7], 3, 20, async (n) => {
      seen.push(n);
      clock += 4; // chaque élément « coûte » du temps
    }, () => clock);
    expect(seen).toEqual([1, 2, 3, 4, 5, 6]); // 3e tranche jamais lancée : échéance dépassée
    expect(done).toBe(6);
  });
  it("balayage opportuniste : au plus une fois par 10 min et par instance, et l'expiration SQL passe", async () => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "neq", "lt", "limit", "in"]) chain[m] = () => chain;
    chain.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
    rpc.mockResolvedValue({ data: 2, error: null });
    createAdminClient.mockReturnValue({ rpc, from: () => chain });
    expect(await maybeSweepStaleOrders(1_000_000)).toEqual({ expired: 2, rescued: 0, notified: 0 });
    expect(await maybeSweepStaleOrders(1_000_000 + 60_000)).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("expire_stale_orders", { p_minutes: 60 });
  });
  it("balayage opportuniste : une panne de base ne jette jamais", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    createAdminClient.mockImplementation(() => {
      throw new Error("down");
    });
    expect(await maybeSweepStaleOrders(5_000_000)).toBeNull();
    err.mockRestore();
  });
});
