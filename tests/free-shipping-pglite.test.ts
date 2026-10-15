// Migrations 0025 (rubriques + livraison offerte par produit) et 0026 (livraison offerte PAR PACK) rejouées sur un vrai
// Postgres en mémoire (PGlite), avec TOUTE la chaîne 0001 → 0026 : réapplication, retours arrière, contraintes, et surtout
// la règle de place_order — livraison offerte à Cotonou & Calavi seulement si TOUTES les lignes sont « offertes » (produit :
// sa case ; pack : SA case, quelles que soient celles de ses produits), franco habituel sinon, « autre » inchangé.
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
const HIDDEN = "a4444444-4444-4444-8444-444444444444";
/** Pack NON coché dont tous les produits sont cochés (règle 0025 : offert ; règle 0026 : payant). */
const PACK_PRODS_FREE = "b1111111-1111-4111-8111-111111111111";
/** Pack COCHÉ contenant un produit non coché (règle 0025 : payant ; règle 0026 : offert). */
const PACK_CHECKED = "b2222222-2222-4222-8222-222222222222";
/** Pack coché contenant un produit inactif (masqué de la boutique). */
const PACK_INACTIVE_ITEM = "b3333333-3333-4333-8333-333333333333";

let db: Db;
let phoneN = 0;

type Item = { kind: "product" | "pack"; id: string; qty: number };
type Placed = { subtotal: number; shipping_fee: number; total: number };
const PLACE = "select subtotal, shipping_fee, total from public.place_order($1::jsonb, $2::jsonb, $3, 'cod')";
function placeParams(items: Item[], zone: "cotonou" | "autre") {
  phoneN += 1; // plafond de 3 commandes ouvertes par téléphone : un numéro par commande
  const customer = { name: "Test Client", phone: `+2290100000${String(phoneN).padStart(3, "0")}`, email: "", address: "Cotonou, Akpakpa" };
  return [JSON.stringify(items), JSON.stringify(customer), zone];
}
async function place(items: Item[], zone: "cotonou" | "autre"): Promise<Placed> {
  const { rows } = await db.query<Placed>(PLACE, placeParams(items, zone));
  return rows[0];
}
const fee = async (items: Item[], zone: "cotonou" | "autre" = "cotonou") => (await place(items, zone)).shipping_fee;
const pack = (id: string, qty = 1): Item => ({ kind: "pack", id, qty });
const product = (id: string, qty = 1): Item => ({ kind: "product", id, qty });

async function error(sql: string, params?: unknown[]): Promise<string> {
  try {
    await db.query(sql, params);
    return "ok";
  } catch (e) {
    return String((e as Error).message);
  }
}

const packColumnExists = async () =>
  (await db.query<{ n: number }>(
    "select count(*)::int as n from information_schema.columns where table_schema = 'public' and table_name = 'packs' and column_name = 'free_shipping'",
  )).rows[0].n === 1;

describe.skipIf(!available)("livraison offerte par produit (0025) et par pack (0026) sur PGlite (chaîne 0001 → 0026)", () => {
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
         ($1, 'maison', 3000, 100, true, true), ($2, 'maison', 2000, 100, true, true), ($3, 'maison', 4000, 100, true, false),
         ($4, 'maison', 1000, 100, false, true)`,
      [FREE_A, FREE_B, PAID, HIDDEN],
    );
    await db.query(
      `insert into public.product_translations (product_id, locale, name, slug, description) values
         ($1, 'fr', 'Gourde', 'gourde-t', 'Gourde isotherme.'), ($2, 'fr', 'Bol', 'bol-t', 'Bol en bambou.'),
         ($3, 'fr', 'Lampe', 'lampe-t', 'Lampe rechargeable.'), ($4, 'fr', 'Tasse', 'tasse-t', 'Tasse masquée.')`,
      [FREE_A, FREE_B, PAID, HIDDEN],
    );
    await db.query(
      `insert into public.packs (id, price, active, free_shipping) values ($1, 4500, true, false), ($2, 6500, true, true), ($3, 3500, true, true)`,
      [PACK_PRODS_FREE, PACK_CHECKED, PACK_INACTIVE_ITEM],
    );
    await db.query(
      `insert into public.pack_translations (pack_id, locale, name, slug, description) values
         ($1, 'fr', 'Pack produits offerts', 'pack-produits-offerts-t', 'Deux produits cochés.'),
         ($2, 'fr', 'Pack coché', 'pack-coche-t', 'Un produit non coché.'),
         ($3, 'fr', 'Pack produit masqué', 'pack-masque-t', 'Un produit inactif.')`,
      [PACK_PRODS_FREE, PACK_CHECKED, PACK_INACTIVE_ITEM],
    );
    await db.query(
      `insert into public.pack_items (pack_id, product_id, qty) values
         ($1, $4, 1), ($1, $5, 1), ($2, $4, 1), ($2, $6, 1), ($3, $4, 1), ($3, $7, 1)`,
      [PACK_PRODS_FREE, PACK_CHECKED, PACK_INACTIVE_ITEM, FREE_A, FREE_B, PAID, HIDDEN],
    );
  });

  it("rejouable : réappliquer 0025 puis 0026 ne casse rien et garde les cases (produits et packs)", async () => {
    await db.exec(mig("0025_product_details_free_shipping.sql"));
    await db.exec(mig("0026_pack_free_shipping.sql"));
    await db.exec(mig("0026_pack_free_shipping.sql"));
    const p = await db.query<{ free_shipping: boolean }>("select free_shipping from public.products where id = $1", [FREE_A]);
    expect(p.rows[0].free_shipping).toBe(true);
    const k = await db.query<{ id: string; free_shipping: boolean }>("select id, free_shipping from public.packs where id = any($1::uuid[])", [
      [PACK_PRODS_FREE, PACK_CHECKED, PACK_INACTIVE_ITEM],
    ]);
    expect(Object.fromEntries(k.rows.map((r) => [r.id, r.free_shipping]))).toEqual({
      [PACK_INACTIVE_ITEM]: true,
      [PACK_PRODS_FREE]: false,
      [PACK_CHECKED]: true,
    });
    expect(await fee([pack(PACK_CHECKED)])).toBe(0); // règle 0026 bien en place après le rejeu
  });

  it("valeurs par défaut : produit et pack nouveaux décochés, rubriques vides", async () => {
    const { rows } = await db.query<{ free_shipping: boolean; color: string; care: string }>(
      `select p.free_shipping, t.color, t.care from public.products p join public.product_translations t on t.product_id = p.id where p.id = $1`,
      [PAID],
    );
    expect(rows[0]).toEqual({ free_shipping: false, color: "", care: "" });
    const k = await db.query<{ free_shipping: boolean }>("insert into public.packs (price, active) values (1000, false) returning free_shipping");
    expect(k.rows[0].free_shipping).toBe(false);
  });

  it("tout le panier coché, Cotonou & Calavi : livraison offerte même sous le franco", async () => {
    const r = await place([product(FREE_A), product(FREE_B)], "cotonou");
    expect(r).toEqual({ subtotal: 5000, shipping_fee: 0, total: 5000 });
  });

  it("un produit non coché dans le panier : tarif habituel (1 000 F)", async () => {
    const r = await place([product(FREE_A), product(PAID)], "cotonou");
    expect(r).toEqual({ subtotal: 7000, shipping_fee: 1000, total: 8000 });
  });

  it("panier mixte au-dessus du franco : toujours offerte (règle 15 000 F inchangée)", async () => {
    const r = await place([product(PAID, 4)], "cotonou");
    expect(r.shipping_fee).toBe(0);
    expect(r.subtotal).toBe(16000);
  });

  it("hors Cotonou & Calavi : les cases ne changent rien (2 500 F), produit ou pack coché", async () => {
    expect(await place([product(FREE_A)], "autre")).toEqual({ subtotal: 3000, shipping_fee: 2500, total: 5500 });
    expect(await place([pack(PACK_CHECKED)], "autre")).toEqual({ subtotal: 6500, shipping_fee: 2500, total: 9000 });
  });

  it("pack coché : offert à Cotonou & Calavi même si un de ses produits ne l'est pas", async () => {
    expect(await place([pack(PACK_CHECKED)], "cotonou")).toEqual({ subtotal: 6500, shipping_fee: 0, total: 6500 });
  });

  it("pack non coché : payant même si tous ses produits sont cochés", async () => {
    expect(await place([pack(PACK_PRODS_FREE)], "cotonou")).toEqual({ subtotal: 4500, shipping_fee: 1000, total: 5500 });
  });

  it("paniers mélangés : offert seulement si TOUTES les lignes le sont (un seul frais par commande)", async () => {
    expect(await fee([pack(PACK_CHECKED), product(PAID)])).toBe(1000); // pack coché + produit non coché
    expect(await fee([pack(PACK_CHECKED), product(FREE_A)])).toBe(0); // pack coché + produit coché
    expect(await fee([pack(PACK_CHECKED), pack(PACK_PRODS_FREE)])).toBe(1000); // pack coché + pack non coché
    expect(await fee([pack(PACK_CHECKED, 2)])).toBe(0); // quantité sans effet
  });

  it("la case d'un pack ne rend pas gratuits ses produits achetés séparément", async () => {
    expect(await fee([product(PAID)])).toBe(1000); // PAID est dans PACK_CHECKED
  });

  it("franco inchangé : pack non coché au-dessus de 15 000 F → offerte", async () => {
    expect(await fee([pack(PACK_PRODS_FREE, 3)])).toBe(1000); // 13 500 F
    expect(await fee([pack(PACK_PRODS_FREE, 4)])).toBe(0); // 18 000 F
  });

  it("produit inactif dans un pack (même coché) : refus out_of_stock comme avant, stock intact", async () => {
    const before = await db.query<{ stock: number }>("select stock from public.products where id = $1", [FREE_A]);
    expect(await error(PLACE, placeParams([pack(PACK_INACTIVE_ITEM)], "cotonou"))).toMatch(/out_of_stock/);
    const after = await db.query<{ stock: number }>("select stock from public.products where id = $1", [FREE_A]);
    expect(after.rows[0].stock).toBe(before.rows[0].stock);
  });

  it("contraintes : couleur ≤ 200 caractères, rubrique longue ≤ 3 000", async () => {
    expect(await error("update public.product_translations set color = repeat('x', 201) where product_id = $1", [PAID])).toMatch(/check/i);
    expect(await error("update public.product_translations set specs = repeat('x', 3001) where product_id = $1", [PAID])).toMatch(/check/i);
    expect(await error("update public.product_translations set color = 'Noir mat', care = 'Laver à la main' where product_id = $1", [PAID])).toBe("ok");
  });

  it("retour arrière 0026_down puis réapplication de 0026 : règle 0025 des packs, colonne retirée puis remise", async () => {
    await db.exec(readFileSync(join(process.cwd(), "supabase", "0026_down.sql"), "utf8"));
    expect(await packColumnExists()).toBe(false);
    expect(await fee([pack(PACK_PRODS_FREE)])).toBe(0); // règle 0025 : tous ses produits cochés
    expect(await fee([pack(PACK_CHECKED)])).toBe(1000); // règle 0025 : un produit non coché
    expect(await fee([product(FREE_A)])).toBe(0); // cases produits intactes
    await db.exec(mig("0026_pack_free_shipping.sql"));
    expect(await packColumnExists()).toBe(true);
    expect(await fee([pack(PACK_PRODS_FREE)])).toBe(1000); // colonne recréée : tous les packs décochés
    expect(await fee([pack(PACK_CHECKED)])).toBe(1000);
    await db.query("update public.packs set free_shipping = true where id in ($1, $2)", [PACK_CHECKED, PACK_INACTIVE_ITEM]);
    expect(await fee([pack(PACK_CHECKED)])).toBe(0);
  });

  it("retour arrière 0025_down APRÈS 0026 : produits ET packs décochés (Z2a), règles rétablies au rejeu 0025 + 0026", async () => {
    await db.query("update public.product_translations set color = 'Noir mat' where product_id = $1", [FREE_A]);
    await db.query("update public.packs set free_shipping = true where id in ($1, $2)", [PACK_CHECKED, PACK_INACTIVE_ITEM]);
    await db.exec(readFileSync(join(process.cwd(), "supabase", "0025_down.sql"), "utf8"));
    expect(await fee([product(FREE_A)])).toBe(1000); // règle 0015
    expect(await fee([pack(PACK_CHECKED)])).toBe(1000);
    // Le code déployé lit toujours la case des packs : elle doit être décochée, sinon « offerte » affichée et 1 000 F facturés.
    const packs = await db.query<{ n: number }>("select count(*)::int as n from public.packs where free_shipping");
    expect(packs.rows[0].n).toBe(0);
    const prods = await db.query<{ n: number }>("select count(*)::int as n from public.products where free_shipping");
    expect(prods.rows[0].n).toBe(0);
    const kept = await db.query<{ color: string }>("select color from public.product_translations where product_id = $1", [FREE_A]);
    expect(kept.rows[0].color).toBe("Noir mat");
    await db.exec(mig("0025_product_details_free_shipping.sql"));
    await db.exec(mig("0026_pack_free_shipping.sql"));
    await db.query("update public.products set free_shipping = true where id in ($1, $2)", [FREE_A, FREE_B]); // le down décoche les produits
    await db.query("update public.packs set free_shipping = true where id = $1", [PACK_CHECKED]); // … et les packs
    expect(await fee([product(FREE_A)])).toBe(0);
    expect(await fee([pack(PACK_CHECKED)])).toBe(0);
  });

  it("0025_down sans la colonne des packs (0026_down d'abord) : le bloc conditionnel ne casse rien", async () => {
    await db.exec(readFileSync(join(process.cwd(), "supabase", "0026_down.sql"), "utf8"));
    expect(await packColumnExists()).toBe(false);
    await db.exec(readFileSync(join(process.cwd(), "supabase", "0025_down.sql"), "utf8"));
    expect(await fee([product(FREE_A)])).toBe(1000);
    await db.exec(mig("0025_product_details_free_shipping.sql"));
    await db.exec(mig("0026_pack_free_shipping.sql"));
    expect(await packColumnExists()).toBe(true);
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
