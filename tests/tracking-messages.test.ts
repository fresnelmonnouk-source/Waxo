import { describe, expect, it } from "vitest";
import en from "../src/messages/en/consent.json";
import fr from "../src/messages/fr/consent.json";

const keys = (o: Record<string, unknown>, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`]));

describe("consent.json", () => {
  it("FR et EN ont exactement les mêmes clés", () => {
    expect(keys(en).sort()).toEqual(keys(fr).sort());
  });
  it("aucune valeur vide", () => {
    expect(JSON.stringify(fr)).not.toContain('""');
    expect(JSON.stringify(en)).not.toContain('""');
  });
  it("FR : espace insécable avant les deux-points", () => {
    expect(fr.Consent.text).toContain("accord :");
  });
  it("Accepter et Refuser existent dans les deux langues", () => {
    expect(fr.Consent.acceptAll).toBe("Tout accepter");
    expect(fr.Consent.refuseAll).toBe("Tout refuser");
    expect(en.Consent.refuseAll).toBe("Refuse all");
  });
});
