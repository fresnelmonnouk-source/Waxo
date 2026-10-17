// Nouveaux rayons (0027, 2026-10-17) : migration idempotente et sans collision, libellés/couleurs de l'admin, synonymes de l'assistant.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATEGORY_COLOR, CATEGORY_LABEL } from "@/lib/admin/ui/constants";
import { expandSynonyms } from "@/lib/assistant/text";

const read = (f: string) => readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), "utf8");
const sql = read("0027_categories_more.sql");
const rows = [...sql.matchAll(/\('([a-z-]+)','((?:[^']|'')+)','((?:[^']|'')+)','(#[0-9A-Fa-f]{6})',(\d+)\)/g)].map((m) => ({
  id: m[1],
  fr: m[2].replace(/''/g, "'"),
  en: m[3].replace(/''/g, "'"),
  bg: m[4],
  sort: Number(m[5]),
}));

describe("migration 0027_categories_more.sql", () => {
  it("insère 11 rayons, idempotente, sans toucher à l'existant", () => {
    expect(rows).toHaveLength(11);
    expect(sql).toMatch(/on conflict \(id\) do nothing;\s*$/);
    expect(sql).not.toMatch(/\bdo update\b/);
  });
  it("ids uniques, distincts de ceux de 0001, ordre à la suite (7 à 17)", () => {
    const base = ["maison", "cuisine", "beaute", "tech", "bureau", "voyage"];
    const ids = rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of base) expect(ids).not.toContain(b);
    expect(rows.map((r) => r.sort)).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
    for (const r of rows) {
      expect(r.fr.trim()).not.toBe("");
      expect(r.en.trim()).not.toBe("");
    }
  });
  it("chaque rayon a son libellé et sa couleur dans l'admin (statistiques)", () => {
    for (const r of rows) {
      expect(CATEGORY_LABEL[r.id], r.id).toBe(r.fr);
      expect(CATEGORY_COLOR[r.id], r.id).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe("assistant : synonymes des nouveaux rayons", () => {
  it.each([
    ["un jouet pour mon fils", "jouets"],
    ["des jeux de société", "jeux"],
    ["du matériel de sport", "sport"],
    ["un accessoire pour ma moto", "auto moto"],
    ["un biberon", "bebe"],
    ["un outil de bricolage", "bricolage outils"],
    ["something for my dog", "animaux"],
    ["a toy for a kid", "jouets"],
  ])("« %s » ajoute « %s » à la recherche", (q, added) => {
    expect(expandSynonyms(q)).toContain(added);
  });
  it("ne change rien aux recherches existantes", () => {
    expect(expandSynonyms("une lampe pour les coupures de courant")).toContain("lampe batterie");
    expect(expandSynonyms("un cadeau pour ma soeur")).toBe("un cadeau pour ma soeur");
  });
});
