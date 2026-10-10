import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_PAGES } from "@/lib/pages/defaults";
import { findMarkers } from "@/lib/pages/markdown";
import { isKnownMarker } from "@/lib/pages/markers";
import { PAGE_LOCALES, PAGE_SLUGS } from "@/lib/pages/types";

const sql = readFileSync(new URL("../supabase/migrations/0005_pages_seed.sql", import.meta.url), "utf8");

/** Lit les littéraux SQL '…' (apostrophes doublées) d'un fichier : suffisant pour notre insert de valeurs. */
function literals(src: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    if (src.startsWith("--", i)) {
      i = src.indexOf("\n", i);
      if (i < 0) break;
      continue;
    }
    if (src[i] === "'") {
      let cur = "";
      i += 1;
      for (;;) {
        if (i >= src.length) throw new Error("littéral SQL non terminé");
        if (src[i] === "'" && src[i + 1] === "'") {
          cur += "'";
          i += 2;
        } else if (src[i] === "'") {
          i += 1;
          break;
        } else cur += src[i++];
      }
      out.push(cur);
    } else i += 1;
  }
  return out;
}

describe("pages : migration 0005_pages_seed.sql", () => {
  it("est idempotente et n'écrase jamais une page éditée", () => {
    expect(sql).toMatch(/insert into public\.pages \(slug, locale, title, body_md\) values/);
    expect(sql).toMatch(/on conflict \(slug, locale\) do nothing;\s*$/);
    expect(sql).not.toMatch(/\bdo update\b|\bdelete\b|\btruncate\b|\bdrop\b/i);
  });
  it("contient exactement les 6 pages x 2 langues de DEFAULT_PAGES, apostrophes SQL comprises (fichier = source)", () => {
    const lits = literals(sql);
    expect(lits.length).toBe(PAGE_SLUGS.length * PAGE_LOCALES.length * 4);
    let n = 0;
    for (const slug of PAGE_SLUGS) {
      for (const locale of PAGE_LOCALES) {
        const d = DEFAULT_PAGES[slug][locale];
        expect(lits.slice(n, n + 4), `${slug}/${locale}`).toEqual([slug, locale, d.title, d.body]);
        n += 4;
      }
    }
  });
});

describe("pages : textes par défaut", () => {
  it("n'utilisent que des marqueurs connus et les mêmes marqueurs en FR et en EN", () => {
    for (const slug of PAGE_SLUGS) {
      const fr = findMarkers(DEFAULT_PAGES[slug].fr.body);
      const en = findMarkers(DEFAULT_PAGES[slug].en.body);
      for (const k of [...fr, ...en]) expect(isKnownMarker(k), `${slug}: ${k}`).toBe(true);
      expect([...new Set(fr)].sort(), slug).toEqual([...new Set(en)].sort());
    }
  });
  it("ne contiennent ni HTML brut ni valeur légale inventée", () => {
    for (const slug of PAGE_SLUGS) {
      for (const locale of PAGE_LOCALES) {
        const { title, body } = DEFAULT_PAGES[slug][locale];
        expect(title.trim()).not.toBe("");
        expect(body).not.toMatch(/<\/?[a-z][^>]*>/i);
        expect(body).not.toMatch(/IFU\s*:?\s*\d|RCCM\s*:?\s*[A-Z]{2}/);
      }
    }
  });
});
