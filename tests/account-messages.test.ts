import { describe, expect, it } from "vitest";
import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import fr from "@/messages/fr/account.json";
import en from "@/messages/en/account.json";

type Tree = { [k: string]: string | Tree };
const flat = (o: Tree, p = ""): Record<string, string> =>
  Object.entries(o).reduce<Record<string, string>>((acc, [k, v]) => {
    if (typeof v === "string") acc[p + k] = v;
    else Object.assign(acc, flat(v, `${p}${k}.`));
    return acc;
  }, {});

/** Noms de paramètres et de balises d'un message ICU. */
function placeholders(els: MessageFormatElement[], out = { args: new Set<string>(), tags: new Set<string>() }) {
  for (const el of els) {
    if (el.type === TYPE.tag) {
      out.tags.add(el.value);
      placeholders(el.children, out);
    } else if (el.type === TYPE.argument || el.type === TYPE.number || el.type === TYPE.date || el.type === TYPE.time) {
      out.args.add(el.value);
    } else if (el.type === TYPE.plural || el.type === TYPE.select) {
      out.args.add(el.value);
      for (const opt of Object.values(el.options)) placeholders(opt.value, out);
    }
  }
  return out;
}

const KNOWN_TAGS = new Set(["tbc", "cgv", "cgu", "privacy", "shipping", "contact", "faq", "track", "account"]);
const F = flat(fr as Tree);
const E = flat(en as Tree);

describe("messages account (FR/EN)", () => {
  it("ont exactement les mêmes clés", () => {
    expect(Object.keys(E).sort()).toEqual(Object.keys(F).sort());
  });
  it("sont toutes non vides et syntaxiquement valides (ICU)", () => {
    for (const [lang, msgs] of [["fr", F], ["en", E]] as const) {
      for (const [key, msg] of Object.entries(msgs)) {
        expect(msg.length, `${lang}:${key} vide`).toBeGreaterThan(0);
        expect(() => parse(msg), `${lang}:${key}`).not.toThrow();
      }
    }
  });
  it("utilisent les mêmes paramètres et balises dans les deux langues, et des balises connues", () => {
    for (const key of Object.keys(F)) {
      const a = placeholders(parse(F[key]));
      const b = placeholders(parse(E[key]));
      expect([...a.args].sort(), `paramètres ${key}`).toEqual([...b.args].sort());
      expect([...a.tags].sort(), `balises ${key}`).toEqual([...b.tags].sort());
      for (const tag of a.tags) expect(KNOWN_TAGS.has(tag), `balise ${tag} (${key})`).toBe(true);
    }
  });
  it("le français a des espaces insécables avant ? ! : ;", () => {
    for (const [key, msg] of Object.entries(F)) {
      expect(/ [?!:;]/.test(msg), `espace simple avant ponctuation: ${key}`).toBe(false);
    }
  });
});
