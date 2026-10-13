"use client";

import type { ReactNode } from "react";

/**
 * Note moyenne cliquable sous le titre : fait défiler jusqu'aux avis (maquette : `scrollToReviews`).
 * Le décalage sous l'en-tête collant vient de `scroll-padding-top` (globals.css, 140 px en mobile : l'ancien 110 px codé en dur
 * était trop court), puis le focus passe au titre « Avis clients » pour que le clavier et les lecteurs d'écran suivent (audit Mia 4.4).
 */
export function RatingLink({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => {
        const el = document.getElementById("avis");
        if (!el) return;
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        document.getElementById("avis-titre")?.focus({ preventScroll: true });
      }}
      className="flex cursor-pointer items-center gap-2 self-start border-0 bg-transparent py-1 text-[14px] text-text"
    >
      {children}
    </button>
  );
}
