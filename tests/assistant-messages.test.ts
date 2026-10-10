import { describe, expect, it } from "vitest";
import en from "@/messages/en/assistant.json";
import fr from "@/messages/fr/assistant.json";

function keys(o: unknown, prefix = ""): string[] {
  if (!o || typeof o !== "object") return [prefix];
  return Object.entries(o).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}
function placeholders(s: string) {
  return [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();
}
function flat(o: unknown, prefix = ""): Record<string, string> {
  if (typeof o === "string") return { [prefix]: o };
  if (!o || typeof o !== "object") return {};
  return Object.assign({}, ...Object.entries(o).map(([k, v]) => flat(v, prefix ? `${prefix}.${k}` : k)));
}

describe("assistant — messages FR/EN", () => {
  it("mêmes clés dans les deux langues", () => {
    expect(keys(en).sort()).toEqual(keys(fr).sort());
  });
  it("mêmes marqueurs {…} dans chaque message", () => {
    const f = flat(fr);
    const e = flat(en);
    for (const k of Object.keys(f)) expect(placeholders(e[k]), k).toEqual(placeholders(f[k]));
  });
  it("aucun message vide", () => {
    for (const [k, v] of Object.entries({ ...flat(fr), ...flat(en) })) expect(v.trim().length, k).toBeGreaterThan(0);
  });
  it("FR : espace insécable avant ? ! :", () => {
    for (const [k, v] of Object.entries(flat(fr))) expect(v, k).not.toMatch(/[A-Za-zÀ-ÿ…)] [?!:;]/);
  });
});
