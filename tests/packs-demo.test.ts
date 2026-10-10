import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_PACKS, buildDemoPacks, demoPackId, demoUuid, getPackBySlug, getPacks } from "@/lib/catalog/packs";
import { getProducts } from "@/lib/catalog";

const sql = readFileSync(new URL("../supabase/migrations/0006_packs_demo.sql", import.meta.url), "utf8");
const esc = (s: string) => s.replace(/'/g, "''");

describe("packs de démonstration", () => {
  it("3 packs, cohérents avec les 24 produits (chaque produit existe)", async () => {
    const products = await getProducts("fr");
    expect(products).toHaveLength(24);
    const packs = buildDemoPacks("fr", products);
    expect(packs).toHaveLength(3);
    DEMO_PACKS.forEach((def, i) => expect(packs[i].items, def.key).toHaveLength(def.items.length));
  });

  it("chaque pack est moins cher que la somme et vendable", async () => {
    const packs = buildDemoPacks("fr", await getProducts("fr"));
    for (const p of packs) {
      expect(p.saving, p.slug).toBeGreaterThan(0);
      expect(p.price).toBeLessThan(p.itemsTotal);
      expect(p.stock, p.slug).toBeGreaterThan(0);
    }
    expect(packs.map((p) => [p.itemsTotal, p.saving, p.savingPercent, p.stock])).toEqual([
      [10900, 2000, 18, 17],
      [21500, 3600, 17, 10],
      [14900, 3000, 20, 9],
    ]);
  });

  it("repli sans Supabase : getPacks et getPackBySlug en FR et EN, slug inconnu = null", async () => {
    const fr = await getPacks("fr");
    const en = await getPacks("en");
    expect(fr.map((p) => p.slug)).toEqual(["pack-bureau-confort", "pack-voyage-leger", "pack-beaute-douceur"]);
    expect(en.map((p) => p.slug)).toEqual(["comfy-desk-pack", "travel-light-pack", "gentle-beauty-pack"]);
    expect((await getPackBySlug("fr", "pack-voyage-leger"))?.id).toBe(demoPackId("voyage"));
    expect(await getPackBySlug("fr", "comfy-desk-pack")).toBeNull();
    expect(await getPackBySlug("fr", "inconnu")).toBeNull();
  });

  it("les produits sont retrouvés aussi quand les ids sont les uuid du seed SQL", async () => {
    const products = (await getProducts("fr")).map((p) => ({ ...p, id: demoUuid("product", p.id) }));
    const packs = buildDemoPacks("fr", products);
    packs.forEach((p, i) => {
      expect(p.items).toHaveLength(DEMO_PACKS[i].items.length);
      expect(p.stock).toBeGreaterThan(0);
    });
  });

  it("un produit manquant rend le pack non vendable", async () => {
    const products = (await getProducts("fr")).filter((p) => p.id !== "gourde");
    const voyage = buildDemoPacks("fr", products)[1];
    expect(voyage.items).toHaveLength(3);
    expect(voyage.stock).toBe(0);
  });
});

describe("0006_packs_demo.sql reste synchronisé avec le code", () => {
  it("ids, prix, slugs, noms, descriptions et contenus identiques (FR et EN)", () => {
    const compact = sql.replace(/\s/g, "");
    for (const def of DEMO_PACKS) {
      expect(sql, def.key).toContain(`'${demoPackId(def.key)}'::uuid, ${def.price}`);
      for (const tr of [def.fr, def.en]) {
        expect(sql).toContain(`'${esc(tr.slug)}'`);
        expect(sql).toContain(`'${esc(tr.name)}'`);
        expect(sql).toContain(`'${esc(tr.description)}'`);
      }
      const items = JSON.stringify(Object.fromEntries(def.items.map((i) => [i.product, i.qty])));
      expect(compact).toContain(items.replace(/\s/g, ""));
    }
  });
  it("idempotent et sûr : on conflict partout, aucun pack vide", () => {
    expect(sql).toMatch(/insert into public\.packs[\s\S]*on conflict \(id\) do nothing/);
    expect(sql).toMatch(/insert into public\.pack_translations[\s\S]*on conflict do nothing/);
    expect(sql).toMatch(/insert into public\.pack_items[\s\S]*on conflict \(pack_id, product_id\) do nothing/);
    expect(sql).toContain("if v_found <> v_expected");
  });
  it("les ids sont ceux de md5('pack:<clé>')", () => {
    expect(demoPackId("bureau")).toBe("84625ba6-5cbc-470d-ad5f-2e3d3eaa87f7");
    expect(demoPackId("voyage")).toBe("57d46e34-7b1b-4ddd-ac59-d3e47be10448");
    expect(demoPackId("beaute")).toBe("b5e11703-2e20-484d-a3d8-21c94651fc3a");
  });
});
