import { describe, expect, it } from "vitest";
import { IntlMessageFormat } from "intl-messageformat";
import fr from "@/messages/fr/shop.json";
import en from "@/messages/en/shop.json";
import { BUDGETS, COLLECTIONS, SORTS } from "@/components/shop/logic";

type Tree = { [k: string]: string | Tree };
function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

const frFlat = flatten(fr as Tree);
const enFlat = flatten(en as Tree);

describe("messages boutique (shop.json)", () => {
  it("FR et EN ont exactement les mêmes clés", () => {
    expect(Object.keys(enFlat).sort()).toEqual(Object.keys(frFlat).sort());
  });
  it("aucune valeur vide", () => {
    for (const [k, v] of [...Object.entries(frFlat), ...Object.entries(enFlat)]) expect(v.trim(), k).not.toBe("");
  });
  it("tous les messages sont de l'ICU valide, et les variables sont les mêmes dans les deux langues", () => {
    const vars = (msg: string, locale: string) =>
      new IntlMessageFormat(msg, locale)
        .getAst()
        .flatMap((n) => ("value" in n && typeof n.value === "string" && n.type !== 0 ? [n.value] : []))
        .sort();
    for (const k of Object.keys(frFlat)) {
      expect(vars(enFlat[k], "en"), k).toEqual(vars(frFlat[k], "fr"));
    }
  });
  it("les clés utilisées dynamiquement par le code existent (collections, tris, budgets)", () => {
    for (const c of COLLECTIONS) expect(frFlat[`Catalog.col.${c}`], c).toBeTruthy();
    for (const s of SORTS) expect(frFlat[`Catalog.sorts.${s}`], s).toBeTruthy();
    for (const b of BUDGETS) expect(frFlat[`Catalog.budgets.${b}`], b).toBeTruthy();
  });
  it("le français garde l'espace insécable avant les deux-points et les points d'interrogation", () => {
    for (const [k, v] of Object.entries(frFlat)) {
      expect(v, k).not.toMatch(/[A-Za-zÀ-ÿ0-9\)] [?!;:](?!\/)/);
    }
  });
});
