"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type PageMeta = { href: string; title: string; sub: string };

/** Lien de création d'un produit : ouvre le tiroir de ProductsView (paramètre lu puis retiré à la fermeture). */
export const NEW_PRODUCT_HREF = "/admin/produits?nouveau=1";

/** Bouton d'action de l'en-tête de page (maquette : fond encre, 46 px, pilule). */
const HEAD_ACTION =
  "inline-flex min-h-[46px] items-center rounded-full bg-[#141210] px-5 font-semibold text-[#F4F1EA] no-underline hover:bg-[#2C2823] hover:text-[#F4F1EA]";

/**
 * En-tête de page de la coque (maquette lignes 76-81) : titre Unbounded + sous-titre, déduits de l'URL.
 * Action principale à droite du titre, comme dans la maquette (lignes 77-79) : « + Ajouter un produit » (lien partageable
 * `?nouveau=1`, ProductsView ouvre le tiroir), « Exporter les écritures » (carnet), « Exporter en CSV » (newsletter).
 * Les autres actions restent dans le corps des pages.
 */
export function PageHeading({ pages }: { pages: PageMeta[] }) {
  const pathname = usePathname() ?? "";
  const meta = pages
    .filter((p) => (p.href === "/admin" ? pathname === "/admin" : pathname === p.href || pathname.startsWith(`${p.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (!meta) return null;
  const isLedger = meta.href === "/admin/carnet" && pathname === "/admin/carnet";
  const isProducts = pathname === "/admin/produits";
  const isNewsletter = pathname === "/admin/newsletter";
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-display text-[clamp(24px,3vw,32px)] font-semibold tracking-[-0.03em]">{meta.title}</h1>
        <p className="m-0 text-sm text-[#4A443C]">{meta.sub}</p>
      </div>
      {isLedger && (
        <a href="/admin/carnet/export" download className={HEAD_ACTION}>
          Exporter les écritures
        </a>
      )}
      {isProducts && (
        <Link href={NEW_PRODUCT_HREF} scroll={false} className={HEAD_ACTION}>
          + Ajouter un produit
        </Link>
      )}
      {isNewsletter && (
        <a href="/admin/newsletter/export" download className={HEAD_ACTION}>
          Exporter en CSV
        </a>
      )}
    </div>
  );
}
