import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cssUrl } from "@/components/shop/logic";
import { fmtXof } from "@/lib/money";
import { itemCount, type PackItem } from "./logic";

/** Liste « Dans ce pack » de la page détail : vignette, nom (lien vers la fiche), quantité, prix. */
export function PackContents({ items }: { items: PackItem[] }) {
  const t = useTranslations("Packs.detail");
  return (
    <section aria-labelledby="pack-contents" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="pack-contents" className="font-display m-0 text-[22px] font-semibold tracking-[-0.02em]">
          {t("includes")}
        </h2>
        <span className="text-muted text-[14px]">{t("includesCount", { count: itemCount(items) })}</span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {items.map((it) => (
          <li key={it.productId} className="bg-card rounded-card flex items-center gap-4 p-3 pr-4">
            <Link
              href={`/produit/${it.slug}`}
              aria-label={t("viewProduct", { name: it.name })}
              className="relative flex h-[72px] w-[72px] flex-none items-center justify-center overflow-hidden rounded-[16px]"
              style={{ background: it.bg ?? "#E9E2D3" }}
            >
              <span aria-hidden="true" className="font-display px-1 text-center text-[11px] font-semibold tracking-[-0.03em] opacity-75">
                {it.keyword}
              </span>
              {it.imageUrl ? (
                <span aria-hidden="true" className="absolute inset-0 block" style={{ background: `${cssUrl(it.imageUrl)} center/cover no-repeat` }} />
              ) : null}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Link href={`/produit/${it.slug}`} className="text-ink! hover:text-ink! text-[15px] leading-[1.3] font-medium no-underline">
                {it.name}
              </Link>
              <span className="text-muted text-[13px]">{t("each", { price: fmtXof(it.price) })}</span>
            </div>
            <div className="flex flex-none flex-col items-end gap-0.5">
              <strong className="text-[15px]">{fmtXof(it.price * it.qty)}</strong>
              {it.qty > 1 ? <span className="text-muted text-[13px]">× {it.qty}</span> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
