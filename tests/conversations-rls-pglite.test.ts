// Migration 0023 (Discussion) rejouée sur un vrai Postgres en mémoire (PGlite) : application, réapplication, reprise des
// `messages`, fonctions conversation_open / conversation_post, et RLS (autre client refusé, note interne invisible, anon
// refusé). PGlite n'est pas une dépendance du dépôt : il est cherché dans PGLITE_DIR, sinon dans le dossier QA de Kody.
// Absent → la suite est ignorée (les autres tests restent valables).
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
grant select on auth.users to service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ADMIN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const LEGACY_1 = "11111111-1111-4111-8111-111111111111";
const LEGACY_2 = "22222222-2222-4222-8222-222222222222";
const HASH = "a".repeat(64);

let db: Db;

async function as<T>(role: "anon" | "authenticated" | "service_role", sub: string | null, fn: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [sub ?? ""]);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

async function denied(sql: string, params?: unknown[]): Promise<string> {
  try {
    await db.query(sql, params);
    return "allowed";
  } catch (e) {
    return String((e as Error).message);
  }
}

describe.skipIf(!available)("0023_conversations sur PGlite", () => {
  let convA = "";

  beforeAll(async () => {
    const mod = (await import(/* @vite-ignore */ pathToFileURL(entry).href)) as { PGlite: new () => Db };
    db = new mod.PGlite();
    await db.exec(HARNESS);
    await db.exec(mig("0001_core.sql"));
    await db.query("insert into auth.users (id, email) values ($1, 'a@x.bj'), ($2, 'b@x.bj'), ($3, 'admin@x.bj')", [A, B, ADMIN]);
    await db.query("update public.profiles set role = 'admin' where id = $1", [ADMIN]);
    // Messages existants AVANT la migration (reprise).
    await db.query(
      `insert into public.messages (id, name, contact, subject, order_number, body, done, created_at) values
       ($1, 'Afi', 'afi@x.bj', 'Retour ou échange', 'WX-10258', 'Je veux retourner un article.', false, now() - interval '2 days'),
       ($2, 'Kossi', '0197000000', 'Produit', null, 'Livrez-vous à Parakou ?', true, now() - interval '3 days')`,
      [LEGACY_1, LEGACY_2],
    );
    await db.exec(mig("0023_conversations.sql"));
  }, 60_000);

  it("se réapplique sans erreur ni doublon (rejouable)", async () => {
    await db.exec(mig("0023_conversations.sql"));
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.conversations");
    expect(rows[0].n).toBe(2);
    const msgs = await db.query<{ n: number }>("select count(*)::int as n from public.conversation_messages");
    expect(msgs.rows[0].n).toBe(2);
  });

  it("reprend les messages : même id, catégorie, statut, non-lu, la table messages est intacte", async () => {
    const { rows } = await db.query<{ id: string; category: string; status: string; unread_admin: boolean; order_number: string | null }>(
      "select id, category, status, unread_admin, order_number from public.conversations order by created_at",
    );
    expect(rows).toEqual([
      { id: LEGACY_2, category: "question", status: "resolu", unread_admin: false, order_number: null },
      { id: LEGACY_1, category: "retour", status: "nouveau", unread_admin: true, order_number: "WX-10258" },
    ]);
    const left = await db.query<{ n: number }>("select count(*)::int as n from public.messages");
    expect(left.rows[0].n).toBe(2);
  });

  it("service_role : conversation_open crée conversation + 1er message + lien (hash seul)", async () => {
    convA = await as("service_role", null, async () => {
      const { rows } = await db.query<{ id: string }>(
        "select public.conversation_open('plainte', 'Colis abîmé', 'WX-10300', 'Afi', 'a@x.bj', $1, 'fr', 'contact', 'Mon colis est arrivé abîmé.', $2) as id",
        [A, HASH],
      );
      return rows[0].id;
    });
    expect(convA).toMatch(/^[0-9a-f-]{36}$/);
    const link = await db.query<{ conversation_id: string }>("select conversation_id from public.conversation_links where token_hash = $1", [HASH]);
    expect(link.rows[0].conversation_id).toBe(convA);
  });

  it("conversation_post : équipe (en_cours, non lu client), note interne (aucun effet), client sur résolue (rouverte)", async () => {
    await as("service_role", null, async () => {
      const r1 = await db.query<{ new_status: string; was_unread_admin: boolean }>("select * from public.conversation_post($1, 'equipe', 'Bonjour, nous regardons.', $2)", [convA, ADMIN]);
      expect(r1.rows[0]).toMatchObject({ new_status: "en_cours", was_unread_admin: true });
      await db.query("select * from public.conversation_post($1, 'note_interne', 'Client fiable, rembourser.', $2)", [convA, ADMIN]);
      await db.query("update public.conversations set status = 'resolu' where id = $1", [convA]);
      const r2 = await db.query<{ new_status: string; was_unread_admin: boolean }>("select * from public.conversation_post($1, 'client', 'Merci, et le remboursement ?', null)", [convA]);
      expect(r2.rows[0]).toMatchObject({ new_status: "en_cours", was_unread_admin: false });
      const none = await db.query("select * from public.conversation_post('99999999-9999-4999-8999-999999999999', 'client', 'x', null)");
      expect(none.rows).toEqual([]);
    });
    const { rows } = await db.query<{ unread_admin: boolean; unread_customer: boolean }>("select unread_admin, unread_customer from public.conversations where id = $1", [convA]);
    expect(rows[0]).toEqual({ unread_admin: true, unread_customer: false });
  });

  it("client connecté : voit SA conversation et ses messages, JAMAIS la note interne", async () => {
    await as("authenticated", A, async () => {
      const convs = await db.query<{ id: string }>("select id from public.conversations");
      expect(convs.rows.map((r) => r.id)).toEqual([convA]);
      const msgs = await db.query<{ author: string }>("select author from public.conversation_messages order by created_at");
      expect(msgs.rows.map((r) => r.author)).toEqual(["client", "equipe", "client"]);
      const notes = await db.query("select id from public.conversation_messages where author = 'note_interne'");
      expect(notes.rows).toEqual([]);
    });
  });

  it("client connecté : ni l'id de l'admin, ni les liens, ni écriture, ni les fonctions", async () => {
    await as("authenticated", A, async () => {
      expect(await denied("select author_admin_id from public.conversation_messages")).toMatch(/permission denied/);
      expect(await denied("select * from public.conversation_links")).toMatch(/permission denied/);
      expect(await denied("insert into public.conversation_messages (conversation_id, author, body) values ($1, 'client', 'x')", [convA])).toMatch(/permission denied/);
      expect(await denied("update public.conversations set status = 'resolu' where id = $1", [convA])).toMatch(/permission denied/);
      expect(await denied("select * from public.conversation_post($1, 'client', 'x', null)", [convA])).toMatch(/permission denied/);
      expect(
        await denied("select public.conversation_open('question', 's', null, 'n', 'a@x.bj', null, 'fr', 'contact', 'b', null)"),
      ).toMatch(/permission denied/);
    });
  });

  it("un AUTRE client ne voit rien de la conversation de A", async () => {
    await as("authenticated", B, async () => {
      expect((await db.query("select id from public.conversations")).rows).toEqual([]);
      expect((await db.query("select id from public.conversation_messages where conversation_id = $1", [convA])).rows).toEqual([]);
    });
  });

  it("anon : aucun accès (lecture refusée)", async () => {
    await as("anon", null, async () => {
      expect(await denied("select id from public.conversations")).toMatch(/permission denied/);
      expect(await denied("select id from public.conversation_messages")).toMatch(/permission denied/);
      expect(await denied("select * from public.conversation_links")).toMatch(/permission denied/);
    });
  });

  it("admin connecté (session) : voit toutes les conversations et les notes", async () => {
    await as("authenticated", ADMIN, async () => {
      expect((await db.query("select id from public.conversations")).rows).toHaveLength(3);
      expect((await db.query("select id from public.conversation_messages where author = 'note_interne'")).rows).toHaveLength(1);
    });
  });

  it("contraintes : catégorie, longueur du message et forme du hash", async () => {
    expect(await denied("insert into public.conversations (category, customer_name, customer_contact) values ('spam', 'n', 'a@x.bj')")).toMatch(/check/);
    expect(await denied("insert into public.conversation_messages (conversation_id, author, body) values ($1, 'client', $2)", [convA, "x".repeat(3001)])).toMatch(/check/);
    expect(await denied("insert into public.conversation_messages (conversation_id, author, body) values ($1, 'client', '')", [convA])).toMatch(/check/);
    expect(await denied("insert into public.conversation_links (token_hash, conversation_id) values ('jeton-en-clair', $1)", [convA])).toMatch(/check/);
  });
});
