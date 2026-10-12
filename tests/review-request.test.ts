import { describe, expect, it } from "vitest";
import { renderReviewRequest } from "@/lib/email/review-request-template";

const base = {
  locale: "fr" as const,
  firstName: "Awa",
  orderNumber: "WX-10300",
  products: [{ name: "Lampe LED rechargeable", slug: "lampe-led-rechargeable" }],
  siteUrl: "https://www.waxo.boutique",
};

describe("e-mail « Donnez votre avis »", () => {
  it("FR : lien vers la section avis de la fiche, prénom, typographie", () => {
    const m = renderReviewRequest(base);
    expect(m).not.toBeNull();
    expect(m!.subject).toBe("Votre avis sur votre commande WX-10300");
    expect(m!.html).toContain("https://www.waxo.boutique/fr/produit/lampe-led-rechargeable#avis");
    expect(m!.html).toContain("Bonjour Awa,");
    expect(m!.text).toContain("Lampe LED rechargeable : https://www.waxo.boutique/fr/produit/lampe-led-rechargeable#avis");
    expect(m!.html + m!.text).not.toContain("—");
  });
  it("EN : lien en anglais", () => {
    const m = renderReviewRequest({ ...base, locale: "en" });
    expect(m!.html).toContain("/en/produit/lampe-led-rechargeable#avis");
    expect(m!.subject).toBe("Your review of order WX-10300");
  });
  it("plusieurs produits : un bouton par produit (4 au plus)", () => {
    const products = Array.from({ length: 6 }, (_, i) => ({ name: `Produit ${i}`, slug: `p-${i}` }));
    const m = renderReviewRequest({ ...base, products });
    expect((m!.html.match(/#avis/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(m!.html).not.toContain("p-5#avis");
  });
  it("rien à demander sans produit ou sans URL de site", () => {
    expect(renderReviewRequest({ ...base, products: [] })).toBeNull();
    expect(renderReviewRequest({ ...base, siteUrl: null })).toBeNull();
  });
  it("le nom du client est échappé dans le HTML", () => {
    const m = renderReviewRequest({ ...base, firstName: "<b>x</b>" });
    expect(m!.html).not.toContain("<b>x</b>");
  });
});

describe("e-mail « Donnez votre avis » : avis sur la boutique", () => {
  it("bouton vers la page d'avis boutique, FR et EN", () => {
    expect(renderReviewRequest(base)!.html).toContain("https://www.waxo.boutique/fr/avis-boutique");
    expect(renderReviewRequest(base)!.html).toContain("Donner mon avis sur Wá xɔ");
    expect(renderReviewRequest({ ...base, locale: "en" })!.text).toContain("https://www.waxo.boutique/en/avis-boutique");
  });
});
