import { describe, expect, it } from "vitest";
import adminDemo from "@/lib/demo/admin.json";
import {
  NEXT_STEP,
  STATUS_LIST,
  STATUS_META,
  allowedTransitions,
  canTransition,
  planTransition,
  type TransitionInput,
} from "@/lib/orders/status";

const base: TransitionInput = { status: "nouvelle", pay: "cod", paid: false, courierId: null };
const NOW = new Date("2026-10-09T10:00:00.000Z");

describe("statuts : cohérence avec la démo", () => {
  it("libellés et couleurs identiques à admin.json", () => {
    for (const s of STATUS_LIST) {
      const demo = (adminDemo.status as Record<string, string[]>)[s];
      expect([STATUS_META[s].label, STATUS_META[s].bg, STATUS_META[s].color]).toEqual(demo);
    }
  });
});

describe("transitions", () => {
  it("le flux avance d'une étape à la fois", () => {
    expect(canTransition("nouvelle", "preparation")).toBe(true);
    expect(canTransition("nouvelle", "livraison")).toBe(false);
    expect(canTransition("nouvelle", "livree")).toBe(false);
    expect(canTransition("preparation", "livraison")).toBe(true);
    expect(canTransition("livraison", "livree")).toBe(true);
  });
  it("ne recule jamais, sauf l'échec de livraison explicite", () => {
    expect(canTransition("preparation", "nouvelle")).toBe(false);
    expect(canTransition("livraison", "nouvelle")).toBe(false);
    expect(canTransition("livraison", "preparation")).toBe(true);
    expect(canTransition("livree", "livraison")).toBe(false);
  });
  it("livrée et annulée sont définitives", () => {
    expect(allowedTransitions("livree")).toEqual([]);
    expect(allowedTransitions("annulee")).toEqual([]);
  });
  it("annulation possible avant la livraison seulement", () => {
    expect(canTransition("nouvelle", "annulee")).toBe(true);
    expect(canTransition("preparation", "annulee")).toBe(true);
    expect(canTransition("livraison", "annulee")).toBe(true);
    expect(canTransition("livree", "annulee")).toBe(false);
  });
  it("NEXT_STEP suit le flux nominal", () => {
    expect(NEXT_STEP.nouvelle?.to).toBe("preparation");
    expect(NEXT_STEP.preparation?.to).toBe("livraison");
    expect(NEXT_STEP.livraison?.to).toBe("livree");
    expect(NEXT_STEP.livree).toBeUndefined();
  });
});

describe("planTransition", () => {
  it("refuse le même statut et les transitions invalides", () => {
    expect(planTransition(base, "nouvelle")).toMatchObject({ ok: false, code: "same_status" });
    expect(planTransition(base, "livree")).toMatchObject({ ok: false, code: "invalid_transition" });
    expect(planTransition({ ...base, status: "livree" }, "annulee")).toMatchObject({ ok: false, code: "invalid_transition" });
  });
  it("annulation = RPC cancel_order + e-mail « annulee », aucun UPDATE direct", () => {
    const p = planTransition({ ...base, status: "preparation" }, "annulee");
    expect(p).toEqual({ ok: true, cancel: true, patch: {}, email: "annulee" });
  });
  it("préparation d'un paiement en ligne non payé refusée", () => {
    const p = planTransition({ ...base, pay: "momo", paid: false }, "preparation");
    expect(p).toMatchObject({ ok: false, code: "unpaid" });
    expect(planTransition({ ...base, pay: "momo", paid: true }, "preparation")).toMatchObject({ ok: true, email: "preparation" });
    expect(planTransition({ ...base, pay: "cod", paid: false }, "preparation")).toMatchObject({ ok: true });
  });
  it("mise en livraison : livreur obligatoire", () => {
    const o: TransitionInput = { ...base, status: "preparation" };
    expect(planTransition(o, "livraison")).toMatchObject({ ok: false, code: "courier_required" });
    const ok = planTransition(o, "livraison", { courierId: "c1" });
    expect(ok).toMatchObject({ ok: true, email: "livraison", patch: { status: "livraison", courier_id: "c1" } });
    expect(planTransition({ ...o, courierId: "c9" }, "livraison")).toMatchObject({ ok: true, patch: { courier_id: "c9" } });
  });
  it("livrée : date de livraison, et COD non payé devient payé", () => {
    const p = planTransition({ ...base, status: "livraison", courierId: "c1" }, "livree", { now: NOW });
    expect(p).toMatchObject({
      ok: true,
      email: "livree",
      patch: { status: "livree", delivered_at: NOW.toISOString(), paid: true, paid_at: NOW.toISOString() },
    });
    const online = planTransition({ ...base, status: "livraison", pay: "momo", paid: true }, "livree", { now: NOW });
    expect(online).toMatchObject({ ok: true });
    if (online.ok) expect("paid" in online.patch).toBe(false);
  });
  it("échec de livraison : retour en préparation sans nouvel e-mail", () => {
    const p = planTransition({ ...base, status: "livraison", courierId: "c1" }, "preparation");
    expect(p).toEqual({ ok: true, cancel: false, patch: { status: "preparation" }, email: null });
  });
});
