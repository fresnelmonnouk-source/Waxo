import { describe, expect, it, vi } from "vitest";

vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.exemple.test");
import { withSeo } from "@/lib/seo/metadata";

describe("withSeo : canonique et hreflang", () => {
  it("page publique : canonique propre + hreflang FR/EN/x-default, titre conservé", () => {
    const m = withSeo({ title: "Catalogue" }, "fr", "/catalogue");
    expect(m.title).toBe("Catalogue");
    expect(m.alternates?.canonical).toBe("https://www.exemple.test/fr/catalogue");
    expect(m.alternates?.languages).toEqual({
      fr: "https://www.exemple.test/fr/catalogue",
      en: "https://www.exemple.test/en/catalogue",
      "x-default": "https://www.exemple.test/fr/catalogue",
    });
  });
  it("accueil : canonique = /fr (pas de slash final), en anglais = /en", () => {
    expect(withSeo({}, "fr", "/").alternates?.canonical).toBe("https://www.exemple.test/fr");
    expect(withSeo({}, "en", "/").alternates?.canonical).toBe("https://www.exemple.test/en");
  });
  it("fiche produit : canonique seule (les slugs diffèrent selon la langue)", () => {
    const m = withSeo({ title: "Gourde" }, "en", "/produit/gourde", { canonicalOnly: true });
    expect(m.alternates).toEqual({ canonical: "https://www.exemple.test/en/produit/gourde" });
  });
  it("page privée : noindex/nofollow et aucune canonique", () => {
    const m = withSeo({ title: "Mon compte" }, "fr", "/compte", { noindex: true });
    expect(m.robots).toEqual({ index: false, follow: false });
    expect(m.alternates).toBeUndefined();
  });
});

describe("origine du site : seule l'origine compte", () => {
  it("une valeur saisie avec un chemin ou un slash ne double jamais la langue", async () => {
    const { cleanOrigin } = await import("@/lib/origin");
    const { siteUrl, absoluteUrl } = await import("@/lib/seo/site");
    const { siteUrl: payUrl } = await import("@/lib/payment/config");
    expect(cleanOrigin("https://waxo.boutique/fr")).toBe("https://waxo.boutique");
    expect(cleanOrigin(" https://www.waxo.boutique/ ")).toBe("https://www.waxo.boutique");
    expect(cleanOrigin("https://waxo.boutique/fr/catalogue?x=1#y")).toBe("https://waxo.boutique");
    expect(cleanOrigin("waxo.boutique")).toBeNull();
    expect(cleanOrigin("javascript:alert(1)")).toBeNull();
    expect(cleanOrigin(undefined)).toBeNull();
    const env = { NEXT_PUBLIC_SITE_URL: "https://waxo-one.vercel.app/fr" };
    expect(siteUrl(env)).toBe("https://waxo-one.vercel.app");
    expect(absoluteUrl("fr", "/", siteUrl(env))).toBe("https://waxo-one.vercel.app/fr");
    expect(payUrl(env)).toBe("https://waxo-one.vercel.app");
  });
});
