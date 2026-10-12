// Régression (2026-10-12) : après la purge, la base branchée mais VIDE affichait le catalogue de démo inclus dans le code.
// Base branchée : vide = boutique vide ; injoignable = erreur (la page ISR garde sa version en cache), jamais la démo.
import { beforeEach, describe, expect, it, vi } from "vitest";

const products = vi.fn();
const empty = { data: [], error: null };
const query = (result: () => unknown) => {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "gt", "order", "in", "limit", "maybeSingle"]) q[m] = () => q;
  q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(result()).then(ok, ko);
  return q;
};
vi.mock("@/lib/supabase/env", () => ({ supabasePublicEnv: () => ({ url: "https://x.supabase.co", key: "k" }) }));
vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({ from: (t: string) => query(() => (t === "products" ? products() : empty)) }),
}));

import { getProducts, getReviews } from "@/lib/catalog";
import { getPacks } from "@/lib/catalog/packs";

beforeEach(() => products.mockReset());

describe("catalogue en production : jamais la démo", () => {
  it("base branchée et vide → 0 produit, 0 pack (pas de produits fictifs)", async () => {
    products.mockReturnValue(empty);
    expect(await getProducts("fr")).toEqual([]);
    expect(await getPacks("fr")).toEqual([]);
  });
  it("base injoignable → erreur (pas de repli démo)", async () => {
    products.mockReturnValue({ data: null, error: { code: "500" } });
    await expect(getProducts("en")).rejects.toThrow("catalog_unavailable");
  });
  it("avis : jamais les avis de démo quand la base est branchée", async () => {
    expect(await getReviews("5b4e688a-1bb0-4e16-aeb8-a933014cd3ac")).toEqual([]);
  });
});
