"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AccountMenu } from "@/components/account/AccountMenu";
import { HeaderAssistantButton } from "@/components/assistant/entries";
import { Link, usePathname } from "@/i18n/navigation";
import { useCartCount } from "@/lib/cart/store";
import { useFavoritesCount } from "@/lib/favorites/store";
import { cartDrawer } from "@/lib/ui/cart-drawer";
import { HeaderSearch } from "./HeaderSearch";
import type { SearchEntry, ShellCategory } from "./logic";
import { MegaMenu } from "./MegaMenu";
import { MobileNav } from "./MobileNav";

const NAV_LINK = "text-ink! hover:text-terracotta-deep! flex items-center px-3 no-underline";

/**
 * En-tête collant (maquette lignes 35-145) : logo, recherche, compte, favoris, panier, navigation principale,
 * panneau « Catalogue » et tiroir mobile. Seuil large/étroit de la maquette : 980 px.
 * Bouton « Assistant » (large seulement) : ouvre le widget de l'assistant (J3).
 */
export function Header({
  categories,
  searchIndex,
  total,
  packsEnabled = true,
}: {
  categories: ShellCategory[];
  searchIndex: SearchEntry[];
  total: number;
  packsEnabled?: boolean;
}) {
  const t = useTranslations("Shell");
  const tp = useTranslations("Packs");
  const pathname = usePathname();
  const cartCount = useCartCount();
  const favCount = useFavoritesCount();
  // Ouvert « pour la page où il a été ouvert » : se referme tout seul à la navigation, sans effet.
  const [mobileAt, setMobileAt] = useState<string | null>(null);
  const [megaAt, setMegaAt] = useState<string | null>(null);
  const mobileOpen = mobileAt === pathname;
  const megaOpen = megaAt === pathname;
  const closeAll = () => {
    setMobileAt(null);
    setMegaAt(null);
  };

  useEffect(() => {
    if (!mobileOpen && !megaOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileAt(null);
        setMegaAt(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, megaOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const underline = (active: boolean) => (active ? "border-b-2 border-ink" : "border-b-2 border-transparent");
  const onHome = pathname === "/";
  const onCatalog = pathname === "/catalogue" || pathname.startsWith("/produit");

  return (
    <>
      <header className="border-border sticky top-0 z-30 border-b bg-[rgba(244,241,234,0.95)] backdrop-blur-[10px]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-[18px] gap-y-3 px-5 py-3">
          <button
            type="button"
            onClick={() => setMobileAt(pathname)}
            aria-label={t("openMenu")}
            aria-haspopup="dialog"
            className="border-border-strong flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-full border bg-transparent min-[980px]:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#141210" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <Link href="/" aria-label={t("homeAria")} className="text-ink! hover:text-ink! flex flex-none items-baseline gap-3 no-underline">
            <span className="font-display text-[25px] leading-none font-bold tracking-[-0.03em] whitespace-nowrap">
              Wá x<span className="text-terracotta">ɔ</span>
            </span>
            <span className="text-muted text-[13px] whitespace-nowrap max-[979px]:hidden">{t("tagline")}</span>
          </Link>
          <HeaderSearch entries={searchIndex} />
          <div className="ml-auto flex flex-none items-center gap-2">
            <AccountMenu />
            <Link
              href="/favoris"
              aria-label={favCount ? `${t("favorites")} (${favCount})` : t("favorites")}
              className="text-ink! hover:text-ink! border-border-strong relative flex h-11 w-11 items-center justify-center rounded-full border bg-transparent no-underline hover:bg-white"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#141210" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 21s-7-4.4-9.3-8.7C.8 8.7 2.5 4.5 6.5 4.5c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3 4 0 5.7 4.2 3.8 7.8C19 16.6 12 21 12 21z" />
              </svg>
              {favCount ? (
                <span className="bg-sun text-ink absolute -top-1 -right-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold">
                  {favCount}
                </span>
              ) : null}
            </Link>
            <HeaderAssistantButton onBefore={closeAll} />
            <button
              type="button"
              onClick={() => {
                closeAll();
                cartDrawer.open();
              }}
              aria-label={t("openCart")}
              className="bg-ink text-cream flex h-11 cursor-pointer items-center gap-[10px] rounded-full border-0 px-[14px] text-[14px] font-semibold hover:bg-[#2C2823]"
            >
              <span className="max-[979px]:hidden">{t("cart")}</span>
              <span className="bg-sun text-ink inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-[6px] text-[12px]">
                {cartCount}
              </span>
            </button>
          </div>
        </div>
        <nav aria-label={t("nav.label")} className="mx-auto h-11 max-w-[1280px] items-stretch gap-1 px-5 text-[15px] max-[979px]:hidden min-[980px]:flex">
          <Link href="/" className={`${NAV_LINK} ${underline(onHome)} pr-3 pl-0 font-semibold`}>
            {t("nav.home")}
          </Link>
          <button
            type="button"
            onClick={() => setMegaAt(megaOpen ? null : pathname)}
            aria-expanded={megaOpen}
            className={`flex cursor-pointer items-center gap-[6px] bg-transparent px-3 text-[15px] font-semibold ${underline(onCatalog)} border-x-0 border-t-0`}
          >
            {t("nav.catalog")}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#141210"
              strokeWidth="2.5"
              aria-hidden="true"
              style={{ transform: megaOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {packsEnabled ? (
            <Link href="/packs" className={`${NAV_LINK} ${underline(pathname.startsWith("/packs"))}`}>
              {tp("navLabel")}
            </Link>
          ) : null}
          <Link href="/catalogue?col=nouveautes" className={NAV_LINK}>
            {t("nav.new")}
          </Link>
          <Link href="/catalogue?col=ventes" className={NAV_LINK}>
            {t("nav.best")}
          </Link>
          <Link href="/catalogue?col=promos" className={NAV_LINK}>
            {t("nav.promos")}
          </Link>
          <Link href="/a-propos" className={`${NAV_LINK} ${underline(pathname === "/a-propos")}`}>
            {t("nav.about")}
          </Link>
          <Link href="/contact" className={`${NAV_LINK} ${underline(pathname === "/contact")}`}>
            {t("nav.contact")}
          </Link>
          <span className="flex-1" />
          <Link href="/suivi" className="text-text! hover:text-terracotta-deep! flex items-center gap-[6px] pl-3 text-[14px] no-underline">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" />
              <circle cx="7" cy="17.5" r="1.8" />
              <circle cx="17" cy="17.5" r="1.8" />
            </svg>
            {t("nav.track")}
          </Link>
        </nav>
        {megaOpen ? <MegaMenu categories={categories} total={total} onNavigate={closeAll} packsEnabled={packsEnabled} /> : null}
      </header>
      {megaOpen ? <div onClick={closeAll} aria-hidden="true" className="fixed inset-0 z-25 bg-[rgba(20,18,16,0.25)] max-[979px]:hidden" /> : null}
      {mobileOpen ? <MobileNav categories={categories} onClose={closeAll} packsEnabled={packsEnabled} /> : null}
    </>
  );
}
