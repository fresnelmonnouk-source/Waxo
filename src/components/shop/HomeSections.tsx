import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Product } from "@/lib/catalog/types";
import { mixOrder, type ShellCategory } from "./logic";
import { ProductCard } from "./ProductCard";

const H2 = "font-display m-0 text-[clamp(24px,2.8vw,34px)] leading-[1.05] font-semibold tracking-[-0.035em]";

function SectionHead({ title, sub, link }: { title: string; sub: string; link: ReactNode }) {
  return (
    <div className="border-border mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b pb-4">
      <div className="flex flex-col gap-[6px]">
        <h2 className={H2}>{title}</h2>
        <span className="text-muted text-[15px]">{sub}</span>
      </div>
      {link}
    </div>
  );
}

/** « Parcourir par rayon » : une tuile pastel par rayon (maquette lignes 208-218). */
export function CategoryTiles({ categories }: { categories: ShellCategory[] }) {
  const t = useTranslations("Home");
  const ts = useTranslations("Shell");
  return (
    <section aria-label={t("categories")} className="mx-auto max-w-[1280px] px-5 pt-12">
      <strong className="text-muted mb-[14px] block text-[13px] tracking-[0.08em] uppercase">{t("browse")}</strong>
      <div className="grid grid-cols-2 gap-3 min-[560px]:grid-cols-3 min-[980px]:grid-cols-6">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/catalogue?cat=${encodeURIComponent(c.id)}`}
            className="text-ink! hover:text-ink! flex min-h-[110px] flex-col justify-between gap-2 rounded-[20px] p-[18px] no-underline transition-transform duration-150 hover:-translate-y-[3px]"
            style={{ background: c.bg }}
          >
            <strong className="font-display text-[17px] font-semibold tracking-[-0.02em]">{c.label}</strong>
            <span className="text-text text-[13px]">{ts("productCount", { count: c.count })} →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Aperçu du catalogue : 8 produits dans un ordre « mélangé » stable (4 sous 760 px). Maquette lignes 220-248. */
export function HomeCatalog({ products, total }: { products: Product[]; total: number }) {
  const t = useTranslations("Home");
  const ts = useTranslations("Shell");
  const mix = mixOrder(products).slice(0, 8);
  return (
    <section className="mx-auto max-w-[1280px] px-5 pt-14">
      <SectionHead
        title={t("catalogTitle")}
        sub={t("catalogSub")}
        link={
          <Link href="/catalogue" className="text-ink! hover:text-ink! text-[15px] font-medium whitespace-nowrap underline">
            {t("catalogAll", { count: ts("productCount", { count: total }) })}
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-x-5 gap-y-7 min-[760px]:grid-cols-4">
        {mix.map((p, i) => (
          <div key={p.id} className={i >= 4 ? "min-w-0 max-[759px]:hidden" : "min-w-0"}>
            <ProductCard product={p} variant="home" />
          </div>
        ))}
      </div>
      <div className="mt-8 flex justify-center">
        <Link
          href="/catalogue"
          className="bg-ink text-cream! hover:text-cream! rounded-full px-[26px] py-[15px] text-[16px] font-semibold no-underline hover:bg-[#2C2823]"
        >
          {t("seeMore")}
        </Link>
      </div>
    </section>
  );
}

/** « Nos produits les plus vendus » : les 4 meilleures ventes en stock, numérotées (maquette lignes 278-304). */
export function BestSellers({ products, bestIds }: { products: Product[]; bestIds: string[] }) {
  const t = useTranslations("Home");
  const byId = new Map(products.map((p) => [p.id, p]));
  const best = bestIds.map((id) => byId.get(id)).filter((p): p is Product => !!p);
  return (
    <section className="mx-auto max-w-[1280px] px-5 pt-16 pb-[72px]">
      <SectionHead
        title={t("bestTitle")}
        sub={t("bestSub")}
        link={
          <Link href="/catalogue?col=ventes" className="text-ink! hover:text-ink! text-[15px] font-medium whitespace-nowrap underline">
            {t("bestAll")}
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-x-5 gap-y-7 min-[760px]:grid-cols-4">
        {best.map((p, i) => (
          <ProductCard key={p.id} product={p} variant="home" rank={i + 1} />
        ))}
      </div>
    </section>
  );
}

/** « Commander chez Wá xɔ, c'est simple. » (maquette lignes 306-313). */
export function HowItWorks() {
  const t = useTranslations("Home");
  const steps = [
    ["1", t("step1Title"), t("step1Text")],
    ["2", t("step2Title"), t("step2Text")],
    ["3", t("step3Title"), t("step3Text")],
  ];
  return (
    <section className="bg-ink text-cream">
      <div className="mx-auto grid max-w-[1280px] grid-cols-[repeat(auto-fit,minmax(min(100%,250px),1fr))] gap-10 px-5 py-[72px]">
        <h2 className="font-display m-0 text-[clamp(26px,3vw,38px)] leading-[1.08] font-semibold tracking-[-0.035em]">
          {t.rich("howTitle", { o: (chunks) => <span className="text-terracotta">{chunks}</span> })}
        </h2>
        {steps.map(([n, title, text]) => (
          <div key={n} className="flex flex-col gap-[10px]">
            <span className="font-display text-terracotta text-[36px] font-bold">{n}</span>
            <strong className="text-[17px]">{title}</strong>
            <span className="leading-normal text-[#B9B1A4]">{text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
