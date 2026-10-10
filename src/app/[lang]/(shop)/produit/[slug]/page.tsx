import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import {
  getCategories,
  getProductBySlug,
  getProducts,
  getRelatedProducts,
  getReviews,
  getSettings,
  type Product,
} from "@/lib/catalog";
import { Price } from "@/lib/currency/client";
import { discountPercent } from "@/lib/money";
import { AskAssistantButton, SuggestAlternativeButton } from "@/components/product/AssistantButtons";
import { cssImage, FALLBACK_BG } from "@/components/product/media";
import { ProductBuy } from "@/components/product/ProductBuy";
import { RatingLink } from "@/components/product/RatingLink";
import { RelatedItem } from "@/components/product/RelatedItem";
import { ReviewsSection, type ReviewView } from "@/components/product/ReviewsSection";
import { Stars } from "@/components/product/Stars";
import { withSeo } from "@/lib/seo/metadata";

// Page statique (ISR) : aucun cookies()/headers(). Les avis et le stock se rafraîchissent toutes les 2 minutes.
export const revalidate = 120;

type Params = { lang: string; slug: string };

export async function generateStaticParams() {
  const lists = await Promise.all(routing.locales.map(async (lang) => ({ lang, list: await getProducts(lang) })));
  return lists.flatMap(({ lang, list }) => list.map((p) => ({ lang, slug: p.slug })));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!hasLocale(routing.locales, lang)) return {};
  setRequestLocale(lang);
  const product = await getProductBySlug(lang, slug);
  if (!product) return {};
  return withSeo({ title: product.name, description: product.description }, lang, `/produit/${encodeURIComponent(slug)}`, { canonicalOnly: true });
}

const DAY = 864e5;

/** Pastille de la maquette (`card()`) : Épuisé > remise > Nouveau > Best-seller. */
function pickTag(
  p: Product,
  all: Product[],
  t: (key: "tagSoldOut" | "tagNew" | "tagBest") => string,
): { label: string; bg: string; color: string } | null {
  if (p.stock <= 0) return { label: t("tagSoldOut"), bg: "#E2DCCF", color: "#4A443C" };
  const pct = discountPercent(p.comparePrice, p.price);
  if (pct > 0) return { label: `-${pct} %`, bg: "#C2410C", color: "#fff" };
  const newest = Math.max(0, ...all.map((x) => +new Date(x.createdAt)));
  if (+new Date(p.createdAt) >= newest - 30 * DAY) return { label: t("tagNew"), bg: "#FFC93C", color: "#141210" };
  const best = all
    .filter((x) => x.stock > 0)
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 4);
  if (best.some((x) => x.id === p.id)) return { label: t("tagBest"), bg: "#141210", color: "#FFC93C" };
  return null;
}

const decimal = (n: number, lang: Locale) => n.toFixed(1).replace(".", lang === "en" ? "." : ",");

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { lang, slug } = await params;
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);

  const product = await getProductBySlug(lang, slug);
  if (!product) notFound();

  const [t, all, categories, related, reviewRows, settings] = await Promise.all([
    getTranslations({ locale: lang, namespace: "Product" }),
    getProducts(lang),
    getCategories(lang),
    getRelatedProducts(lang, product, 8),
    getReviews(product.id),
    getSettings(),
  ]);

  const category = categories.find((c) => c.id === product.categoryId);
  const tag = pickTag(product, all, (k) => t(k));
  const pct = discountPercent(product.comparePrice, product.price);
  const soldOut = product.stock <= 0;
  const bg = product.bg ?? FALLBACK_BG;
  const img = cssImage(product.imageUrl);
  const { cutoff, returnDays } = settings.shipping;
  const stockColor = soldOut ? "#6B645A" : product.stock <= 5 ? "#C2410C" : "#1F6B4A";
  const stockText = soldOut
    ? t("stockOut")
    : product.stock <= 5
      ? t("stockLow", { count: product.stock, cutoff })
      : t("stockOk", { cutoff });
  const avgTxt = decimal(product.rating.average, lang);
  const countTxt = t("reviewsCount", { count: product.rating.count });
  const alsoBought = related.filter((r) => r.stock > 0).slice(0, 3);
  const dateFmt = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const reviews: ReviewView[] = reviewRows.map((r) => ({
    id: r.id,
    author: r.author,
    rating: r.rating,
    body: r.body,
    dateTxt: r.createdAt ? dateFmt.format(new Date(r.createdAt)) : "",
    verified: r.verified,
  }));
  const question = t("assistantQuestion", { name: product.name });

  return (
    <main className="mx-auto min-h-[70vh] max-w-[1180px] px-5 pt-6 pb-20">
      <nav aria-label={t("breadcrumbLabel")} className="mb-4 flex flex-wrap gap-2 text-[13px] text-muted">
        <Link href="/" className="text-muted">
          {t("home")}
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={category ? `/catalogue?category=${category.id}` : "/catalogue"} className="text-muted">
          {category?.label ?? ""}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] items-start gap-9">
        <div
          className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[28px]"
          style={{ background: bg }}
        >
          <span className="font-display text-[clamp(40px,5.5vw,68px)] font-semibold tracking-[-0.05em] opacity-75">
            {product.keyword}
          </span>
          {img ? (
            <div
              role="img"
              aria-label={product.name}
              className="absolute inset-0 h-full w-full"
              style={{ background: img }}
            />
          ) : null}
          {tag ? (
            <span
              className="absolute top-[18px] left-[18px] rounded-full px-3 py-1.5 text-[13px] font-semibold"
              style={{ background: tag.bg, color: tag.color }}
            >
              {tag.label}
            </span>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-[18px]">
          <div className="flex flex-col gap-2.5">
            <RatingLink>
              <Stars value={product.rating.average} size={16} />
              <span className="underline underline-offset-[3px]">
                {product.rating.count > 0 ? `${avgTxt} · ${countTxt}` : t("noRating")}
              </span>
            </RatingLink>
            <h1 className="font-display m-0 text-[clamp(26px,3vw,38px)] leading-[1.1] font-semibold tracking-[-0.03em] text-balance">
              {product.name}
            </h1>
            <div className="flex flex-wrap items-baseline gap-2.5">
              <strong className="text-[28px]"><Price amount={product.price} /></strong>
              {pct > 0 && product.comparePrice ? (
                <>
                  <span className="text-[17px] text-muted line-through"><Price amount={product.comparePrice} /></span>
                  <span className="rounded-full bg-terracotta-deep px-2.5 py-1 text-[13px] font-semibold text-white">
                    -{pct} %
                  </span>
                </>
              ) : null}
            </div>
          </div>
          <p className="m-0 text-[16px] leading-[1.6] text-text text-pretty">{product.description}</p>
          <span className="text-[14px] font-medium" style={{ color: stockColor }}>
            {stockText}
          </span>

          {soldOut ? (
            <div className="flex flex-col gap-2.5 rounded-2xl bg-card p-4">
              <strong>{t("comingSoonTitle")}</strong>
              <span className="text-[14px] text-text">{t("comingSoonText")}</span>
              <SuggestAlternativeButton question={question} />
            </div>
          ) : (
            <ProductBuy
              id={product.id}
              slug={product.slug}
              name={product.name}
              price={product.price}
              stock={product.stock}
              bg={product.bg}
              imageUrl={product.imageUrl}
            />
          )}

          <div className="flex flex-col gap-2 border-t border-border pt-4 text-[14px] text-text">
            <span>{t("deliveryNote", { cutoff })}</span>
            <span>{settings.pay.cod ? t("payAll") : t("payNoCod")}</span>
            <span>
              {t("returns", { days: returnDays })}{" "}
              <Link href="/livraison-retours">{t("conditions")}</Link>
            </span>
          </div>
          <AskAssistantButton question={question} />
        </div>
      </div>

      {alsoBought.length > 0 ? (
        <section aria-label={t("alsoBought")} className="mt-14 flex flex-col gap-4">
          <h2 className="font-display m-0 text-[22px] font-semibold tracking-[-0.02em]">{t("alsoBought")}</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3">
            {alsoBought.map((r) => (
              <RelatedItem
                key={r.id}
                id={r.id}
                slug={r.slug}
                name={r.name}
                price={r.price}
                bg={r.bg ?? FALLBACK_BG}
                imageUrl={r.imageUrl}
              />
            ))}
          </div>
        </section>
      ) : null}

      <ReviewsSection
        productId={product.id}
        productName={product.name}
        average={product.rating.average}
        avgTxt={avgTxt}
        countTxt={countTxt}
        reviews={reviews}
      />
    </main>
  );
}
