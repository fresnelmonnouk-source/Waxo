import { describe, expect, it } from "vitest";
import {
  applyCampaigns,
  campaignPriceFor,
  campaignStats,
  campaignStatus,
  countdownParts,
  discountPercent,
  featuredCampaign,
  priceFromPercent,
  slugifyCampaign,
  validateCampaign,
  type Campaign,
  type CampaignFormInput,
} from "@/lib/campaigns/logic";

const NOW = Date.parse("2026-11-27T12:00:00Z");
const H = 3_600_000;
const camp = (o: Partial<Campaign> = {}): Campaign => ({
  id: "c1",
  slug: "black-friday",
  nameFr: "Black Friday",
  nameEn: "Black Friday",
  taglineFr: "",
  taglineEn: "",
  startsAt: new Date(NOW - H).toISOString(),
  endsAt: new Date(NOW + 24 * H).toISOString(),
  active: true,
  showMenu: true,
  showBanner: true,
  showCountdown: true,
  items: [{ productId: "p1", salePrice: 7000 }],
  ...o,
});

describe("campagnes : statut (même règle que la base)", () => {
  it("en cours, à venir, terminée, désactivée", () => {
    expect(campaignStatus(camp(), NOW)).toBe("running");
    expect(campaignStatus(camp({ startsAt: new Date(NOW + H).toISOString() }), NOW)).toBe("upcoming");
    expect(campaignStatus(camp({ endsAt: new Date(NOW).toISOString() }), NOW)).toBe("ended"); // fin exclue
    expect(campaignStatus(camp({ active: false }), NOW)).toBe("off");
  });
});

describe("campagnes : prix", () => {
  it("prix de campagne seulement en cours et sous le prix normal", () => {
    expect(campaignPriceFor("p1", 10000, [camp()], NOW)?.price).toBe(7000);
    expect(campaignPriceFor("p1", 10000, [camp({ active: false })], NOW)).toBeNull();
    expect(campaignPriceFor("p1", 6000, [camp()], NOW)).toBeNull(); // jamais au-dessus du prix normal
    expect(campaignPriceFor("p2", 10000, [camp()], NOW)).toBeNull();
  });
  it("chevauchement : le prix le plus bas l'emporte", () => {
    const other = camp({ id: "c2", slug: "noel", items: [{ productId: "p1", salePrice: 6500 }] });
    expect(campaignPriceFor("p1", 10000, [camp(), other], NOW)?.campaign.slug).toBe("noel");
  });
  it("applyCampaigns : prix barré = prix normal, tag de campagne", () => {
    const [a, b] = applyCampaigns(
      [
        { id: "p1", price: 10000, comparePrice: 12000 },
        { id: "p2", price: 5000, comparePrice: null },
      ],
      [camp()],
      NOW,
      "fr",
    );
    expect(a).toMatchObject({ price: 7000, comparePrice: 10000, campaign: { slug: "black-friday", name: "Black Friday" } });
    expect(b).toEqual({ id: "p2", price: 5000, comparePrice: null });
  });
  it("sans campagne en cours, la liste est rendue telle quelle", () => {
    const list = [{ id: "p1", price: 10000, comparePrice: null }];
    expect(applyCampaigns(list, [camp({ active: false })], NOW, "fr")).toBe(list);
  });
  it("pourcentages", () => {
    expect(discountPercent(10000, 7000)).toBe(30);
    expect(discountPercent(10000, 10000)).toBe(0);
    expect(priceFromPercent(14900, 30)).toBe(10400); // arrondi à la centaine inférieure
    expect(priceFromPercent(150, 50)).toBe(75); // petit prix : pas d'arrondi à 0
    expect(priceFromPercent(10000, 0)).toBeNull();
    expect(priceFromPercent(10000, 100)).toBeNull();
  });
});

describe("campagnes : mise en avant et compte à rebours", () => {
  it("la campagne en cours qui finit le plus tôt, avec au moins un produit", () => {
    const later = camp({ id: "c2", slug: "noel", endsAt: new Date(NOW + 48 * H).toISOString() });
    expect(featuredCampaign([later, camp()], NOW)?.slug).toBe("black-friday");
    expect(featuredCampaign([camp({ items: [] })], NOW)).toBeNull();
  });
  it("compte à rebours", () => {
    expect(countdownParts(new Date(NOW + 26 * H + 61_000).toISOString(), NOW)).toEqual({ days: 1, hours: 2, minutes: 1, seconds: 1 });
    expect(countdownParts(new Date(NOW - 1).toISOString(), NOW)).toBeNull();
  });
});

describe("campagnes : validation admin", () => {
  const base: CampaignFormInput = {
    slug: "",
    nameFr: "Black Friday",
    nameEn: "",
    taglineFr: "",
    taglineEn: "",
    startsAt: "2026-11-27T00:00:00Z",
    endsAt: "2026-11-30T23:00:00Z",
    active: true,
    showMenu: true,
    showBanner: true,
    showCountdown: true,
    items: [{ productId: "p1", salePrice: 7000 }],
  };
  const prices = new Map([["p1", 10000]]);
  it("valide : slug et nom anglais déduits", () => {
    const r = validateCampaign(base, prices);
    expect(r.ok && r.value.slug).toBe("black-friday");
    expect(r.ok && r.value.nameEn).toBe("Black Friday");
  });
  it("refuse un faux prix barré (prix de campagne ≥ prix normal)", () => {
    const r = validateCampaign({ ...base, items: [{ productId: "p1", salePrice: 10000 }] }, prices);
    expect(r.ok).toBe(false);
  });
  it("refuse une remise > 90 %, des dates inversées, une campagne trop longue, aucun produit", () => {
    expect(validateCampaign({ ...base, items: [{ productId: "p1", salePrice: 500 }] }, prices).ok).toBe(false);
    expect(validateCampaign({ ...base, endsAt: base.startsAt }, prices).ok).toBe(false);
    expect(validateCampaign({ ...base, endsAt: "2027-03-01T00:00:00Z" }, prices).ok).toBe(false);
    expect(validateCampaign({ ...base, items: [] }, prices).ok).toBe(false);
    expect(validateCampaign({ ...base, items: [{ productId: "inconnu", salePrice: 100 }] }, prices).ok).toBe(false);
  });
  it("slug", () => expect(slugifyCampaign("Fête des mères 2026 !")).toBe("fete-des-meres-2026"));
});

describe("campagnes : statistiques", () => {
  it("commandes distinctes, unités, chiffre d'affaires, top produits", () => {
    const s = campaignStats([
      { orderId: "o1", productId: "p1", name: "Lampe", unitPrice: 7000, qty: 2 },
      { orderId: "o1", productId: "p2", name: "Gourde", unitPrice: 3000, qty: 1 },
      { orderId: "o2", productId: "p1", name: "Lampe", unitPrice: 7000, qty: 1 },
    ]);
    expect(s).toMatchObject({ orders: 2, units: 4, revenue: 24000 });
    expect(s.top[0]).toEqual({ name: "Lampe", units: 3, revenue: 21000 });
  });
});
