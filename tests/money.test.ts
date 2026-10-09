import { describe, expect, it } from "vitest";
import { discountPercent, fmtXof } from "@/lib/money";

describe("fmtXof", () => {
  it("formate avec séparateur de milliers et F insécable", () => {
    expect(fmtXof(12500)).toMatch(/^12\s500 F$/);
    expect(fmtXof(0)).toBe("0 F");
  });
  it("arrondit et tolère les valeurs invalides", () => {
    expect(fmtXof(999.6)).toBe(fmtXof(1000));
    expect(fmtXof(Number.NaN)).toBe("0 F");
  });
});

describe("discountPercent", () => {
  it("calcule la remise arrondie", () => {
    expect(discountPercent(14700, 12500)).toBe(15);
  });
  it("renvoie 0 sans prix barré valide", () => {
    expect(discountPercent(null, 5000)).toBe(0);
    expect(discountPercent(4000, 5000)).toBe(0);
  });
});
