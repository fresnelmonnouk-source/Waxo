import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkoutEta, confirmationEta, formatRange } from "@/components/checkout/eta";
import { cutoffParams } from "@/components/shop/ExpressBadge";

// Heures en UTC ; Bénin = UTC+1. Mercredi 7 octobre 2026, samedi 10, dimanche 11.
const at = (d: number, hUtc: number, m = 0) => Date.UTC(2026, 9, d, hUtc, m);
const NBSP = " ";

describe("tunnel : ligne d'estimation (heure du Bénin, heure limite 20 h)", () => {
  it("Cotonou avant 20 h : aujourd'hui ; 19 h 59 encore aujourd'hui ; 20 h : demain", () => {
    expect(checkoutEta(at(7, 9), "cotonou", 20)).toEqual({ kind: "today" }); // 10 h
    expect(checkoutEta(at(7, 18, 59), "cotonou", 20)).toEqual({ kind: "today" }); // 19 h 59
    expect(checkoutEta(at(7, 19), "cotonou", 20)).toEqual({ kind: "tomorrow" }); // 20 h
  });
  it("samedi 21 h : demain, dimanche ; dimanche 9 h : aujourd'hui (7 j/7)", () => {
    expect(checkoutEta(at(10, 20), "cotonou", 20)).toEqual({ kind: "tomorrowSunday" });
    expect(checkoutEta(at(11, 8), "cotonou", 20)).toEqual({ kind: "today" });
  });
  it("23 h 30 UTC = 0 h 30 au Bénin le lendemain : aujourd'hui (jour du Bénin, pas UTC)", () => {
    expect(checkoutEta(at(7, 23, 30), "cotonou", 20)).toEqual({ kind: "today" });
  });
  it("heure limite invalide : repli sur 20 h", () => {
    expect(checkoutEta(at(7, 18, 30), "cotonou", 0)).toEqual({ kind: "today" }); // 19 h 30
    expect(checkoutEta(at(7, 18, 30), "cotonou", 18)).toEqual({ kind: "tomorrow" });
  });
  it("autres villes : J+2 à J+3, formatées en fuseau Africa/Porto-Novo", () => {
    const e = checkoutEta(at(7, 9), "autre", 20);
    if (e.kind !== "range") throw new Error("range attendu");
    expect(formatRange(e.from, e.to, "fr")).toEqual({ from: "vendredi 9", to: "samedi 10 octobre" });
    expect(formatRange(e.from, e.to, "en")).toEqual({ from: "Friday 9", to: "Saturday 10 October" });
  });
  it("changement de mois : mois répété, « 1er » en français", () => {
    const e = checkoutEta(at(29, 9), "autre", 20);
    if (e.kind !== "range") throw new Error("range attendu");
    expect(formatRange(e.from, e.to, "fr")).toEqual({ from: "samedi 31 octobre", to: "dimanche 1er novembre" });
    expect(formatRange(e.from, e.to, "en")).toEqual({ from: "Saturday 31 October", to: "Sunday 1 November" });
  });
});

describe("confirmation : estimation selon paiement et zone", () => {
  it("en ligne + Cotonou : aujourd'hui avant l'heure limite, demain après, dimanche le samedi soir", () => {
    expect(confirmationEta({ zone: "cotonou", pay: "momo", placedAt: at(7, 9), cutoff: 20 }).kind).toBe("today");
    expect(confirmationEta({ zone: "cotonou", pay: "carte", placedAt: at(7, 20), cutoff: 20 }).kind).toBe("tomorrow");
    expect(confirmationEta({ zone: "cotonou", pay: "momo", placedAt: at(10, 20), cutoff: 20 }).kind).toBe("tomorrowSunday");
  });
  it("paiement à la livraison : le délai démarre à la confirmation WhatsApp", () => {
    expect(confirmationEta({ zone: "cotonou", pay: "cod", placedAt: at(7, 9), cutoff: 20 }).kind).toBe("codCotonou");
    expect(confirmationEta({ zone: "autre", pay: "cod", placedAt: at(7, 9), cutoff: 20 }).kind).toBe("codOther");
  });
  it("en ligne + autres villes : dates réelles J+2 à J+3", () => {
    const e = confirmationEta({ zone: "autre", pay: "moov", placedAt: at(7, 9), cutoff: 20 });
    expect(e.kind).toBe("range");
    if (e.kind === "range") expect([e.from.getUTCDate(), e.to.getUTCDate()]).toEqual([9, 10]);
  });
});

describe("messages du tunnel (FR/EN)", () => {
  const load = (l: string) =>
    JSON.parse(readFileSync(new URL(`../src/messages/${l}/checkout.json`, import.meta.url), "utf8")) as Record<
      string,
      Record<string, string>
    >;
  const fr = load("fr");
  const en = load("en");
  const keys = (o: Record<string, Record<string, string>>) =>
    Object.entries(o).flatMap(([ns, v]) => Object.keys(v).map((k) => `${ns}.${k}`)).sort();

  it("mêmes clés en FR et en EN, anciennes clés d'estimation supprimées", () => {
    expect(keys(fr)).toEqual(keys(en));
    expect(fr.Thanks.eta48).toBeUndefined();
    expect(fr.Thanks.etaOther).toBeUndefined();
  });
  it("aucun tiret cadratin", () => {
    for (const l of ["fr", "en"]) {
      expect(readFileSync(new URL(`../src/messages/${l}/checkout.json`, import.meta.url), "utf8")).not.toContain("—");
    }
  });
  it("typo FR : insécable avant « : ; ! ? » et dans « 7 j/7 », heure limite via {hour} ; pas d'ancienne promesse", () => {
    const strings = Object.values(fr).flatMap((v) => Object.values(v));
    const newKeys = [
      fr.Checkout.zoneCotonouSub,
      fr.Checkout.zoneAutreSub,
      fr.Checkout.etaToday,
      fr.Checkout.etaRange,
      fr.Checkout.codNote,
      fr.Thanks.etaCod,
      fr.Thanks.etaCodOther,
    ];
    for (const s of newKeys) expect(s).not.toMatch(/ [:;!?]/);
    expect(fr.Checkout.zoneCotonouSub).toContain("avant {hour}");
    expect(fr.Checkout.zoneCotonouSub).toContain(`7${NBSP}j/7`);
    expect(fr.Thanks.etaCod).toContain("avant {hour}");
    expect(cutoffParams(20, "fr").hour).toBe(`20${NBSP}h`);
    expect(cutoffParams(20, "en").hour).toBe(`8${NBSP}pm`);
    expect(fr.Checkout.etaToday).toBe(`Livraison prévue${NBSP}: aujourd'hui.`);
    expect(strings.join(" ")).not.toMatch(/18 h|lundi au samedi|Livraison rapide/);
  });
  it("mêmes variables ICU en FR et en EN pour chaque message", () => {
    const vars = (m: string) => [...m.matchAll(/\{(\w+)/g)].map((x) => x[1]).sort();
    for (const k of keys(fr)) {
      const [ns, key] = k.split(".");
      expect(vars(en[ns][key]), k).toEqual(vars(fr[ns][key]));
    }
    expect(en.Checkout.zoneCotonouSub).toContain("before {hour}");
    expect(en.Thanks.etaCod).toContain("before {hour}");
    for (const m of [fr, en]) {
      expect(m.Checkout.etaRange).toMatch(/\{from\}.*\{to\}/);
      expect(m.Thanks.etaRange).toMatch(/\{from\}.*\{to\}/);
    }
  });
});
