"use client";

import { usePathname } from "next/navigation";

export type PageMeta = { href: string; title: string; sub: string };

/**
 * En-tête de page de la coque (maquette lignes 76-81) : titre Unbounded + sous-titre, déduits de l'URL.
 * Le bouton d'export du carnet est l'unique action portée par la coque ; les autres pages placent leurs actions dans leur corps.
 */
export function PageHeading({ pages }: { pages: PageMeta[] }) {
  const pathname = usePathname() ?? "";
  const meta = pages
    .filter((p) => (p.href === "/admin" ? pathname === "/admin" : pathname === p.href || pathname.startsWith(`${p.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (!meta) return null;
  const isLedger = meta.href === "/admin/carnet" && pathname === "/admin/carnet";
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-display text-[clamp(24px,3vw,32px)] font-semibold tracking-[-0.03em]">{meta.title}</h1>
        <p className="m-0 text-sm text-[#4A443C]">{meta.sub}</p>
      </div>
      {isLedger && (
        <a
          href="/admin/carnet/export"
          download
          className="inline-flex min-h-[46px] items-center rounded-full bg-[#141210] px-5 font-semibold text-[#F4F1EA] no-underline hover:bg-[#2C2823] hover:text-[#F4F1EA]"
        >
          Exporter les écritures
        </a>
      )}
    </div>
  );
}
