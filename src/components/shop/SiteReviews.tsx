import { useLocale, useTranslations } from "next-intl";
import { Stars } from "@/components/product/Stars";
import { Link } from "@/i18n/navigation";
import { showReviews, summary, type SiteReview } from "@/lib/site-reviews/logic";

/** Nombre maximum de cartes sur l'accueil (la moyenne, elle, porte sur tous les avis publiés reçus). */
export const HOME_MAX_CARDS = 6;

const H2 = "font-display m-0 text-[clamp(24px,2.8vw,34px)] leading-[1.05] font-semibold tracking-[-0.035em]";
const CTA =
  "bg-ink text-cream! hover:text-cream! inline-flex min-h-12 items-center justify-center rounded-full px-[26px] py-3 text-[16px] font-semibold no-underline hover:bg-[#2C2823]";

/**
 * « Avis sur la boutique » (dernière section de l'accueil). Avis GÉNÉRAUX sur Wá xɔ, publiés après relecture.
 * Moins de MIN_REVIEWS_TO_SHOW avis : invitation honnête, AUCUN avis ni note affichés (jamais d'avis fictif).
 */
export function SiteReviews({ reviews }: { reviews: SiteReview[] }) {
  const t = useTranslations("SiteReviews");
  const locale = useLocale();

  if (!showReviews(reviews.length)) {
    return (
      <section aria-labelledby="site-reviews-title" data-site-reviews="invite" className="mx-auto max-w-[1280px] px-5 py-14">
        <div className="bg-card rounded-block flex flex-col items-start gap-4 p-7 min-[760px]:flex-row min-[760px]:items-center min-[760px]:justify-between min-[760px]:p-10">
          <div className="flex max-w-[640px] flex-col gap-2">
            <h2 id="site-reviews-title" className={H2}>
              {t("inviteTitle")}
            </h2>
            <p className="text-text m-0 text-[16px] leading-[1.55]">{t("inviteText")}</p>
          </div>
          <Link href="/avis-boutique" className={`${CTA} shrink-0`}>
            {t("cta")}
          </Link>
        </div>
      </section>
    );
  }

  const { average, count } = summary(reviews);
  const avgTxt = new Intl.NumberFormat(locale === "en" ? "en-GB" : "fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(average);
  const shown = reviews.slice(0, HOME_MAX_CARDS);

  return (
    <section aria-labelledby="site-reviews-title" data-site-reviews="list" className="mx-auto max-w-[1280px] px-5 py-14">
      <div className="border-border mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b pb-4">
        <div className="flex flex-col gap-2">
          <h2 id="site-reviews-title" className={H2}>
            {t("title")}
          </h2>
          <div className="flex items-center gap-2.5">
            <Stars value={average} size={18} gap={2} />
            <span className="text-text text-[15px] font-medium" data-site-reviews-summary>
              {t("summary", { average: avgTxt, count })}
            </span>
          </div>
        </div>
        <Link href="/avis-boutique" className={CTA}>
          {t("cta")}
        </Link>
      </div>

      {/* Mobile : défilement horizontal avec ancrage (pas de carrousel automatique). Bureau : grille de 3. */}
      <div
        role="region"
        aria-label={t("listLabel")}
        tabIndex={0}
        className="focus-visible:outline-ink -mx-5 overflow-x-auto px-5 pb-2 [scrollbar-width:thin] focus-visible:outline-2 min-[760px]:mx-0 min-[760px]:overflow-visible min-[760px]:px-0"
      >
        <ul className="m-0 flex snap-x snap-mandatory list-none gap-4 p-0 min-[760px]:grid min-[760px]:grid-cols-3 min-[760px]:gap-5">
          {shown.map((r) => (
            <li
              key={r.id}
              className="bg-card rounded-card flex w-[82%] max-w-[340px] shrink-0 snap-start flex-col gap-3 p-5 min-[760px]:w-auto min-[760px]:max-w-none"
            >
              <span role="img" aria-label={t("starsAlt", { rating: r.rating })} className="inline-flex">
                <Stars value={r.rating} size={16} />
              </span>
              <p className="m-0 text-[15px] leading-[1.55] text-pretty break-words">{r.body}</p>
              <div className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pt-1">
                <span className="text-[14px] font-semibold">{[r.author, r.city].filter(Boolean).join(" · ")}</span>
                {r.verified ? (
                  <span className="bg-leaf-bg text-leaf rounded-full px-[9px] py-[3px] text-[12px] font-semibold">{t("verified")}</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
