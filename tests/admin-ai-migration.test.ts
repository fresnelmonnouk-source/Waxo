import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Migration 0022 (brouillons de la base de connaissances) : contrôles statiques partout, exécution réelle sur PGlite quand
// le moteur est disponible sur la machine (outillage QA local de Kody, absent en CI → bloc ignoré).

const SQL = readFileSync(new URL("../supabase/migrations/0022_kb_drafts.sql", import.meta.url), "utf8");
const PGLITE = "C:/Users/LUFFY MKD/.kody-qa/node_modules/@electric-sql/pglite/dist/index.js";
const hasPglite = existsSync(PGLITE);

describe("0022_kb_drafts.sql : forme", () => {
  it("rejouable (if not exists / create or replace / drop if exists)", () => {
    for (const m of SQL.matchAll(/add column (?!if not exists)/gi)) throw new Error(`colonne non rejouable : ${m[0]}`);
    expect(SQL).toMatch(/create or replace function public\.kb_before_write/);
    expect(SQL).toMatch(/drop trigger if exists kb_before_write/);
    expect(SQL).toMatch(/create index if not exists/);
  });
  it("search_path figé, fonction non appelable par l'API, RLS active, pas de tiret cadratin", () => {
    expect(SQL).toMatch(/set search_path = public/);
    expect(SQL).toMatch(/revoke all on function public\.kb_before_write\(\) from public, anon, authenticated/);
    expect(SQL).toMatch(/alter table public\.kb enable row level security/);
    expect(SQL).not.toMatch(/security definer/i);
    expect(SQL).not.toContain("\u2014");
  });
});

// Socle minimal équivalent à 0001 pour la table `kb` (rôles Supabase simulés).
const BASE = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  end $$;
  create table if not exists public.kb (
    id uuid primary key default gen_random_uuid(),
    tag text not null, title text not null, text text not null,
    keywords text not null default '', active boolean not null default true
  );
  alter table public.kb enable row level security;
  grant select, insert, update, delete on public.kb to anon, authenticated;
  insert into public.kb (id, tag, title, text, keywords, active) values
    ('00000000-0000-4000-8000-000000000001', 'Livraison', 'Délais', 'Texte existant publié', 'delai', true),
    ('00000000-0000-4000-8000-000000000002', 'Autre', 'Ancienne', 'Texte existant désactivé', '', false);
`;

describe.skipIf(!hasPglite)("0022_kb_drafts.sql : exécution PGlite", () => {
  it("s'applique, se réapplique et protège les brouillons", async () => {
    const { PGlite } = (await import(/* @vite-ignore */ PGLITE)) as { PGlite: new () => { exec: (s: string) => Promise<unknown>; query: <T>(s: string, p?: unknown[]) => Promise<{ rows: T[] }>; close: () => Promise<void> } };
    const db = new PGlite();
    try {
      await db.exec(BASE);
      await db.exec(SQL);
      await db.exec(SQL); // rejouable

      // Lignes existantes : publiées, source manuelle, actif inchangé.
      const old = await db.query<{ status: string; source: string; active: boolean }>("select status, source, active from public.kb order by id");
      expect(old.rows).toEqual([
        { status: "published", source: "manual", active: true },
        { status: "published", source: "manual", active: false },
      ]);

      // Un brouillon est TOUJOURS inactif, même si on tente de l'insérer actif.
      const ins = await db.query<{ id: string; active: boolean }>(
        "insert into public.kb (tag, title, text, status, source, active) values ('Retours','Retours hors Cotonou','Texte brouillon','draft','ai',true) returning id, active",
      );
      expect(ins.rows[0].active).toBe(false);
      const id = ins.rows[0].id;

      // Repasser une fiche publiée en brouillon la désactive.
      await db.exec("update public.kb set status = 'draft', active = true where id = '00000000-0000-4000-8000-000000000001'");
      const back = await db.query<{ active: boolean }>("select active from public.kb where id = '00000000-0000-4000-8000-000000000001'");
      expect(back.rows[0].active).toBe(false);

      // Publication : statut + actif ; updated_at avance.
      const before = await db.query<{ updated_at: string }>("select updated_at from public.kb where id = $1", [id]);
      await new Promise((r) => setTimeout(r, 15));
      await db.query("update public.kb set status = 'published', active = true where id = $1", [id]);
      const after = await db.query<{ status: string; active: boolean; updated_at: string }>("select status, active, updated_at from public.kb where id = $1", [id]);
      expect(after.rows[0]).toMatchObject({ status: "published", active: true });
      expect(new Date(after.rows[0].updated_at).getTime()).toBeGreaterThan(new Date(before.rows[0].updated_at).getTime());

      // Valeurs hors liste refusées.
      await expect(db.exec("update public.kb set status = 'archived'")).rejects.toThrow();
      await expect(db.exec("update public.kb set source = 'robot'")).rejects.toThrow();

      // Le filtre de l'assistant client (active = true) ne voit aucun brouillon.
      const visible = await db.query<{ n: number }>("select count(*)::int as n from public.kb where active and status = 'draft'");
      expect(visible.rows[0].n).toBe(0);

      // Droits : écritures retirées à anon / authenticated, fonction de trigger non exécutable par eux.
      const priv = await db.query<{ ins: boolean; fn: boolean }>(
        "select has_table_privilege('anon','public.kb','INSERT') as ins, has_function_privilege('authenticated','public.kb_before_write()','EXECUTE') as fn",
      );
      expect(priv.rows[0]).toEqual({ ins: false, fn: false });
    } finally {
      await db.close();
    }
  }, 30_000);
});
