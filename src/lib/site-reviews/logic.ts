// Avis sur la boutique (migration 0018) : règles PURES, testées dans tests/site-reviews.test.ts.

export type SiteReview = {
  id: string;
  author: string;
  city: string | null;
  rating: number;
  body: string;
  verified: boolean;
  publishedAt: string;
};

/** La section de l'accueil montre les avis à partir de ce nombre ; en dessous, une invitation honnête à donner son avis. */
export const MIN_REVIEWS_TO_SHOW = 3;

export const showReviews = (count: number) => count >= MIN_REVIEWS_TO_SHOW;

export type SiteReviewInput = { rating: number; body: string; city?: string | null; author?: string | null };

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Valide un avis (client ou admin). Le nom vient du profil côté client, de la saisie côté admin. */
export function validateSiteReview(
  raw: SiteReviewInput,
): { ok: true; value: { rating: number; body: string; city: string | null; author: string } } | { ok: false; field: "rating" | "body" | "city" | "author" } {
  const rating = Number(raw.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, field: "rating" };
  const body = clean(raw.body, 600);
  if (body.length < 10) return { ok: false, field: "body" };
  const city = clean(raw.city ?? "", 40) || null;
  const author = clean(raw.author ?? "", 60);
  if (raw.author !== undefined && raw.author !== null && author.length < 2) return { ok: false, field: "author" };
  return { ok: true, value: { rating, body, city, author } };
}

/** « Afi Houngbédji » → « Afi H. » (jamais le nom complet affiché publiquement). */
export function publicAuthor(first: string, last: string): string {
  const f = clean(first, 30);
  const l = clean(last, 30);
  return [f, l ? `${l.charAt(0).toUpperCase()}.` : ""].filter(Boolean).join(" ");
}

/** Moyenne affichée (1 décimale) et nombre d'avis publiés. */
export function summary(reviews: Pick<SiteReview, "rating">[]): { average: number; count: number } {
  if (!reviews.length) return { average: 0, count: 0 };
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  return { average: Math.round(avg * 10) / 10, count: reviews.length };
}
