// Pages (lot SEO 2) : 308 vers le bon slug au changement de langue, vrai 404 sinon (produit, pack) ; sitemap assemblé
// (fiches traduites seulement en EN, catalogue vide retiré, campagnes, lastmod).
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  permanentRedirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:308:${url}`);
  }),
}));
vi.mock("next/navigation", () => nav);
vi.mock("@/i18n/navigation", () => ({ Link: () => null, useRouter: () => ({}), usePathname: () => "/" }));
vi.mock("next-intl/server", () => ({
  setRequestLocale: () => {},
  getTranslations: async () => Object.assign((k: string) => k, { rich: (k: string) => k, has: () => true }),
}));
const catalog = vi.hoisted(() => ({
  getProductBySlug: vi.fn(),
  findProductSlug: vi.fn(),
  getProducts: vi.fn(),
  getProductSlugs: vi.fn(),
  getProductsUpdatedAt: vi.fn(),
  getCategories: vi.fn(),
  getRelatedProducts: vi.fn(),
  getReviews: vi.fn(),
  getSettings: vi.fn(),
  getRealRating: vi.fn(),
}));
vi.mock("@/lib/catalog", () => catalog);
const packs = vi.hoisted(() => ({
  getPackBySlug: vi.fn(),
  findPackSlug: vi.fn(),
  getPacks: vi.fn(),
  getPackSlugs: vi.fn(),
  getPacksEnabled: vi.fn(),
}));
vi.mock("@/lib/catalog/packs", () => packs);
const campaigns = vi.hoisted(() => ({ getLiveCampaigns: vi.fn() }));
vi.mock("@/lib/campaigns/data", () => campaigns);

beforeEach(() => {
  for (const f of [...Object.values(catalog), ...Object.values(packs), ...Object.values(campaigns)]) f.mockReset();
  nav.notFound.mockClear();
  nav.permanentRedirect.mockClear();
  packs.getPacksEnabled.mockResolvedValue(true);
});

const params = (lang: string, slug: string) => ({ params: Promise.resolve({ lang, slug }) });

describe("fiche produit : slug d'une autre langue", () => {
  it("slug FR demandé en /en → 308 vers le slug EN", async () => {
    catalog.getProductBySlug.mockResolvedValue(null);
    catalog.findProductSlug.mockResolvedValue("black-soap");
    const { default: ProductPage } = await import("@/app/[lang]/(shop)/produit/[slug]/page");
    await expect(ProductPage(params("en", "savon-noir"))).rejects.toThrow("NEXT_REDIRECT:308:/en/produit/black-soap");
    expect(catalog.findProductSlug).toHaveBeenCalledWith("en", "savon-noir");
    expect(nav.notFound).not.toHaveBeenCalled();
  });
  it("slug inconnu dans toutes les langues → vrai 404", async () => {
    catalog.getProductBySlug.mockResolvedValue(null);
    catalog.findProductSlug.mockResolvedValue(null);
    const { default: ProductPage } = await import("@/app/[lang]/(shop)/produit/[slug]/page");
    await expect(ProductPage(params("fr", "inconnu-xyz"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(nav.permanentRedirect).not.toHaveBeenCalled();
  });
});

describe("fiche pack : slug d'une autre langue", () => {
  it("slug EN demandé en /fr → 308 vers le slug FR ; inconnu → 404 ; packs désactivés → 404", async () => {
    const { default: PackPage } = await import("@/app/[lang]/(shop)/packs/[slug]/page");
    packs.getPackBySlug.mockResolvedValue(null);
    packs.findPackSlug.mockResolvedValue("pack-cuisine");
    await expect(PackPage(params("fr", "kitchen-pack"))).rejects.toThrow("NEXT_REDIRECT:308:/fr/packs/pack-cuisine");
    packs.findPackSlug.mockResolvedValue(null);
    await expect(PackPage(params("fr", "rien"))).rejects.toThrow("NEXT_NOT_FOUND");
    packs.getPacksEnabled.mockResolvedValue(false);
    packs.findPackSlug.mockResolvedValue("pack-cuisine");
    await expect(PackPage(params("fr", "kitchen-pack"))).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("URL inconnue sous /{lang}", () => {
  it("le « attrape-tout » de la boutique renvoie la 404 localisée", async () => {
    const { default: UnknownPage } = await import("@/app/[lang]/(shop)/[...rest]/page");
    expect(() => UnknownPage()).toThrow("NEXT_NOT_FOUND");
  });
});

describe("sitemap assemblé", () => {
  it("EN seulement pour les fiches traduites, lastmod, campagnes, catalogue vide retiré, packs désactivés absents", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.exemple.test");
    catalog.getProducts.mockResolvedValue([
      { id: "p1", slug: "savon-noir" },
      { id: "p2", slug: "gourde" },
    ]);
    catalog.getProductSlugs.mockResolvedValue(new Map([["p1", { fr: "savon-noir", en: "black-soap" }], ["p2", { fr: "gourde" }]]));
    catalog.getProductsUpdatedAt.mockResolvedValue(new Map([["p1", "2026-10-12T10:00:00Z"]]));
    packs.getPacksEnabled.mockResolvedValue(false);
    campaigns.getLiveCampaigns.mockResolvedValue([{ slug: "noel" }]);
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((e) => e.url);
    const B = "https://www.exemple.test";
    expect(urls).toContain(`${B}/en/produit/black-soap`);
    expect(urls).toContain(`${B}/fr/produit/gourde`);
    expect(urls).not.toContain(`${B}/en/produit/gourde`);
    expect(urls).toContain(`${B}/fr/campagne/noel`);
    expect(urls).toContain(`${B}/fr/catalogue`);
    expect(urls.some((u) => u.includes("/packs"))).toBe(false);
    expect(packs.getPacks).not.toHaveBeenCalled();
    expect((await sitemap()).find((e) => e.url === `${B}/fr/produit/savon-noir`)?.lastModified).toBe("2026-10-12T10:00:00Z");

    catalog.getProducts.mockResolvedValue([]);
    catalog.getProductSlugs.mockResolvedValue(new Map());
    const empty = (await sitemap()).map((e) => e.url);
    expect(empty.some((u) => u.endsWith("/catalogue"))).toBe(false);
    expect(empty).toContain(`${B}/fr`);
    vi.unstubAllEnvs();
  });
  it("base en panne → erreur (l'ISR garde le sitemap précédent), pas un sitemap amputé", async () => {
    catalog.getProducts.mockRejectedValue(new Error("catalog_unavailable"));
    catalog.getProductSlugs.mockResolvedValue(new Map());
    catalog.getProductsUpdatedAt.mockResolvedValue(new Map());
    campaigns.getLiveCampaigns.mockResolvedValue([]);
    const { default: sitemap } = await import("@/app/sitemap");
    await expect(sitemap()).rejects.toThrow("catalog_unavailable");
  });
});
