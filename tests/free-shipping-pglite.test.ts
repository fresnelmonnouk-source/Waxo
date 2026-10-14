// Migration 0025 (rubriques + livraison offerte par produit) rejouée sur un vrai Postgres en mémoire (PGlite), avec TOUTE
// la chaîne 0001 → 0025 : réapplication, contraintes de longueur, et surtout la règle de place_order — livraison offerte à
// Cotonou & Calavi seulement si TOUT le panier est coché (pack : tous ses produits), franco habituel sinon, « autre » inchangé.
// PGlite n'est pas une dépendance du dépôt : cherché dans PGLITE_DIR, sinon dans le dossier QA de Kody. Absent → ignoré.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const PGLITE_DIR = process.env.PGLITE_DIR || "C:/Users/LUFFY MKD/.kody-qa/node_modules/@electric-sql/pglite";
const entry = join(PGLITE_DIR, "dist", "index.js");
const available = existsSync(entry);

type Db = {
  exec(sql: string): Promise<unknown>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

const DIR = join(process.cwd(), "supabase", "migrations");
const mig = (f: string) => readFileSync(join(DIR, f), "utf8");

const HARNESS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb not null default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select 'anon'::text $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

const FREE_A = "a1111111-1111-4111-8111-111111111111";
const FREE_B = "a2222222-2222-4222-8222-222222222222";
const PAID = "a3333333-3333-4333-8333-333333333333";
const PACK_FREE = "b1111111-1111-4111-8111-111111111111";
const PACK_MIXED = "b2222222-2222-4222-8222-222222222222";

let db: Db;
let phoneN = 0;

type Placed = { subtotal: number; shipping_fee: number; total: number };
async function place(items: { kind: "product" | "pack"; id: string; qty: number }[], zone: "cotonou" | "autre"): Promise<Placed> {
  phoneN += 1; // plafond de 3 commandes ouvertes par téléphone : un numéro par commande
  const customer = { name: "Test Client", phone: `+2290100000${String(phoneN).padStart(3, "0")}`, email: "", address: "Cotonou, Akpakpa" };
  const { rows } = await db.query<Placed>("select subtotal, shipping_fee, total from public.place_order($1::jsonb, $2::jsonb, $3, 'cod')", [
    JSON.stringify(items),
    JSON.stringify(customer),
    zone,
  ]);
  return rows[0];
}

async function error(sql: string, params?: unknown[]): Promise<string> {
  try {
    await db.query(sql, params);
    return "ok";
  } catch (e) {
    return String((e as Error).message);
  }
}

describe.skipIf(!available)("0025 livraison offerte par produit sur PGlite (chaîne 0001 → 0025)", () => {
  beforeAll(async () => {
    const mod = (await import(/* @vite-ignore */ pathToFileURL(entry).href)) as { PGlite: new () => Db };
    db = new mod.PGlite();
    await db.exec(HARNESS);
    for (const f of readdirSync(DIR).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort()) await db.exec(mig(f));
    // Réglages connus : 1 000 F Cotonou & Calavi, 2 500 F ailleurs, franco dès 15 000 F, paiement à la livraison actif.
    await db.exec(`
      insert into public.settings (key, value, is_public) values
        ('shipping', '{"cotonou":1000,"autre":2500,"freeFrom":15000,"cutoff":20,"returnDays":7}', true),
        ('pay', '{"momo":false,"moov":false,"celtiis":false,"carte":false,"cod":true}', true)
      on conflict (key) do update set value = excluded.value;
      insert into public.categories (id, label_fr, label_en, bg) values ('maison', 'Maison', 'Home', '#EDE4CF') on conflict (id) do nothing;
    `);
    await db.query(
      `insert into public.products (id, category_id, price, stock, active, free_shipping) values
         ($1, 'maison', 3000, 100, true, true), ($2, 'maison', 2000, 100, true, true), ($3, 'maison', 4000, 100, true, false)`,
      [FREE_A, FREE_B, PAID],
    );
    await db.query(
      `insert into public.product_translations (product_id, locale, name, slug, description) values
         ($1, 'fr', 'Gourde', 'gourde-t', 'Gourde isotherme.'), ($2, 'fr', 'Bol', 'bol-t', 'Bol en bambou.'),
         ($3, 'fr', 'Lampe', 'lampe-t', 'Lampe rechargeable.')`,
      [FREE_A, FREE_B, PAID],
    );
    await db.query(`insert into public.packs (id, price, active) values ($1, 4500, true), ($2, 6500, true)`, [PACK_FREE, PACK_MIXED]);
    await db.query(
      `insert into public.pack_translations (pack_id, locale, name, slug, description) values
         ($1, 'fr', 'Pack offert', 'pack-offert-t', 'Deux produits.'), ($2, 'fr', 'Pack mixte', 'pack-mixte-t', 'Deux produits.')`,
      [PACK_FREE, PACK_MIXED],
    );
    await db.query(
      `insert into public.pack_items (pack_id, product_id, qty) values ($1, $3, 1), ($1, $4, 1), ($2, $3, 1), ($2, $5, 1)`,
      [PACK_FREE, PACK_MIXED, FREE_A, FREE_B, PAID],
    );
  });

  it("rejouable : réappliquer 0025 ne casse rien et garde les valeurs", async () => {
    await db.exec(mig("0025_product_details_free_shipping.sql"));
    const { rows } = await db.query<{ free_shipping: boolean }>("select free_shipping from public.products where id = $1", [FREE_A]);
    expect(rows[0].free_shipping).toBe(true);
  });

  it("nouveaux produits : livraison offerte décochée et rubriques vides par défaut", async () => {
    const { rows } = await db.query<{ free_shipping: boolean; color: string; care: string }>(
      `select p.free_shipping, t.color, t.care from public.products p join public.product_translations t on t.product_id = p.id where p.id = $1`,
      [PAID],
    );
    expect(rows[0]).toEqual({ free_shipping: false, color: "", care: "" });
  });

  it("tout le panier coché, Cotonou & Calavi : livraison offerte même sous le franco", async () => {
    const r = await place([{ kind: "product", id: FREE_A, qty: 1 }, { kind: "product", id: FREE_B, qty: 1 }], "cotonou");
    expect(r).toEqual({ subtotal: 5000, shipping_fee: 0, total: 5000 });
  });

  it("un produit non coché dans le panier : tarif habituel (1 000 F)", async () => {
    const r = await place([{ kind: "product", id: FREE_A, qty: 1 }, { kind: "product", id: PAID, qty: 1 }], "cotonou");
    expect(r).toEqual({ subtotal: 7000, shipping_fee: 1000, total: 8000 });
  });

  it("panier mixte au-dessus du franco : toujours offerte (règle 15 000 F inchangée)", async () => {
    const r = await place([{ kind: "product", id: PAID, qty: 4 }], "cotonou");
    expect(r.shipping_fee).toBe(0);
    expect(r.subtotal).toBe(16000);
  });

  it("hors Cotonou & Calavi : la case ne change rien (2 500 F)", async () => {
    const r = await place([{ kind: "product", id: FREE_A, qty: 1 }], "autre");
    expect(r).toEqual({ subtotal: 3000, shipping_fee: 2500, total: 5500 });
  });

  it("pack dont tous les produits sont cochés : offerte ; pack avec un produit non coché : payante", async () => {
    expect((await place([{ kind: "pack", id: PACK_FREE, qty: 1 }], "cotonou")).shipping_fee).toBe(0);
    expect((await place([{ kind: "pack", id: PACK_MIXED, qty: 1 }], "cotonou")).shipping_fee).toBe(1000);
    expect((await place([{ kind: "pack", id: PACK_FREE, qty: 1 }, { kind: "product", id: PAID, qty: 1 }], "cotonou")).shipping_fee).toBe(1000);
  });

  it("contraintes : couleur ≤ 200 caractères, rubrique longue ≤ 3 000", async () => {
    expect(await error("update public.product_translations set color = repeat('x', 201) where product_id = $1", [PAID])).toMatch(/check/i);
    expect(await error("update public.product_translations set specs = repeat('x', 3001) where product_id = $1", [PAID])).toMatch(/check/i);
    expect(await error("update public.product_translations set color = 'Noir mat', care = 'Laver à la main' where product_id = $1", [PAID])).toBe("ok");
  });

  it("retour arrière 0025_down puis réapplication de 0025 : règle retirée puis rétablie, rubriques conservées", async () => {
    await db.query("update public.product_translations set color = 'Noir mat' where product_id = $1", [FREE_A]);
    await db.exec(readFileSync(join(process.cwd(), "supabase", "0025_down.sql"), "utf8"));
    expect((await place([{ kind: "product", id: FREE_A, qty: 1 }], "cotonou")).shipping_fee).toBe(1000); // règle 0015
    const kept = await db.query<{ color: string }>("select color from public.product_translations where product_id = $1", [FREE_A]);
    expect(kept.rows[0].color).toBe("Noir mat");
    await db.exec(mig("0025_product_details_free_shipping.sql"));
    await db.query("update public.products set free_shipping = true where id in ($1, $2)", [FREE_A, FREE_B]); // le down décoche tout
    expect((await place([{ kind: "product", id: FREE_A, qty: 1 }], "cotonou")).shipping_fee).toBe(0);
  });

  it("place_order reste interdit à anon et authenticated (EXECUTE révoqué)", async () => {
    const { rows } = await db.query<{ anon: boolean; auth: boolean; svc: boolean }>(
      `select has_function_privilege('anon', 'public.place_order(jsonb, jsonb, text, text, uuid)', 'execute') as anon,
              has_function_privilege('authenticated', 'public.place_order(jsonb, jsonb, text, text, uuid)', 'execute') as auth,
              has_function_privilege('service_role', 'public.place_order(jsonb, jsonb, text, text, uuid)', 'execute') as svc`,
    );
    expect(rows[0]).toEqual({ anon: false, auth: false, svc: true });
  });
});
