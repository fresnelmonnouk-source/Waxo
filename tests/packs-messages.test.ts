import { describe, expect, it } from "vitest";
import { IntlMessageFormat } from "intl-messageformat";
import fr from "@/messages/fr/packs.json";
import en from "@/messages/en/packs.json";

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

describe("messages packs (packs.json)", () => {
  it("FR et EN ont exactement les mêmes clés", () => {
    expect(Object.keys(enFlat).sort()).toEqual(Object.keys(frFlat).sort());
  });
  it("aucune valeur vide", () => {
    for (const [k, v] of [...Object.entries(frFlat), ...Object.entries(enFlat)]) expect(v.trim(), k).not.toBe("");
  });
  it("ICU valide et mêmes variables dans les deux langues", () => {
    const vars = (msg: string, locale: string) =>
      new IntlMessageFormat(msg, locale)
        .getAst()
        .flatMap((n) => ("value" in n && typeof n.value === "string" && n.type !== 0 ? [n.value] : []))
        .sort();
    for (const k of Object.keys(frFlat)) expect(vars(enFlat[k], "en"), k).toEqual(vars(frFlat[k], "fr"));
  });
  it("français : espace insécable (et non espace simple) avant : ? ! ; %", () => {
    for (const [k, v] of Object.entries(frFlat)) expect(v, k).not.toMatch(/ [:?!;%]/);
  });
});
