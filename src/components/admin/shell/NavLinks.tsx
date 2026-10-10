"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavEntry = { id: string; label: string; href: string; badge: number; gapBefore: boolean };

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Navigation du back-office : barre latérale (≥ 900 px) ou pilules défilantes (mobile). Page courante = aria-current. */
export function NavLinks({ items, variant }: { items: NavEntry[]; variant: "side" | "top" }) {
  const pathname = usePathname() ?? "";
  if (variant === "side") {
    return (
      <nav aria-label="Back office" className="flex flex-col gap-0.5">
        {items.map((n) => {
          const on = isActive(pathname, n.href);
          return (
            <Link
              key={n.id}
              href={n.href}
              aria-current={on ? "page" : undefined}
              className={`flex min-h-[42px] items-center justify-between gap-2 rounded-xl px-3 text-left text-sm font-medium no-underline outline-offset-2 focus-visible:outline-[#FFC93C] hover:bg-[#2C2823] ${n.gapBefore ? "mt-2" : ""} ${
                on ? "bg-[#2C2823] text-[#FFC93C] hover:text-[#FFC93C]" : "bg-transparent text-[#F4F1EA] hover:text-[#F4F1EA]"
              }`}
            >
              {n.label}
              {n.badge > 0 && (
                <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#FFC93C] px-[7px] text-xs font-bold text-[#141210]">
                  <span className="sr-only">À traiter : </span>
                  {n.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    );
  }
  return (
    <nav aria-label="Back office" className="flex gap-1.5 overflow-x-auto border-b border-[#E2DCCF] px-4 py-2.5">
      {items.map((n) => {
        const on = isActive(pathname, n.href);
        return (
          <Link
            key={n.id}
            href={n.href}
            aria-current={on ? "page" : undefined}
            className={`flex min-h-10 flex-none items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium no-underline ${
              on ? "border-[#141210] bg-[#141210] text-[#F4F1EA] hover:text-[#F4F1EA]" : "border-[#E2DCCF] bg-white text-[#141210] hover:text-[#141210]"
            }`}
          >
            {n.label}
            {n.badge > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FFC93C] px-1.5 text-[11px] font-bold text-[#141210]">
                <span className="sr-only">À traiter : </span>
                {n.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
