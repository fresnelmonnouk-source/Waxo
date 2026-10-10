import { beforeEach, describe, expect, it, vi } from "vitest";
import { DATA } from "./accountant-fixture";

const assertAdmin = vi.fn();
vi.mock("@/lib/admin/guard", () => ({ assertAdmin: () => assertAdmin() }));
vi.mock("@/lib/accountant/data", () => ({
  loadAccountantData: async () => ({ data: DATA, demo: true }),
  dbWriters: () => ({
    addEntry: async () => ({ ok: false, code: "unavailable", message: "x" }),
    setCost: async () => ({ ok: false, code: "unavailable", message: "x" }),
  }),
}));

import { POST } from "@/app/api/admin/accountant/route";
import { resetLimiter } from "@/lib/accountant/schema";

const req = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost:3007/api/admin/accountant", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost:3007", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const q = (text: string) => ({ messages: [{ role: "user", text }] });

beforeEach(() => {
  resetLimiter();
  assertAdmin.mockReset();
  assertAdmin.mockResolvedValue({ id: "a1", email: "a@b.c" });
  vi.stubEnv("DEEPSEEK_API_KEY", "");
});

describe("POST /api/admin/accountant", () => {
  it("401 sans admin", async () => {
    assertAdmin.mockResolvedValue(null);
    expect((await POST(req(q("marge")))).status).toBe(401);
  });
  it("répond de façon déterministe sans clé LLM", async () => {
    const res = await POST(req(q("Quelle est ma marge ce mois-ci ?")));
    const j = await res.json();
    expect(res.status).toBe(200);
    expect(j).toMatchObject({ ok: true, mode: "deterministic", changed: false });
    expect(j.reply).toContain("marge brute");
  });
  it("mode démo : l'écriture est refusée proprement", async () => {
    const j = await (await POST(req(q("J'ai payé 20 000 F de pub hier")))).json();
    expect(j.ok).toBe(true);
    expect(j.changed).toBe(false);
    expect(j.reply).toContain("mode démo");
  });
  it("400 : JSON invalide, schéma, message trop long, dernier message non utilisateur, champ inconnu", async () => {
    expect((await POST(req("pas du json"))).status).toBe(400);
    expect((await POST(req({ messages: [] }))).status).toBe(400);
    expect((await POST(req(q("x".repeat(501))))).status).toBe(400);
    expect((await POST(req({ messages: [{ role: "assistant", text: "a" }] }))).status).toBe(400);
    expect((await POST(req({ ...q("a"), extra: 1 }))).status).toBe(400);
    expect((await POST(req({ ...q("a"), month: "2026-13" }))).status).toBe(400);
  });
  it("413 si le corps dépasse la limite", async () => {
    expect((await POST(req(JSON.stringify({ messages: [{ role: "user", text: "a" }], pad: "x".repeat(9000) })))).status).toBe(413);
  });
  it("403 sans JSON ou depuis une autre origine", async () => {
    expect((await POST(req(q("a"), { "content-type": "text/plain" }))).status).toBe(403);
    expect((await POST(req(q("a"), { origin: "https://evil.example" }))).status).toBe(403);
  });
  it("429 au-delà de 20 requêtes par minute", async () => {
    for (let i = 0; i < 20; i++) await POST(req(q("marge")));
    expect((await POST(req(q("marge")))).status).toBe(429);
  });
});
