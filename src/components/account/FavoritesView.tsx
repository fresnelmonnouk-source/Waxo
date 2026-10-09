"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ProductCard } from "@/components/shop/ProductCard";
import type { Product } from "@/lib/catalog/types";
import { useFavoriteIds } from "@/lib/favorites/store";
import { BTN_DARK, BTN_OUTLINE, useMounted } from "./ui";

/**
 * Page /favoris : les identifiants viennent du navigateur (store favoris), les produits de GET /api/products?ids=
 * (la page reste statique). Seuls les identifiants jamais demandés sont chargés : retirer un cœur ne recharge rien.
 */
export function FavoritesView() {
  const t = useTranslations("Favorites");
  const locale = useLocale();
  const mounted = useMounted();
  const ids = useFavoriteIds();
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [resolved, setResolved] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState(false);
  const asked = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (failed) return;
    const todo = ids.filter((id) => !asked.current.has(id));
    if (!todo.length) return;
    todo.forEach((id) => asked.current.add(id));
    fetch(`/api/products?ids=${encodeURIComponent(todo.join(","))}&lang=${locale}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("http"))))
      .then((data: { products?: Product[] }) => {
        const list = Array.isArray(data.products) ? data.products : [];
        setProducts((prev) => ({ ...prev, ...Object.fromEntries(list.map((p) => [p.id, p])) }));
        setResolved((prev) => new Set([...prev, ...todo]));
      })
      .catch(() => {
        todo.forEach((id) => asked.current.delete(id));
        setFailed(true);
      });
  }, [ids, locale, failed]);

  const shown = ids.map((id) => products[id]).filter((p): p is Product => !!p);
  const loading = !mounted || (!failed && ids.some((id) => !resolved.has(id)));

  return (
    <>
      <div className="mb-6 flex flex-col gap-[6px]">
        <h1 className="font-display m-0 text-[clamp(28px,3.6vw,44px)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">{t("title")}</h1>
        {mounted && !loading && shown.length ? (
          <span className="text-[14px] text-muted">
            {t("count", { count: shown.length })} · {t("deviceNote")}
          </span>
        ) : null}
      </div>

      {failed ? (
        <div className="flex flex-col items-start gap-3 rounded-[20px] border border-dashed border-border-strong p-8">
          <strong className="text-[17px]">{t("error")}</strong>
          <button type="button" onClick={() => setFailed(false)} className={`${BTN_OUTLINE} min-h-11 px-5`}>
            {t("retry")}
          </button>
        </div>
      ) : loading ? (
        <p className="m-0 text-[15px] text-muted" role="status">
          {t("loading")}
        </p>
      ) : !shown.length ? (
        <div className="flex flex-col items-start gap-3 rounded-[20px] border border-dashed border-border-strong p-8">
          <strong className="text-[17px]">{t("emptyTitle")}</strong>
          <span className="text-[15px] leading-[1.5] text-text">{t("emptyText")}</span>
          <Link href="/catalogue" className={`${BTN_DARK} px-5 py-3`}>
            {t("cta")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-x-5 gap-y-7">
          {shown.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </>
  );
}
