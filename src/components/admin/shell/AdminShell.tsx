import type { ReactNode } from "react";
import type { AdminUser } from "@/lib/admin/guard";
import type { ShellCounts } from "@/lib/admin/data/dashboard";
import { fmtDate, nowMs } from "@/lib/stats/time";
import { buildNavEntries, buildPageMeta } from "./meta";
import { LogoutButton } from "./LogoutButton";
import { NavLinks } from "./NavLinks";
import { PageHeading } from "./PageHeading";

function Logo({ size, accent }: { size: number; accent: string }) {
  return (
    <span className="font-display font-bold tracking-[-0.03em]" style={{ fontSize: size }}>
      Wá x<span style={{ color: accent }}>ɔ</span>
    </span>
  );
}

/**
 * Coque du back-office (maquette lignes 46-82) : barre latérale 236 px sticky (≥ 900 px), barre haute + pilules (mobile),
 * puis corps de page `max-w-[1200px]` avec titre. Les pages se rendent dans `children`.
 */
export function AdminShell({ admin, counts, children }: { admin: AdminUser; counts: ShellCounts; children: ReactNode }) {
  const entries = buildNavEntries(counts);
  const pages = buildPageMeta(counts, fmtDate(nowMs(), { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  const name = admin.email || "Administrateur";
  const initials = (name.split("@")[0] ?? "A").replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "A";
  return (
    <div className="flex min-h-screen bg-cream">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-[#141210] focus:px-4 focus:py-2 focus:text-[#F4F1EA]"
      >
        Aller au contenu
      </a>
      <aside className="sticky top-0 hidden h-screen w-[236px] flex-none flex-col gap-[18px] overflow-y-auto bg-[#141210] px-3.5 pb-4 pt-[22px] text-[#F4F1EA] min-[900px]:flex">
        <div className="flex flex-col gap-1 px-2">
          <Logo size={24} accent="#FFC93C" />
          <span className="text-xs font-semibold uppercase tracking-[.08em] text-[#B9B1A4]">Back office</span>
        </div>
        <NavLinks items={entries} variant="side" />
        <div className="flex-1" />
        <div className="flex flex-col gap-2">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-sm text-[#F4F1EA] no-underline outline-offset-2 hover:text-[#FFC93C] focus-visible:outline-[#FFC93C]"
          >
            Voir la boutique ↗
          </a>
          <div className="mt-1 flex items-center gap-2.5 border-t border-[#2C2823] px-1.5 pt-3">
            <span className="flex size-[34px] flex-none items-center justify-center rounded-full bg-[#FFC93C] text-[13px] font-bold text-[#141210]" aria-hidden="true">
              {initials}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm" title={name}>
                {name}
              </span>
              <LogoutButton className="cursor-pointer border-0 bg-transparent p-0 text-left text-[13px] text-[#B9B1A4] underline underline-offset-[3px] outline-offset-2 hover:text-[#F4F1EA] focus-visible:outline-[#FFC93C]">
                Se déconnecter
              </LogoutButton>
            </div>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-[900px]:hidden">
          <div className="sticky top-0 z-[5] flex items-center justify-between gap-3 bg-[#141210] px-4 py-3 text-[#F4F1EA]">
            <span>
              <Logo size={20} accent="#FFC93C" />{" "}
              <span className="text-xs font-semibold uppercase tracking-[.08em] text-[#B9B1A4]">Admin</span>
            </span>
            <div className="flex items-center gap-3.5 text-[13px]">
              <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-[#F4F1EA] outline-offset-2 hover:text-[#FFC93C] focus-visible:outline-[#FFC93C]">
                Boutique ↗
              </a>
              <LogoutButton className="inline-flex min-h-11 cursor-pointer items-center border-0 bg-transparent p-0 text-[13px] text-[#F4F1EA] underline underline-offset-[3px] outline-offset-2 focus-visible:outline-[#FFC93C]">
                Déconnexion
              </LogoutButton>
            </div>
          </div>
          <NavLinks items={entries} variant="top" />
        </div>
        <main id="contenu" tabIndex={-1} className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-6 pb-16 pt-7 outline-none">
          <PageHeading pages={pages} />
          {children}
        </main>
      </div>
    </div>
  );
}
