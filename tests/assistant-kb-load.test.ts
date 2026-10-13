// loadKb (brief RAG du 2026-10-13) : même règle que le catalogue. Démo SEULEMENT sans Supabase ; base branchée mais
// vide = aucune fiche ; base injoignable = dernière lecture réussie, sinon liste vide. Jamais la démo en production.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ configured: true }));
const read = vi.hoisted(() => vi.fn());
const adminClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/env", () => ({
  supabasePublicEnv: () => (env.configured ? { url: "https://x.supabase.co", key: "k" } : null),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: adminClient }));

const query = () => {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "limit"]) q[m] = () => q;
  q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve().then(() => read()).then(ok, ko);
  return q;
};

import { KB_LEGACY_IDS, loadKb, resetKbCache } from "@/lib/assistant/kb";

const ROW = { id: "5eed0000-0000-4000-8000-000000000013", tag: "Boutique", title: "Les packs", text: "Un pack réunit…", keywords: "pack" };

beforeEach(() => {
  env.configured = true;
  resetKbCache();
  read.mockReset();
  adminClient.mockReset();
  adminClient.mockImplementation(() => ({ from: () => query() }));
});
afterEach(() => vi.useRealTimers());

describe("loadKb", () => {
  it("sans Supabase (développement) : fiches génériques de démonstration, jamais les fiches produit", async () => {
    env.configured = false;
    const fr = await loadKb("fr");
    expect(fr.length).toBeGreaterThan(0);
    expect(fr.some((e) => e.tag === "Produit")).toBe(false);
    const en = await loadKb("en");
    expect(en.some((e) => e.tag === "Product")).toBe(false);
    expect(en[0].title).not.toBe(fr[0].title);
    expect(adminClient).not.toHaveBeenCalled();
  });

  it("base branchée et VIDE : aucune fiche (pas de démo)", async () => {
    read.mockReturnValue({ data: [], error: null });
    expect(await loadKb("fr")).toEqual([]);
    expect(await loadKb("en")).toEqual([]);
  });

  it("base branchée : fiches de la base ; null en mots-clés devient une chaîne vide", async () => {
    read.mockReturnValue({ data: [{ ...ROW, keywords: null }], error: null });
    expect(await loadKb("fr")).toEqual([{ id: ROW.id, tag: "Boutique", title: "Les packs", text: "Un pack réunit…", keywords: "" }]);
  });

  it("fiches de la migration 0021 reconnues par le moteur : identifiants historiques (réponses avec les réglages)", async () => {
    const ids = Object.keys(KB_LEGACY_IDS);
    read.mockReturnValue({ data: ids.map((id) => ({ ...ROW, id })), error: null });
    expect((await loadKb("fr")).map((e) => e.id).sort()).toEqual(["kb1", "kb3", "kb4", "kb5"]);
  });

  it("erreur Supabase sans lecture précédente : liste vide, jamais la démo", async () => {
    read.mockReturnValue({ data: null, error: { code: "500" } });
    expect(await loadKb("fr")).toEqual([]);
  });

  it("clé service_role absente (le client lève) : liste vide, jamais la démo", async () => {
    adminClient.mockImplementation(() => {
      throw new Error("Supabase service_role non configuré");
    });
    expect(await loadKb("fr")).toEqual([]);
  });

  it("cache de 5 min : une seule lecture ; après expiration, base injoignable → dernière lecture réussie", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-13T10:00:00Z"), toFake: ["Date"] });
    read.mockReturnValue({ data: [ROW], error: null });
    expect(await loadKb("fr")).toHaveLength(1);
    expect(await loadKb("en")).toHaveLength(1);
    expect(read).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-10-13T10:06:00Z"));
    read.mockRejectedValue(new Error("réseau"));
    expect((await loadKb("fr")).map((e) => e.id)).toEqual([ROW.id]);
    expect(read).toHaveBeenCalledTimes(2);

    // On réessaie au prochain appel (l'échec n'est pas mis en cache) et une lecture réussie remplace le cache.
    read.mockReturnValue({ data: [], error: null });
    expect(await loadKb("fr")).toEqual([]);
    expect(read).toHaveBeenCalledTimes(3);
  });
});
