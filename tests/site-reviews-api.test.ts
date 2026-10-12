// POST /api/site-reviews : réservé aux clients connectés ayant une commande livrée ; toujours « à valider ».
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const deliveredCount = vi.fn();
const insert = vi.fn();
const chain = (end: () => unknown) => {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "or", "maybeSingle"]) q[m] = () => q;
  q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(end()).then(ok, ko);
  return q;
};
vi.mock("@/lib/supabase/env", () => ({ supabasePublicEnv: () => ({ url: "https://x.supabase.co", key: "k" }) }));
vi.mock("@/lib/supabase/server", () => ({ createSessionClient: async () => ({ auth: { getUser } }) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) =>
      t === "profiles"
        ? chain(() => ({ data: { first_name: "Afi", last_name: "Houngbédji", phone: "0197000000" }, error: null }))
        : t === "orders"
          ? chain(() => deliveredCount())
          : { insert: (row: unknown) => insert(row) },
  }),
}));
vi.mock("@/lib/ratelimit", () => ({ rateLimitShared: async () => true }));

import { POST } from "@/app/api/site-reviews/route";

const call = (b: Record<string, unknown>) =>
  POST(new Request("http://localhost/api/site-reviews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang: "fr", website: "", t: Date.now() - 10_000, ...b }) }));
const ok = { rating: 5, body: "Livraison le jour même, très bon service." };

beforeEach(() => {
  for (const m of [getUser, deliveredCount, insert]) m.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  deliveredCount.mockReturnValue({ count: 1, error: null });
  insert.mockResolvedValue({ error: null });
});

describe("POST /api/site-reviews", () => {
  it("client livré : avis enregistré « à valider », vérifié, nom abrégé du profil", async () => {
    const res = await call(ok);
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ author: "Afi H.", status: "pending", verified: true, source: "client" }));
  });
  it("non connecté → 401", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await call(ok)).status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });
  it("aucune commande livrée → 403 not_eligible", async () => {
    deliveredCount.mockReturnValue({ count: 0, error: null });
    const res = await call(ok);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("not_eligible");
    expect(insert).not.toHaveBeenCalled();
  });
  it("déjà un avis → 409 avec message boutique", async () => {
    insert.mockResolvedValue({ error: { code: "23505" } });
    const json = await (await call(ok)).json();
    expect(json.code).toBe("already_reviewed");
    expect(json.message).toMatch(/boutique/);
  });
  it("texte trop court ou note invalide → 400 sans écriture", async () => {
    expect((await call({ rating: 5, body: "Bien" })).status).toBe(400);
    expect((await call({ rating: 9, body: "Livraison rapide et soignée." })).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });
  it("robot (champ caché rempli) → 400", async () => {
    expect((await call({ ...ok, website: "spam" })).status).toBe(400);
  });
});
