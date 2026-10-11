import { describe, expect, it } from "vitest";
import { addDecision, normalizeEmail, revokeDecision } from "@/lib/admin/team";

describe("équipe admin : e-mail", () => {
  it("normalise et refuse les adresses invalides", () => {
    expect(normalizeEmail("  Awa@Exemple.COM ")).toBe("awa@exemple.com");
    expect(normalizeEmail("pas-un-email")).toBeNull();
    expect(normalizeEmail("a b@c.d")).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
    expect(normalizeEmail(`${"x".repeat(250)}@a.bj`)).toBeNull();
  });
});

describe("équipe admin : ajout", () => {
  it("sans compte : invitation", () => expect(addDecision(null)).toBe("invite"));
  it("compte confirmé : promotion", () => expect(addDecision({ emailConfirmed: true, invited: false, isAdmin: false })).toBe("grant"));
  it("déjà admin : refus", () => expect(addDecision({ emailConfirmed: true, invited: false, isAdmin: true })).toBe("already"));
  it("compte jamais confirmé (adresse non prouvée) : refus", () =>
    expect(addDecision({ emailConfirmed: false, invited: false, isAdmin: false })).toBe("unconfirmed"));
  it("invitation en attente : promotion (seul le détenteur de la boîte peut l'activer)", () =>
    expect(addDecision({ emailConfirmed: false, invited: true, isAdmin: false })).toBe("grant"));
});

describe("équipe admin : retrait", () => {
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";
  it("jamais soi-même", () => expect(revokeDecision({ actorId: A, targetId: A, adminIds: [A, B] })).toBe("self"));
  it("jamais le dernier admin", () => expect(revokeDecision({ actorId: B, targetId: A, adminIds: [A] })).toBe("last"));
  it("cible déjà non admin", () => expect(revokeDecision({ actorId: A, targetId: B, adminIds: [A] })).toBe("not_admin"));
  it("autre admin parmi plusieurs : autorisé", () => expect(revokeDecision({ actorId: A, targetId: B, adminIds: [A, B] })).toBe("ok"));
});
