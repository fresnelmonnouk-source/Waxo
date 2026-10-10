import { describe, expect, it, vi } from "vitest";

const getAdmin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin/guard", () => ({ getAdmin: () => getAdmin() }));

import { GET } from "@/app/api/admin/sentry-test/route";

describe("GET /api/admin/sentry-test", () => {
  it("sans session admin : 404, aucune erreur levée, rien de révélé", async () => {
    getAdmin.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Not found");
  });
  it("avec une session admin : lève l'erreur de test (c'est ce que Sentry doit recevoir)", async () => {
    getAdmin.mockResolvedValue({ id: "a", email: "a@b.bj" });
    await expect(GET()).rejects.toThrow(/Test Sentry/);
  });
});
