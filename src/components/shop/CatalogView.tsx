"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useCartLines } from "@/lib/cart/store";
import type { Product } from "@/lib/catalog/types";
import {
  BUDGETS,
  SORTS,
  computeSelection,
  filterCatalog,
  filtersToQuery,
  hasActiveFilters,
  parseFilters,
  productTag,
  type CatalogFilters,
  type CatalogSort,
  type ShellCategory,
} from "./logic";
import { ProductCard } from "./ProductCard";
import { useViewedIds } from "./viewed";

/**
 * Page catalogue (maquette lignes 319-380). L'état (rayon, collection, tri, recherche, budget) vit dans l'URL
 * (?cat=&col=&sort=&q=&budget=) ; le filtrage se fait ici, côté navigateur, sur la liste complète : la page reste statique.
 */
export function CatalogView({
  products,
  categories,
  newIds,
  bestIds,
}: {
  products: Product[];
  categories: ShellCategory[];
  newIds: string[];
  bestIds: string[];
}) {
  const t = useTranslations("Catalog");
  const router = useRouter();
  const sp = useSearchParams();
  const viewed = useViewedIds();
  const lines = useCartLines();

  const catIds = useMemo(() => categories.map((c) => c.id), [categories]);
  const catLabels = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.label])), [categories]);
  const filters = useMemo(() => parseFilters((k) => sp.get(k), catIds), [sp, catIds]);
  const selectionIds = useMemo(
    () => (filters.col === "selection" ? computeSelection(products, { viewed, cartIds: lines.map((l) => l.id) }).ids : []),
    [filters.col, products, viewed, lines],
  );
  const list = useMemo(() => filterCatalog(products, filters, { catLabels, newIds, selectionIds }), [products, filters, catLabels, newIds, selectionIds]);

  function update(patch: Partial<CatalogFilters>) {
    const qs = filtersToQuery({ ...filters, ...patch });
    router.replace(qs ? `/catalogue?${qs}` : "/catalogue", { scroll: false });
  }

  const q = filters.q.trim();
  const title = q ? t("titleQuery", { q }) : filters.col ? t(`col.${filters.col}`) : filters.cat !== "all" ? (catLabels[filters.cat] ?? t("titleAll")) : t("titleAll");
  const chip = (on: boolean) => ({
    background: on ? "#141210" : "transparent",
    color: on ? "#F4F1EA" : "#141210",
    borderColor: on ? "#141210" : "#D6CFC0",
  });

  return (
    <>
      <nav aria-label={t("crumb")} className="text-muted mb-[14px] flex gap-2 text-[13px]">
        <Link href="/" className="text-muted! hover:text-muted! underline">
          {t("home")}
        </Link>
        <span aria-hidden="true">/</span>
        <span>{t("title")}</span>
      </nav>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-[6px]">
          <h1 className="font-display m-0 text-[clamp(28px,3.6vw,44px)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">{title}</h1>
          <span className="text-muted text-[14px]" aria-live="polite">
            {t("count", { count: list.length })}
          </span>
        </div>
        <label className="text-text flex items-center gap-2 text-[14px]">
          {t("sort")}
          <select
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value as CatalogSort })}
            className="border-border-strong min-h-11 cursor-pointer rounded-full border bg-white px-[14px]"
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`sorts.${s}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mb-7 flex flex-col gap-3">
        <div role="group" aria-label={t("categories")} className="flex flex-wrap gap-2">
          {[{ id: "all", label: t("allCats"), count: products.length }, ...categories].map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={filters.cat === c.id}
              onClick={() => update({ cat: c.id })}
              className="flex min-h-11 cursor-pointer items-center gap-[6px] rounded-full border px-4 text-[14px] font-medium"
              style={chip(filters.cat === c.id)}
            >
              {c.label}
              <span className="text-[12px] opacity-65">{c.count}</span>
            </button>
          ))}
        </div>
        <div role="group" aria-label={t("budget")} className="flex flex-wrap items-center gap-2">
          <span className="text-text mr-[2px] text-[13px]">{t("budget")}</span>
          {BUDGETS.map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={filters.budget === b}
              onClick={() => update({ budget: b })}
              className="min-h-11 cursor-pointer rounded-full border px-[14px] text-[13px]"
              style={chip(filters.budget === b)}
            >
              {t(`budgets.${b}`)}
            </button>
          ))}
          {q || filters.col ? (
            <span className="rounded-full bg-[#FBEFC9] px-[14px] py-[10px] text-[13px] font-medium">{q ? t("searchTag", { q }) : t(`col.${filters.col}`)}</span>
          ) : null}
          {hasActiveFilters(filters) ? (
            <button
              type="button"
              onClick={() => router.replace("/catalogue", { scroll: false })}
              className="min-h-11 cursor-pointer border-0 bg-transparent px-2 text-[13px] underline underline-offset-[3px]"
            >
              {t("clear")}
            </button>
          ) : null}
        </div>
      </div>
      {list.length === 0 ? (
        <div className="border-border-strong mb-6 flex flex-col items-center gap-[14px] rounded-[20px] border border-dashed px-6 py-10 text-center">
          <strong className="text-[18px]">{t("emptyTitle")}</strong>
          <span className="text-text text-[15px]">{t("emptyText")}</span>
          <button
            type="button"
            onClick={() => router.replace("/catalogue", { scroll: false })}
            className="border-border-strong min-h-[46px] cursor-pointer rounded-full border bg-transparent px-5"
          >
            {t("clear")}
          </button>
        </div>
      ) : null}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-x-5 gap-y-7">
        {list.map((p) => (
          <ProductCard key={p.id} product={p} tag={productTag(p, { newIds, bestIds })} animate />
        ))}
      </div>
    </>
  );
}
