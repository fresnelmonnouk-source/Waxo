// QA (Nadia) — contrôles STATIQUES du schéma SQL (aucune base nécessaire) : RLS, droits d'exécution, contraintes d'unicité.
// Ce que ces tests ne prouvent PAS (comportement réel des politiques RLS, concurrence) est listé dans docs/reviews/nadia-qa-J1.md
// (scénarios de recette avec Supabase branché).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const core = readFileSync(join(process.cwd(), "supabase", "migrations", "0001_core.sql"), "utf8");
const strip = (sql: string) => sql.replace(/--.*$/gm, "");
const sql = strip(core);
const m10 = strip(readFileSync(join(process.cwd(), "supabase", "migrations", "0010_unique_review_phone.sql"), "utf8"));

const tables = [...sql.matchAll(/create table if not exists public\.(\w+)/gi)].map((m) => m[1]);

describe("schéma 0001_core.sql : RLS et droits", () => {
  it("détecte bien les tables du cœur (garde-fou du test lui-même)", () => {
    expect(tables).toEqual(expect.arrayContaining(["profiles", "orders", "order_items", "reviews", "messages", "newsletter_subs", "settings"]));
    expect(tables.length).toBeGreaterThanOrEqual(20);
  });
  it("RLS activée sur CHAQUE table créée (explicitement ou via la boucle de la section RLS)", () => {
    const loop = /foreach t in array array\[([^\]]+)\]/i.exec(sql)?.[1] ?? "";
    const inLoop = new Set([...loop.matchAll(/'(\w+)'/g)].map((m) => m[1]));
    const explicit = new Set([...sql.matchAll(/alter table public\.(\w+) enable row level security/gi)].map((m) => m[1]));
    const missing = tables.filter((t) => !inLoop.has(t) && !explicit.has(t));
    expect(missing).toEqual([]);
  });
  it("chaque fonction SECURITY DEFINER est soit révoquée au public/anon/authenticated, soit explicitement tolérée", () => {
    const defs = [...sql.matchAll(/create or replace function public\.(\w+)\s*\(([\s\S]*?)\)\s*returns[\s\S]*?(?=create or replace function|$)/gi)]
      .filter((m) => /security definer/i.test(m[0]))
      .map((m) => m[1]);
    expect(defs).toEqual(expect.arrayContaining(["place_order", "mark_paid", "cancel_order", "expire_stale_orders"]));
    const tolerated = new Set(["is_admin"]); // lecture de son propre rôle, utilisée par les politiques RLS
    const unprotected = defs.filter((f) => !tolerated.has(f) && !new RegExp(`revoke execute on function public\\.${f}\\b`, "i").test(sql));
    expect(unprotected).toEqual([]);
  });
  it("aucun droit d'écriture direct donné à anon", () => {
    expect(sql).not.toMatch(/grant\s+(insert|update|delete|all)[^;]*\bto\s+anon\b/i);
  });
  it("le rôle d'un profil ne peut pas être modifié par un utilisateur (colonnes autorisées limitées + garde-fou)", () => {
    expect(sql).toMatch(/grant update \(first_name, last_name, phone, address, news\) on public\.profiles to authenticated/i);
    expect(sql).toMatch(/role_change_forbidden/);
  });
});

describe("schéma : contraintes qui protègent les chemins métier", () => {
  it("numéro de commande unique ; quantité d'une ligne bornée 1..99 ; montants positifs", () => {
    expect(sql).toMatch(/number text not null unique/i);
    expect(sql).toMatch(/qty int not null check \(qty between 1 and 99\)/i);
    expect(sql).toMatch(/total int not null default 0 check \(total >= 0\)/i);
  });
  it("newsletter : unicité (channel, value) — sinon le « doublon = succès » de l'API ne se déclenche jamais", () => {
    expect(sql).toMatch(/unique \(channel, value\)/i);
  });
  it("le stock ne peut pas devenir négatif en base (filet de sécurité derrière place_order)", () => {
    const products = /create table if not exists public\.products \([\s\S]*?\n\);/i.exec(sql)?.[0] ?? "";
    expect(products).toMatch(/stock int[^,\n]*check \(stock >= 0\)/i);
  });
  // BUG QA-9 : pas d'unicité (product_id, user_id) sur reviews → doublons possibles par double envoi (course SELECT puis INSERT).
  it("QA-9 : un client ne peut avoir qu'un avis par produit (index unique sur reviews, migration 0010)", () => {
    expect(m10).toMatch(/unique\s+index[^;]*on public\.reviews\s*\(\s*product_id\s*,\s*user_id\s*\)/i);
  });
  // BUG QA-11 (= O3 de Raphaël) : profiles.phone n'est pas unique alors que le téléphone sert d'identifiant de connexion.
  it("QA-11 : le téléphone d'un profil est unique quand il est renseigné (migration 0010)", () => {
    expect(m10).toMatch(/unique\s+index[^;]*on public\.profiles\s*\(\s*phone\s*\)/i);
  });
  // QA-12 (corrigé par la migration 0007 + route /api/checkout) : non-régression, la clé d'idempotence doit rester UNIQUE en base.
  it("QA-12 : orders.idem_key existe avec un index unique partiel (migration 0007)", () => {
    const m7 = strip(readFileSync(join(process.cwd(), "supabase", "migrations", "0007_payments.sql"), "utf8"));
    expect(m7).toMatch(/add column if not exists idem_key text/i);
    expect(m7).toMatch(/create unique index[^;]*on public\.orders\s*\(\s*idem_key\s*\)\s*where idem_key is not null/i);
  });
});
