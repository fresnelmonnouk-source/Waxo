// Migration 0024 (photos multiples) rejouée sur un vrai Postgres en mémoire (PGlite) : application, réapplication, reprise
// de `image_url`, contrainte (8 au plus, bucket `products`, sans doublon), trigger image_url = images[1] pour l'ancien ET le
// nouveau code, RLS inchangée (anon lit la colonne des produits actifs, pas des masqués).
// PGlite n'est pas une dépendance du dépôt : cherché dans PGLITE_DIR, sinon dans le dossier QA de Kody. Absent → ignoré.
import { existsSync, readFileSync } from "node:fs";
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

const mig = (f: string) => readFileSync(join(process.cwd(), "supabase", "migrations", f), "utf8");

const HARNESS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb not null default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

const BUCKET = "https://btarkkjimnkmiaxzonzq.supabase.co/storage/v1/object/public/products";
const u = (n: number | string) => `${BUCKET}/2026/10/p${n}.webp`;
const WITH_PHOTO = "11111111-1111-4111-8111-111111111111";
const NO_PHOTO = "22222222-2222-4222-8222-222222222222";
const LEGACY_URL = "33333333-3333-4333-8333-333333333333";
const HIDDEN = "44444444-4444-4444-8444-444444444444";

let db: Db;

type Row = { images: string[]; image_url: string | null };
const row = async (id: string): Promise<Row> =>
  (await db.query<Row>("select images, image_url from public.products where id = $1", [id])).rows[0];

async function error(sql: string, params?: unknown[]): Promise<string> {
  try {
    await db.query(sql, params);
    return "ok";
  } catch (e) {
    return String((e as Error).message);
  }
}

describe.skipIf(!available)("0024_product_images sur PGlite", () => {
  beforeAll(async () => {
    const mod = (await import(/* @vite-ignore */ pathToFileURL(entry).href)) as { PGlite: new () => Db };
    db = new mod.PGlite();
    await db.exec(HARNESS);
    await db.exec(mig("0001_core.sql"));
    await db.exec(mig("0019_products_updated_at.sql"));
    await db.exec("insert into public.categories (id, label_fr, label_en, bg) values ('maison', 'Maison', 'Home', '#EDE4CF') on conflict (id) do nothing");
    // Produits existants AVANT 0024 (reprise).
    await db.query(
      `insert into public.products (id, category_id, price, image_url, active) values
       ($1, 'maison', 5000, $5, true),
       ($2, 'maison', 3000, null, true),
       ($3, 'maison', 4000, 'https://exemple.com/ancienne.jpg', true),
       ($4, 'maison', 2000, null, false)`,
      [WITH_PHOTO, NO_PHOTO, LEGACY_URL, HIDDEN, u("cover")],
    );
    await db.exec(mig("0024_product_images.sql"));
  });

  it("reprise : images = [image_url] pour une photo du bucket, vide sinon ; image_url conservée", async () => {
    expect(await row(WITH_PHOTO)).toEqual({ images: [u("cover")], image_url: u("cover") });
    expect(await row(NO_PHOTO)).toEqual({ images: [], image_url: null });
    // Ancienne URL hors bucket : non reprise (la contrainte la refuserait), mais toujours affichée via image_url.
    expect(await row(LEGACY_URL)).toEqual({ images: [], image_url: "https://exemple.com/ancienne.jpg" });
  });

  it("réapplication : aucune erreur, données intactes, une seule contrainte et un seul trigger", async () => {
    await db.query("update public.products set images = $1 where id = $2", [[u(1), u(2)], NO_PHOTO]);
    await db.exec(mig("0024_product_images.sql"));
    expect(await row(WITH_PHOTO)).toEqual({ images: [u("cover")], image_url: u("cover") });
    expect(await row(NO_PHOTO)).toEqual({ images: [u(1), u(2)], image_url: u(1) });
    const c = await db.query<{ n: number }>("select count(*)::int as n from pg_constraint where conname = 'products_images_valid'");
    expect(c.rows[0].n).toBe(1);
    const t = await db.query<{ n: number }>("select count(*)::int as n from pg_trigger where tgname = 'products_sync_images'");
    expect(t.rows[0].n).toBe(1);
  });

  it("contrainte : 8 photos acceptées, 9 refusées", async () => {
    const eight = Array.from({ length: 8 }, (_, i) => u(`h${i}`));
    expect(await error("update public.products set images = $1 where id = $2", [eight, NO_PHOTO])).toBe("ok");
    expect((await row(NO_PHOTO)).image_url).toBe(u("h0"));
    expect(await error("update public.products set images = $1 where id = $2", [[...eight, u("h8")], NO_PHOTO])).toMatch(/products_images_valid/);
  });

  it("contrainte : doublon, valeur nulle, URL hors bucket, « .. » ou guillemet refusés", async () => {
    const bad: unknown[][] = [
      [u(1), u(1)],
      [u(1), null],
      ["https://evil.example/storage/v1/object/public/autre/x.webp"],
      ["https://exemple.com/photo.jpg"],
      [`${BUCKET}/../secret.webp`],
      [`${BUCKET}/a".webp`],
      [`${BUCKET}/a b.webp`],
    ];
    for (const imgs of bad) {
      expect(await error("update public.products set images = $1 where id = $2", [imgs, WITH_PHOTO]), JSON.stringify(imgs)).toMatch(/products_images_valid/);
    }
    expect(await row(WITH_PHOTO)).toEqual({ images: [u("cover")], image_url: u("cover") });
  });

  it("nouveau code : réordonner change la couverture (image_url = images[1]) ; vider retire la photo", async () => {
    await db.query("update public.products set images = $1, image_url = $2 where id = $3", [[u(1), u(2), u(3)], u(1), WITH_PHOTO]);
    await db.query("update public.products set images = $1 where id = $2", [[u(3), u(1), u(2)], WITH_PHOTO]);
    expect(await row(WITH_PHOTO)).toEqual({ images: [u(3), u(1), u(2)], image_url: u(3) });
    // Même si l'écrivain envoie une image_url incohérente, images fait foi.
    await db.query("update public.products set images = $1, image_url = $2 where id = $3", [[u(2), u(3)], u(9), WITH_PHOTO]);
    expect(await row(WITH_PHOTO)).toEqual({ images: [u(2), u(3)], image_url: u(2) });
    await db.query("update public.products set images = '{}' where id = $1", [WITH_PHOTO]);
    expect(await row(WITH_PHOTO)).toEqual({ images: [], image_url: null });
  });

  it("ancien code (image_url seule) : remplace la couverture et garde les autres photos ; null la retire", async () => {
    await db.query("update public.products set images = $1 where id = $2", [[u(1), u(2), u(3)], WITH_PHOTO]);
    await db.query("update public.products set image_url = $1 where id = $2", [u(7), WITH_PHOTO]);
    expect(await row(WITH_PHOTO)).toEqual({ images: [u(7), u(2), u(3)], image_url: u(7) });
    // Nouvelle couverture déjà présente plus loin : pas de doublon.
    await db.query("update public.products set image_url = $1 where id = $2", [u(3), WITH_PHOTO]);
    expect(await row(WITH_PHOTO)).toEqual({ images: [u(3), u(2)], image_url: u(3) });
    await db.query("update public.products set image_url = null where id = $1", [WITH_PHOTO]);
    expect(await row(WITH_PHOTO)).toEqual({ images: [u(2)], image_url: u(2) });
  });

  it("autres mises à jour (stock, prix) : photos intactes, y compris l'ancienne URL non reprise", async () => {
    await db.query("update public.products set stock = 9, price = 4500 where id in ($1, $2)", [WITH_PHOTO, LEGACY_URL]);
    expect(await row(WITH_PHOTO)).toEqual({ images: [u(2)], image_url: u(2) });
    expect(await row(LEGACY_URL)).toEqual({ images: [], image_url: "https://exemple.com/ancienne.jpg" });
  });

  it("insertion : ancien code (image_url) → images = [image_url] ; nouveau code (images) → image_url = images[1]", async () => {
    const r1 = await db.query<{ id: string }>("insert into public.products (category_id, price, image_url) values ('maison', 1000, $1) returning id", [u("old")]);
    expect(await row(r1.rows[0].id)).toEqual({ images: [u("old")], image_url: u("old") });
    const r2 = await db.query<{ id: string }>("insert into public.products (category_id, price, images) values ('maison', 1000, $1) returning id", [[u("n1"), u("n2")]]);
    expect(await row(r2.rows[0].id)).toEqual({ images: [u("n1"), u("n2")], image_url: u("n1") });
    const r3 = await db.query<{ id: string }>("insert into public.products (category_id, price) values ('maison', 1000) returning id");
    expect(await row(r3.rows[0].id)).toEqual({ images: [], image_url: null });
  });

  it("RLS inchangée : anon lit `images` des produits actifs, jamais des produits masqués", async () => {
    await db.query("update public.products set images = $1 where id = $2", [[u("x")], HIDDEN]);
    await db.exec("set role anon");
    try {
      const r = await db.query<{ id: string; images: string[] }>("select id, images from public.products order by id");
      const ids = r.rows.map((x) => x.id);
      expect(ids).toContain(NO_PHOTO);
      expect(ids).not.toContain(HIDDEN);
      // Écriture anon : refusée ou sans effet (aucune politique d'écriture), jamais appliquée.
      await error("update public.products set images = '{}' where id = $1", [NO_PHOTO]);
    } finally {
      await db.exec("reset role");
    }
    expect((await row(NO_PHOTO)).images.length).toBe(8);
  });
});
