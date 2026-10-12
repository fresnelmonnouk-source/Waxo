import { describe, expect, it } from "vitest";
import { publicAuthor, showReviews, summary, validateSiteReview } from "@/lib/site-reviews/logic";

describe("avis sur la boutique : règles", () => {
  it("la section n'affiche des avis qu'à partir de 3 (sinon invitation, jamais de faux avis)", () => {
    expect(showReviews(0)).toBe(false);
    expect(showReviews(2)).toBe(false);
    expect(showReviews(3)).toBe(true);
  });
  it("validation : note 1-5, texte 10-600, nom côté admin", () => {
    expect(validateSiteReview({ rating: 5, body: "Livraison le jour même, parfait." }).ok).toBe(true);
    expect(validateSiteReview({ rating: 0, body: "Livraison le jour même, parfait." })).toEqual({ ok: false, field: "rating" });
    expect(validateSiteReview({ rating: 4, body: "Bien" })).toEqual({ ok: false, field: "body" });
    expect(validateSiteReview({ rating: 4, body: "Très bon service client.", author: "A" })).toEqual({ ok: false, field: "author" });
  });
  it("nom public abrégé et moyenne réelle", () => {
    expect(publicAuthor("Afi", "Houngbédji")).toBe("Afi H.");
    expect(summary([{ rating: 5 }, { rating: 4 }, { rating: 5 }])).toEqual({ average: 4.7, count: 3 });
    expect(summary([])).toEqual({ average: 0, count: 0 });
  });
});
