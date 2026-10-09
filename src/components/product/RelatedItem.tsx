"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cart } from "@/lib/cart/store";
import { cartDrawer } from "@/lib/ui/cart-drawer";
import { fmtXof } from "@/lib/money";
import { cssImage } from "./media";

type Props = { id: string; slug: string; name: string; price: number; bg: string; imageUrl: string | null };

/** Ligne « Souvent pris avec » : vignette 64 px, nom, prix, bouton « + » 44 px. */
export function RelatedItem({ id, slug, name, price, bg, imageUrl }: Props) {
  const t = useTranslations("Product");
  const img = cssImage(imageUrl);
  return (
    <div className="flex items-center gap-3 rounded-[18px] bg-card p-2.5">
      <Link
        href={`/produit/${slug}`}
        aria-hidden="true"
        tabIndex={-1}
        className="relative h-16 w-16 flex-none overflow-hidden rounded-xl"
        style={{ background: bg }}
      >
        {img ? <span className="absolute inset-0 block h-full w-full" style={{ background: img }} /> : null}
      </Link>
      <Link
        href={`/produit/${slug}`}
        className="flex min-w-0 flex-1 flex-col gap-[3px] no-underline hover:text-ink"
      >
        <span className="text-[14px] leading-[1.25]">{name}</span>
        <strong className="text-[14px]">{fmtXof(price)}</strong>
      </Link>
      <button
        type="button"
        aria-label={t("addAria", { name })}
        onClick={() => {
          cart.add({ kind: "product", id, slug, name, price, bg, imageUrl });
          cartDrawer.open();
        }}
        className="h-11 w-11 flex-none cursor-pointer rounded-full border border-border-strong bg-transparent text-[18px] hover:border-sun hover:bg-sun"
      >
        +
      </button>
    </div>
  );
}
