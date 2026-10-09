import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Product } from "@/lib/catalog/types";
import { productTag } from "./logic";
import { ProductCard } from "./ProductCard";

/**
 * Rendu serveur du catalogue complet (sans filtre) : sert d'enveloppe statique pendant le chargement de la vue
 * interactive (qui lit l'URL côté navigateur) et donne aux moteurs de recherche la liste des produits.
 */
export function CatalogStatic({ products, newIds, bestIds }: { products: Product[]; newIds: string[]; bestIds: string[] }) {
  const t = useTranslations("Catalog");
  return (
    <>
      <nav aria-label={t("crumb")} className="text-muted mb-[14px] flex gap-2 text-[13px]">
        <Link href="/" className="text-muted! hover:text-muted! underline">
          {t("home")}
        </Link>
        <span aria-hidden="true">/</span>
        <span>{t("title")}</span>
      </nav>
      <div className="mb-5 flex flex-col gap-[6px]">
        <h1 className="font-display m-0 text-[clamp(28px,3.6vw,44px)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">{t("titleAll")}</h1>
        <span className="text-muted text-[14px]">{t("count", { count: products.length })}</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-x-5 gap-y-7">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} tag={productTag(p, { newIds, bestIds })} />
        ))}
      </div>
    </>
  );
}
