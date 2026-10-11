"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { countdownParts } from "@/lib/campaigns/logic";
import { pad2, type BannerCampaign } from "./campaign-logic";

// ── Horloge partagée : une seule minuterie pour tous les comptes à rebours de la page ──
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | null = null;
function subscribeClock(cb: () => void) {
  clockListeners.add(cb);
  if (!clockTimer)
    clockTimer = setInterval(() => clockListeners.forEach((l) => l()), 1000);
  return () => {
    clockListeners.delete(cb);
    if (!clockListeners.size && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}
const clockSnapshot = () => Math.floor(Date.now() / 1000) * 1000;
const serverClock = () => null;

/** Heure courante (à la seconde) côté navigateur ; `null` au rendu serveur et pendant l'hydratation (aucun écart). */
export function useNow(): number | null {
  return useSyncExternalStore(subscribeClock, clockSnapshot, serverClock);
}

function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
/** Mouvement réduit : le compte à rebours n'affiche plus les secondes (pas de chiffre qui défile en continu). */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/**
 * Compte à rebours « j h min s » jusqu'à `target`. Rendu seulement après montage ; rien une fois le temps écoulé.
 * `aria-live="off"` : les lecteurs d'écran ne l'annoncent pas chaque seconde.
 */
export function CampaignCountdown({
  target,
  label,
  tone = "dark",
  size = "sm",
}: {
  target: string;
  label: string;
  tone?: "dark" | "light";
  size?: "sm" | "lg";
}) {
  const t = useTranslations("Campaign");
  const now = useNow();
  const reduced = useReducedMotion();
  const parts = now === null ? null : countdownParts(target, now);
  if (!parts) return null;
  const units: { v: string; u: string }[] = [
    ...(parts.days > 0 ? [{ v: String(parts.days), u: t("unitDays") }] : []),
    { v: pad2(parts.hours), u: t("unitHours") },
    { v: pad2(parts.minutes), u: t("unitMinutes") },
    ...(reduced ? [] : [{ v: pad2(parts.seconds), u: t("unitSeconds") }]),
  ];
  const big = size === "lg";
  return (
    <span
      role="timer"
      aria-live="off"
      className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-1"
    >
      <span
        className={`${tone === "dark" ? "text-cream/80" : "text-muted"} ${big ? "text-[15px]" : "text-[13px]"}`}
      >
        {label}
      </span>
      <span className="inline-flex flex-wrap items-baseline gap-x-[6px] tabular-nums">
        {units.map(({ v, u }) => (
          <span key={u} className="whitespace-nowrap">
            <strong
              className={`font-display font-semibold tracking-[-0.02em] ${tone === "dark" ? "text-sun" : "text-terracotta-deep"} ${
                big ? "text-[clamp(26px,4vw,40px)]" : "text-[15px]"
              }`}
            >
              {v}
            </strong>
            <span
              className={`${tone === "dark" ? "text-cream/80" : "text-text"} ${big ? "text-[15px]" : "text-[12px]"}`}
            >
              {" "}
              {u}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * Bande de campagne au-dessus de l'en-tête : nom, accroche, compte à rebours et lien vers la page de la campagne.
 * Disparaît d'elle-même une fois la campagne terminée (la page reste en cache ISR jusqu'à 2 min).
 */
export function CampaignBanner({ campaign }: { campaign: BannerCampaign }) {
  const t = useTranslations("Campaign");
  const now = useNow();
  if (now !== null && !countdownParts(campaign.endsAt, now)) return null;
  return (
    <aside
      aria-label={t("bannerLabel", { name: campaign.name })}
      className="bg-ink text-cream border-cream/15 border-b"
    >
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 min-[480px]:px-5">
        <p className="m-0 flex min-w-0 flex-[1_1_240px] flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <strong className="font-display text-sun text-[15px] font-semibold tracking-[-0.02em] break-words">
            {campaign.name}
          </strong>
          {campaign.tagline ? (
            <span className="text-cream/85 min-w-0 text-[14px] leading-[1.4] break-words">
              {campaign.tagline}
            </span>
          ) : null}
        </p>
        {campaign.showCountdown ? (
          <CampaignCountdown target={campaign.endsAt} label={t("endsIn")} />
        ) : null}
        <Link
          href={`/campagne/${encodeURIComponent(campaign.slug)}`}
          className="bg-sun text-ink! hover:text-ink! hover:bg-sun-hover focus-visible:outline-sun inline-flex h-11 flex-none items-center rounded-full px-5 text-[14px] font-semibold whitespace-nowrap no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {t("cta")}
        </Link>
      </div>
    </aside>
  );
}
