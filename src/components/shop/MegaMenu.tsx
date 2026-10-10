"use client";

import { useTranslations } from "next-intl";
import { MegaAssistantBlock } from "@/components/assistant/entries";
import { Link } from "@/i18n/navigation";
import { COLLECTIONS, type ShellCategory } from "./logic";

/**
 * Panneau « Catalogue » de l'en-tête (maquette lignes 117-141) : rayons, collections, lien « tout le catalogue ».
 * Le bloc sombre « Vous ne savez pas quoi choisir ? » ouvre l'assistant (J3).
 */
export function MegaMenu({
  categories,
  total,
  onNavigate,
  packsEnabled = true,
}: {
  categories: ShellCategory[];
  total: number;
  onNavigate: () => void;
  packsEnabled?: boolean;
}) {
  const t = useTranslations();
  return (
    <div
      className="bg-cream border-border absolute top-full right-0 left-0 border-b shadow-[0_24px_40px_-24px_rgba(20,18,16,0.35)] max-[979px]:hidden"
      style={{ animation: "wxup .2s ease both" }}
    >
      <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-8 px-5 pt-6 pb-7">
        <div className="flex flex-col gap-3">
          <span className="text-muted text-[12px] font-semibold tracking-[0.08em] uppercase">{t("Shell.mega.categories")}</span>
          <div className="grid grid-cols-3 gap-[10px]">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/catalogue?cat=${encodeURIComponent(c.id)}`}
                onClick={onNavigate}
                className="text-ink! hover:text-ink! flex flex-col gap-[2px] rounded-[16px] px-4 py-[14px] no-underline transition-transform duration-150 hover:-translate-y-0.5"
                style={{ background: c.bg }}
              >
                <strong className="font-display text-[15px] font-semibold">{c.label}</strong>
                <span className="text-text text-[13px]">{t("Shell.productCount", { count: c.count })}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-muted mb-[6px] text-[12px] font-semibold tracking-[0.08em] uppercase">{t("Shell.mega.collections")}</span>
          {COLLECTIONS.map((col) => (
            <Link
              key={col}
              href={`/catalogue?col=${col}`}
              onClick={onNavigate}
              className="text-ink! border-border hover:text-terracotta-deep! border-b py-[10px] text-[15px] no-underline"
            >
              {t(`Catalog.col.${col}`)}
            </Link>
          ))}
          {packsEnabled ? (
            <Link href="/packs" onClick={onNavigate} className="text-ink! border-border hover:text-terracotta-deep! border-b py-[10px] text-[15px] no-underline">
              {t("Packs.navLabel")}
            </Link>
          ) : null}
          <Link href="/catalogue" onClick={onNavigate} className="pt-3 text-[15px] font-semibold">
            {t("Shell.mega.all", { count: total })}
          </Link>
        </div>
        <MegaAssistantBlock onNavigate={onNavigate} />
      </div>
    </div>
  );
}
