"use client";

import type { ReactNode } from "react";

/** Note moyenne cliquable sous le titre : fait défiler jusqu'aux avis (maquette : `scrollToReviews`, décalage 110 px). */
export function RatingLink({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => {
        const el = document.getElementById("avis");
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 110, behavior: "smooth" });
      }}
      className="flex cursor-pointer items-center gap-2 self-start border-0 bg-transparent py-1 text-[14px] text-text"
    >
      {children}
    </button>
  );
}
