import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  admin: true as boolean,
  row: null as { updated_at: string } | null,
  upserts: [] as Record<string, unknown>[],
  upsertError: false,
  revalidated: [] as string[],
}));

vi.mock("next/cache", () => ({ revalidatePath: (p: string, t?: string) => state.revalidated.push(t ? `${p}|${t}` : p) }));
vi.mock("@/lib/admin/guard", () => ({ assertAdmin: async () => (state.admin ? { id: "a", email: "a@b.c" } : null) }));
vi.mock("@/lib/supabase/admin", () => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: state.row, error: null }),
    upsert: async (v: Record<string, unknown>) => {
      state.upserts.push(v);
      return { error: state.upsertError ? { message: "boom: secret sql detail" } : null };
    },
  };
  return { createAdminClient: () => ({ from: () => builder }) };
});

import { savePageAction } from "@/app/admin/(panel)/pages/actions";

const valid = { slug: "cgv", locale: "fr", title: " Conditions ", body: "## Objet\r\n\r\nTexte", baseUpdatedAt: null };

beforeEach(() => {
  state.admin = true;
  state.row = null;
  state.upserts = [];
  state.upsertError = false;
  state.revalidated = [];
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
});

describe("pages : action d'enregistrement (admin)", () => {
  it("refuse sans session admin et n'écrit rien", async () => {
    state.admin = false;
    const r = await savePageAction(valid);
    expect(r).toMatchObject({ ok: false, code: "unauthorized" });
    expect(state.upserts).toEqual([]);
  });

  it("valide l'entrée avec Zod (slug, langue, titre, texte, bornes)", async () => {
    for (const bad of [
      { ...valid, slug: "admin" },
      { ...valid, slug: "../etc" },
      { ...valid, locale: "de" },
      { ...valid, title: "   " },
      { ...valid, title: "x".repeat(161) },
      { ...valid, body: "  " },
      { ...valid, body: "x".repeat(30001) },
      { ...valid, baseUpdatedAt: undefined },
      null,
      "texte",
    ]) {
      const r = await savePageAction(bad);
      expect(r, JSON.stringify(bad)?.slice(0, 40)).toMatchObject({ ok: false, code: "invalid" });
    }
    expect(state.upserts).toEqual([]);
  });

  it("sans base connectée : « unavailable », aucune écriture", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(await savePageAction(valid)).toMatchObject({ ok: false, code: "unavailable" });
    expect(state.upserts).toEqual([]);
  });

  it("enregistre (upsert) le texte nettoyé et revalide la page publique dans toutes les langues + l'admin", async () => {
    const r = await savePageAction(valid);
    expect(r.ok).toBe(true);
    expect(state.upserts).toHaveLength(1);
    expect(state.upserts[0]).toMatchObject({ slug: "cgv", locale: "fr", title: "Conditions", body_md: "## Objet\n\nTexte" });
    expect(typeof state.upserts[0].updated_at).toBe("string");
    expect(state.revalidated).toEqual(expect.arrayContaining(["/[lang]/cgv|page", "/fr/cgv", "/en/cgv", "/admin/pages"]));
  });

  it("détecte une modification faite ailleurs (conflit) sans écraser", async () => {
    state.row = { updated_at: "2026-10-09T10:00:00.000Z" };
    expect(await savePageAction({ ...valid, baseUpdatedAt: "2026-10-09T09:00:00.000Z" })).toMatchObject({ ok: false, code: "conflict" });
    expect(await savePageAction({ ...valid, baseUpdatedAt: null })).toMatchObject({ ok: false, code: "conflict" });
    expect(state.upserts).toEqual([]);
    // Même instant (le format de la base peut différer : microsecondes, +00:00) → accepté.
    expect(await savePageAction({ ...valid, baseUpdatedAt: "2026-10-09T10:00:00+00:00" })).toMatchObject({ ok: true });
    expect(state.upserts).toHaveLength(1);
  });

  it("une erreur de base ne fuit jamais côté client", async () => {
    state.upsertError = true;
    const r = await savePageAction(valid);
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toMatch(/boom|secret|sql/i);
  });
});
