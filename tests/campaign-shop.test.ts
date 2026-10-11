import { describe, expect, it } from "vitest";
import fr from "@/messages/fr/shop.json";
import en from "@/messages/en/shop.json";
import {
  campaignPage,
  formatCampaignDate,
  pad2,
  shopCampaigns,
} from "@/components/shop/campaign-logic";
import type { Campaign } from "@/lib/campaigns/logic";

const NOW = Date.parse("2026-11-27T12:00:00Z");
const base: Campaign = {
  id: "c1",
  slug: "black-friday",
  nameFr: "Black Friday",
  nameEn: "Black Friday EN",
  taglineFr: "Jusqu'à -40 %",
  taglineEn: "Up to 40% off",
  startsAt: "2026-11-27T00:00:00Z",
  endsAt: "2026-11-30T23:00:00Z",
  active: true,
  showMenu: true,
  showBanner: true,
  showCountdown: true,
  items: [{ productId: "p1", salePrice: 1000 }],
};
const mk = (o: Partial<Campaign>): Campaign => ({ ...base, ...o });

describe("shopCampaigns (menu + bannière)", () => {
  it("rien sans campagne en cours", () => {
    expect(shopCampaigns([], "fr", NOW)).toEqual({
      header: null,
      banner: null,
    });
    expect(
      shopCampaigns(
        [
          mk({
            startsAt: "2026-12-01T00:00:00Z",
            endsAt: "2026-12-05T00:00:00Z",
          }),
        ],
        "fr",
        NOW,
      ),
    ).toEqual({
      header: null,
      banner: null,
    });
  });
  it("traduit le nom et l'accroche selon la langue", () => {
    const r = shopCampaigns([base], "en", NOW);
    expect(r.header).toEqual({
      slug: "black-friday",
      name: "Black Friday EN",
      showMenu: true,
    });
    expect(r.banner).toEqual({
      slug: "black-friday",
      name: "Black Friday EN",
      tagline: "Up to 40% off",
      endsAt: base.endsAt,
      showCountdown: true,
    });
  });
  it("respecte les interrupteurs : pas de bannière si showBanner est faux, showMenu transmis", () => {
    const r = shopCampaigns(
      [mk({ showBanner: false, showMenu: false })],
      "fr",
      NOW,
    );
    expect(r.banner).toBeNull();
    expect(r.header?.showMenu).toBe(false);
  });
  it("met en avant celle qui se termine le plus tôt", () => {
    const later = mk({
      id: "c2",
      slug: "noel",
      endsAt: "2026-12-25T00:00:00Z",
    });
    expect(shopCampaigns([later, base], "fr", NOW).header?.slug).toBe(
      "black-friday",
    );
  });
});

describe("campaignPage", () => {
  it("en cours, à venir, ou null", () => {
    expect(campaignPage([base], "black-friday", NOW)?.state).toBe("running");
    expect(
      campaignPage(
        [
          mk({
            startsAt: "2026-12-01T00:00:00Z",
            endsAt: "2026-12-05T00:00:00Z",
          }),
        ],
        "black-friday",
        NOW,
      )?.state,
    ).toBe("upcoming");
    expect(
      campaignPage(
        [mk({ endsAt: "2026-11-27T11:00:00Z" })],
        "black-friday",
        NOW,
      ),
    ).toBeNull();
    expect(
      campaignPage([mk({ active: false })], "black-friday", NOW),
    ).toBeNull();
    expect(campaignPage([base], "inconnue", NOW)).toBeNull();
  });
});

describe("formatCampaignDate / pad2", () => {
  it("affiche l'heure du Bénin (UTC+1)", () => {
    expect(formatCampaignDate("2026-11-30T23:00:00Z", "fr")).toMatch(
      /1 décembre.*00:00/,
    );
    expect(formatCampaignDate("2026-11-30T22:30:00Z", "en")).toMatch(
      /30 November.*23:30/,
    );
    expect(formatCampaignDate("pas une date", "fr")).toBe("");
  });
  it("deux chiffres", () => {
    expect(pad2(5)).toBe("05");
    expect(pad2(42)).toBe("42");
    expect(pad2(-1)).toBe("00");
  });
});

describe("messages Campaign (shop.json)", () => {
  type Tree = { [k: string]: string | Tree };
  const frC = (fr as unknown as Record<string, Tree>).Campaign;
  const enC = (en as unknown as Record<string, Tree>).Campaign;
  it("existent avec les mêmes clés en FR et en EN", () => {
    expect(frC).toBeTruthy();
    expect(Object.keys(enC).sort()).toEqual(Object.keys(frC).sort());
    for (const k of [
      "cta",
      "endsIn",
      "startsIn",
      "unitDays",
      "unitHours",
      "unitMinutes",
      "unitSeconds",
      "until",
      "empty",
    ]) {
      expect(frC[k], k).toBeTruthy();
    }
  });
  it("aucun tiret cadratin, et espace insécable avant : ; ! ? en français", () => {
    for (const v of [...Object.values(frC), ...Object.values(enC)])
      expect(String(v)).not.toContain("—");
    for (const [k, v] of Object.entries(frC))
      expect(String(v), k).not.toMatch(/ [:;!?]/);
  });
});
