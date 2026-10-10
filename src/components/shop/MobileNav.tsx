"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AssistantCta } from "@/components/assistant/entries";
import { Link } from "@/i18n/navigation";
import { LangSwitch } from "./LangSwitch";
import { COLLECTIONS, type ShellCategory } from "./logic";

const SECTION = "text-muted text-[12px] font-semibold tracking-[0.08em] uppercase";
const PLAIN = "text-ink! hover:text-ink! no-underline";

/** Tiroir de navigation mobile (maquette lignes 958-987), ouvert par le bouton ☰ sous 980 px. */
export function MobileNav({ categories, onClose, packsEnabled = true }: { categories: ShellCategory[]; onClose: () => void; packsEnabled?: boolean }) {
  const t = useTranslations();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [logged, setLogged] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
    const ctrl = new AbortController();
    fetch("/api/me", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { user?: unknown } | null) => setLogged(!!d?.user))
      .catch(() => setLogged(false));
    return () => ctrl.abort();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("Shell.mobile.menu")}
      className="fixed inset-0 z-[45] bg-[rgba(20,18,16,0.45)]"
      onClick={onClose}
    >
      <nav
        aria-label={t("Shell.mobile.menu")}
        onClick={(e) => e.stopPropagation()}
        className="bg-cream flex h-full w-[min(340px,88vw)] flex-col overflow-y-auto"
        style={{ animation: "wxup .2s ease both" }}
      >
        <div className="border-border flex items-center justify-between border-b px-5 py-4">
          <span className="font-display text-[22px] font-bold tracking-[-0.03em]">
            Wá x<span className="text-terracotta">ɔ</span>
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t("Shell.closeMenu")}
            className="h-11 w-11 cursor-pointer rounded-full border-0 bg-white text-[20px]"
          >
            ×
          </button>
        </div>
        <div className="flex flex-col gap-1 px-5 pt-3 pb-7">
          <Link href="/" onClick={onClose} className={`${PLAIN} py-3 text-[17px] font-semibold`}>
            {t("Shell.nav.home")}
          </Link>
          <Link href="/catalogue" onClick={onClose} className={`${PLAIN} py-3 text-[17px] font-semibold`}>
            {t("Shell.mobile.all")}
          </Link>
          <span className={`${SECTION} pt-[14px] pb-2`}>{t("Shell.mobile.categories")}</span>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/catalogue?cat=${encodeURIComponent(c.id)}`}
                onClick={onClose}
                className={`${PLAIN} min-h-11 rounded-[14px] px-[14px] py-3 text-[14px] font-semibold`}
                style={{ background: c.bg }}
              >
                {c.label}
              </Link>
            ))}
          </div>
          <span className={`${SECTION} pt-[18px] pb-1`}>{t("Shell.mobile.collections")}</span>
          {COLLECTIONS.map((col) => (
            <Link key={col} href={`/catalogue?col=${col}`} onClick={onClose} className={`${PLAIN} border-border border-b py-[11px] text-[15px]`}>
              {t(`Catalog.col.${col}`)}
            </Link>
          ))}
          {packsEnabled ? (
            <Link href="/packs" onClick={onClose} className={`${PLAIN} border-border border-b py-[11px] text-[15px]`}>
              {t("Packs.navLabel")}
            </Link>
          ) : null}
          <span className={`${SECTION} pt-[18px] pb-1`}>{t("Shell.mobile.help")}</span>
          <Link href="/a-propos" onClick={onClose} className={`${PLAIN} py-[11px] text-[15px]`}>
            {t("Shell.nav.about")}
          </Link>
          <Link href="/contact" onClick={onClose} className={`${PLAIN} py-[11px] text-[15px]`}>
            {t("Shell.nav.contact")}
          </Link>
          <Link href="/faq" onClick={onClose} className={`${PLAIN} py-[11px] text-[15px]`}>
            {t("Shell.mobile.faq")}
          </Link>
          <Link href="/suivi" onClick={onClose} className={`${PLAIN} py-[11px] text-[15px]`}>
            {t("Shell.nav.track")}
          </Link>
          <div className="mt-[18px] flex flex-col gap-2">
            {logged ? (
              <Link
                href="/compte"
                onClick={onClose}
                className="bg-ink text-cream! hover:text-cream! rounded-full p-[14px] text-center font-semibold no-underline"
              >
                {t("Shell.mobile.account")}
              </Link>
            ) : (
              <>
                <Link
                  href="/connexion"
                  onClick={onClose}
                  className="bg-ink text-cream! hover:text-cream! flex h-12 items-center justify-center rounded-full font-semibold no-underline"
                >
                  {t("Shell.mobile.login")}
                </Link>
                <Link
                  href="/inscription"
                  onClick={onClose}
                  className="text-ink! hover:text-ink! border-ink flex h-12 items-center justify-center rounded-full border-[1.5px] bg-transparent font-semibold no-underline"
                >
                  {t("Shell.mobile.signup")}
                </Link>
              </>
            )}
            <AssistantCta onBefore={onClose} className="h-12" />
          </div>
          <div className="mt-3 self-start">
            <LangSwitch tone="light" />
          </div>
        </div>
      </nav>
    </div>
  );
}
