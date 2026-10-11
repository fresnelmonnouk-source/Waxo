import { describe, expect, it } from "vitest";
import {
  applyPercentToAll,
  beninLocalToIso,
  draftFromCampaign,
  draftToInput,
  emptyDraft,
  formatBeninDate,
  formatCampaignRange,
  isoToBeninLocal,
  itemWithPercent,
  itemWithPrice,
  normalizeSearch,
  parseWhole,
  showsStats,
  sortCampaigns,
  CAMPAIGN_TEMPLATES,
} from "@/components/admin/campaigns/helpers";
import { validateCampaign, type Campaign } from "@/lib/campaigns/logic";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";

describe("heure du Bénin (UTC+1 fixe) ↔ ISO", () => {
  it("convertit une saisie locale en ISO UTC (une heure de moins)", () => {
    expect(beninLocalToIso("2026-11-28T00:00")).toBe("2026-11-27T23:00:00.000Z");
    expect(beninLocalToIso("2026-12-01T23:59")).toBe("2026-12-01T22:59:00.000Z");
    expect(beninLocalToIso("2027-01-01T00:30:15")).toBe("2026-12-31T23:30:15.000Z");
  });
  it("pas de changement d'heure : même décalage en été", () => {
    expect(beninLocalToIso("2026-07-01T12:00")).toBe("2026-07-01T11:00:00.000Z");
  });
  it("refuse les saisies invalides", () => {
    for (const bad of ["", "2026-11-28", "2026-02-30T10:00", "2026-13-01T10:00", "2026-11-28T24:00", "2026-11-28T10:60", "demain"]) {
      expect(beninLocalToIso(bad)).toBeNull();
    }
  });
  it("ISO → saisie locale, y compris depuis un autre fuseau", () => {
    expect(isoToBeninLocal("2026-11-27T23:00:00.000Z")).toBe("2026-11-28T00:00");
    expect(isoToBeninLocal("2026-11-28T00:00:00+01:00")).toBe("2026-11-28T00:00");
    expect(isoToBeninLocal("nimporte")).toBe("");
  });
  it("aller-retour stable", () => {
    for (const local of ["2026-11-28T00:00", "2026-12-31T23:59", "2028-02-29T08:15"]) {
      expect(isoToBeninLocal(beninLocalToIso(local)!)).toBe(local);
    }
  });
});

describe("affichage des dates", () => {
  it("format « 28 nov. 2026, 00:00 → 1 déc. 2026, 23:59 »", () => {
    expect(formatBeninDate("2026-11-27T23:00:00.000Z")).toBe("28 nov. 2026, 00:00");
    expect(formatCampaignRange("2026-11-27T23:00:00.000Z", "2026-12-01T22:59:00.000Z")).toBe("28 nov. 2026, 00:00 → 1 déc. 2026, 23:59");
    expect(formatBeninDate("2027-02-01T08:05:00Z")).toBe("1 févr. 2027, 09:05");
    expect(formatBeninDate("x")).toBe("date invalide");
  });
});

const camp = (id: string, startsAt: string, endsAt: string, active = true) => ({ id, active, startsAt, endsAt });

describe("tri des campagnes", () => {
  it("en cours, à venir, terminées, puis désactivées", () => {
    const now = Date.parse("2026-11-29T12:00:00Z");
    const list = [
      camp("ended-old", "2026-01-01T00:00:00Z", "2026-01-10T00:00:00Z"),
      camp("off", "2026-11-01T00:00:00Z", "2026-12-10T00:00:00Z", false),
      camp("up-far", "2026-12-20T00:00:00Z", "2026-12-26T00:00:00Z"),
      camp("run-late", "2026-11-20T00:00:00Z", "2026-12-15T00:00:00Z"),
      camp("ended-recent", "2026-10-01T00:00:00Z", "2026-10-10T00:00:00Z"),
      camp("up-soon", "2026-12-01T00:00:00Z", "2026-12-05T00:00:00Z"),
      camp("run-soon", "2026-11-28T00:00:00Z", "2026-12-01T00:00:00Z"),
    ];
    expect(sortCampaigns(list, now).map((c) => c.id)).toEqual([
      "run-soon",
      "run-late",
      "up-soon",
      "up-far",
      "ended-recent",
      "ended-old",
      "off",
    ]);
  });
  it("statistiques affichées pour en cours / terminée, ou dès qu'il y a des ventes", () => {
    const none = { orders: 0, units: 0, revenue: 0, top: [] };
    expect(showsStats("running", none)).toBe(true);
    expect(showsStats("ended", none)).toBe(true);
    expect(showsStats("upcoming", none)).toBe(false);
    expect(showsStats("off", none)).toBe(false);
    expect(showsStats("off", { ...none, orders: 2 })).toBe(true);
  });
});

describe("saisie des prix", () => {
  it("parseWhole accepte les espaces et le F", () => {
    expect(parseWhole("12 500")).toBe(12500);
    expect(parseWhole("12 500 F")).toBe(12500);
    expect(parseWhole("12500")).toBe(12500);
    expect(parseWhole("")).toBeNull();
    expect(parseWhole("-3")).toBeNull();
    expect(parseWhole("1,5")).toBeNull();
  });
  it("le % met le prix à jour, le prix met le % à jour", () => {
    const it0 = { productId: P1, salePrice: "", percent: "" };
    const a = itemWithPercent(it0, 10000, "20");
    expect(a).toEqual({ productId: P1, salePrice: "8000", percent: "20" });
    const b = itemWithPrice(a, 10000, "7500");
    expect(b).toEqual({ productId: P1, salePrice: "7500", percent: "25" });
    // % non calculable (0, 100…) : le prix n'est pas écrasé
    expect(itemWithPercent(b, 10000, "100").salePrice).toBe("7500");
    // prix ≥ prix normal : pas de % affiché
    expect(itemWithPrice(b, 10000, "12000").percent).toBe("");
  });
  it("appliquer X % à tous", () => {
    const normals = new Map([
      [P1, 10000],
      [P2, 4900],
    ]);
    const out = applyPercentToAll(
      [
        { productId: P1, salePrice: "", percent: "" },
        { productId: P2, salePrice: "4000", percent: "18" },
      ],
      normals,
      30,
    );
    expect(out).toEqual([
      { productId: P1, salePrice: "7000", percent: "30" },
      { productId: P2, salePrice: "3400", percent: "30" },
    ]);
  });
});

describe("brouillon ↔ formulaire", () => {
  const c: Campaign = {
    id: "c1",
    slug: "black-friday",
    nameFr: "Black Friday",
    nameEn: "Black Friday",
    taglineFr: "Promo",
    taglineEn: "Deals",
    startsAt: "2026-11-27T23:00:00.000Z",
    endsAt: "2026-12-01T22:59:00.000Z",
    active: true,
    showMenu: true,
    showBanner: false,
    showCountdown: true,
    items: [{ productId: P1, salePrice: 8000 }],
  };
  const normals = new Map([[P1, 10000]]);

  it("ouvre une campagne avec les dates en heure du Bénin et le % calculé", () => {
    const d = draftFromCampaign(c, normals);
    expect(d.startsLocal).toBe("2026-11-28T00:00");
    expect(d.endsLocal).toBe("2026-12-01T23:59");
    expect(d.items).toEqual([{ productId: P1, salePrice: "8000", percent: "20" }]);
    expect(d.slugTouched).toBe(true);
  });
  it("renvoie les dates en ISO UTC et des prix entiers ; validateCampaign l'accepte", () => {
    const input = draftToInput(draftFromCampaign(c, normals));
    expect(input.startsAt).toBe(c.startsAt);
    expect(input.endsAt).toBe(c.endsAt);
    expect(input.items).toEqual([{ productId: P1, salePrice: 8000 }]);
    expect(validateCampaign(input, normals).ok).toBe(true);
  });
  it("brouillon vide : dates invalides et produits manquants signalés", () => {
    const r = validateCampaign(draftToInput({ ...emptyDraft(), nameFr: "Noël" }), normals);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.startsAt).toBeTruthy();
      expect(r.errors.items).toBeTruthy();
    }
  });
});

describe("divers", () => {
  it("recherche insensible aux accents et à la casse", () => {
    expect(normalizeSearch("  Théière ÉMAILLÉE ")).toBe("theiere emaillee");
  });
  it("5 modèles, noms valides (2 à 60 caractères)", () => {
    expect(CAMPAIGN_TEMPLATES.map((t) => t.nameFr)).toEqual(["Black Friday", "Noël", "Tabaski", "Fête des mères", "Rentrée"]);
    for (const t of CAMPAIGN_TEMPLATES) {
      expect(t.nameEn.length).toBeGreaterThanOrEqual(2);
      expect(t.taglineFr.length).toBeLessThanOrEqual(160);
      expect(t.taglineEn.length).toBeLessThanOrEqual(160);
    }
  });
});
