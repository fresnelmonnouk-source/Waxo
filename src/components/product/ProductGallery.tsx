"use client";

/* eslint-disable @next/next/no-img-element -- vrais <img> volontaires (audits Victor S6 / Tariq M4) : next/image passerait
   par l'optimiseur Vercel (/_next/image), facturé au quota du projet ; les photos sont déjà carrées, ≤ 1 200 px et en WebP. */
import { useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { imageSources } from "@/lib/media/product-images";

type Tag = { label: string; bg: string; color: string } | null;

/** Côté nominal des photos (recadrage carré, 1 200 px max) : `width/height` réservent le carré, donc CLS 0. */
const SIDE = 1200;
const MAIN_SIZES = "(max-width: 860px) calc(100vw - 40px), 560px";
const THUMB = 64;

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Galerie de la fiche produit (maquette : grand carré arrondi 28 px sur la couleur du produit, mot-clé en filigrane).
 * - 0 photo : rendu d'origine (fond coloré + mot-clé), aucune image.
 * - 1 photo : une seule <img> prioritaire.
 * - 2 à 8 : défilement horizontal à scroll-snap (glisser au doigt), flèches ← → / Début / Fin au clavier, miniatures
 *   cliquables sous l'image. Première image `fetchpriority="high"` sans lazy (LCP), les suivantes `loading="lazy"`.
 */
export function ProductGallery({
  images,
  name,
  bg,
  keyword,
  tag,
}: {
  images: readonly string[];
  name: string;
  bg: string;
  keyword: string;
  tag: Tag;
}) {
  const t = useTranslations("Product");
  const total = images.length;
  const [active, setActive] = useState(0);
  const [announce, setAnnounce] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  // Défilement lancé par une miniature ou le clavier : on ignore les positions intermédiaires jusqu'à la cible.
  const targetRef = useRef<number | null>(null);

  const alt = (i: number) => (total > 1 ? t("photoAlt", { name, n: i + 1, total }) : name);

  const go = (i: number, focusThumb = false) => {
    const next = Math.max(0, Math.min(total - 1, i));
    const el = trackRef.current;
    if (el) {
      targetRef.current = next;
      el.scrollTo({ left: next * el.clientWidth, behavior: reducedMotion() ? "auto" : "smooth" });
    }
    setActive(next);
    setAnnounce(true);
    if (focusThumb) thumbsRef.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>, focusThumb: boolean) => {
    const map: Record<string, number> = { ArrowLeft: active - 1, ArrowRight: active + 1, Home: 0, End: total - 1 };
    if (!(e.key in map)) return;
    e.preventDefault();
    go(map[e.key], focusThumb);
  };

  const onScroll = () => {
    const el = trackRef.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (targetRef.current !== null) {
      if (i === targetRef.current) targetRef.current = null;
      return;
    }
    if (i !== active && i >= 0 && i < total) {
      setActive(i);
      setAnnounce(true);
    }
  };

  const img = (src: string, i: number, className: string) => {
    const s = imageSources(src);
    return (
      <img
        key={src}
        src={s.src}
        srcSet={s.srcSet}
        sizes={s.srcSet ? MAIN_SIZES : undefined}
        alt={alt(i)}
        width={SIDE}
        height={SIDE}
        {...(i === 0 ? { fetchPriority: "high" as const } : { loading: "lazy" as const, decoding: "async" as const })}
        className={className}
        draggable={false}
      />
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[28px]" style={{ background: bg }}>
        <span aria-hidden="true" className="font-display text-[clamp(40px,5.5vw,68px)] font-semibold tracking-[-0.05em] opacity-75">
          {keyword}
        </span>
        {total === 1 ? img(images[0], 0, "absolute inset-0 h-full w-full object-cover") : null}
        {total > 1 ? (
          <div
            ref={trackRef}
            role="region"
            aria-label={t("galleryLabel", { name })}
            tabIndex={0}
            onScroll={onScroll}
            onPointerDown={() => {
              targetRef.current = null; // le doigt reprend la main
            }}
            onKeyDown={(e) => onKeyDown(e, false)}
            className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-[28px] [scrollbar-width:none] focus-visible:outline-3 focus-visible:-outline-offset-4 focus-visible:outline-ink [&::-webkit-scrollbar]:hidden"
          >
            {images.map((src, i) => img(src, i, "h-full w-full flex-none snap-center snap-always object-cover"))}
          </div>
        ) : null}
        {tag ? (
          <span
            className="pointer-events-none absolute top-[18px] left-[18px] rounded-full px-3 py-1.5 text-[13px] font-semibold"
            style={{ background: tag.bg, color: tag.color }}
          >
            {tag.label}
          </span>
        ) : null}
      </div>

      {total > 1 ? (
        <>
          <div ref={thumbsRef} role="group" aria-label={t("galleryThumbs")} className="flex gap-2 overflow-x-auto p-0.5" onKeyDown={(e) => onKeyDown(e, true)}>
            {images.map((src, i) => {
              const s = imageSources(src);
              const on = i === active;
              return (
                <button
                  key={src}
                  type="button"
                  aria-label={t("showPhoto", { n: i + 1, total })}
                  aria-current={on ? "true" : undefined}
                  tabIndex={on ? 0 : -1}
                  onClick={() => go(i)}
                  className="relative flex-none cursor-pointer overflow-hidden rounded-[14px] border-2 p-0 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  style={{ width: THUMB, height: THUMB, background: bg, borderColor: on ? "#141210" : "transparent" }}
                >
                  <img
                    src={s.src}
                    srcSet={s.srcSet}
                    sizes={s.srcSet ? `${THUMB}px` : undefined}
                    alt=""
                    width={THUMB}
                    height={THUMB}
                    loading="lazy"
                    decoding="async"
                    fetchPriority={i === 0 ? undefined : "low"}
                    className="h-full w-full object-cover"
                    style={{ opacity: on ? 1 : 0.72 }}
                    draggable={false}
                  />
                </button>
              );
            })}
          </div>
          <span className="sr-only" aria-live="polite">
            {announce ? t("photoPosition", { n: active + 1, total }) : ""}
          </span>
        </>
      ) : null}
    </div>
  );
}
