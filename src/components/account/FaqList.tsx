"use client";

import { useId, useState, type ReactNode } from "react";

export type FaqItem = { id: string; question: string; answer: ReactNode };

/** Accordéon FAQ (maquette 609-618) : une réponse ouverte à la fois, la première par défaut. */
export function FaqList({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState(0);
  const base = useId();
  return (
    <div className="border-t border-border">
      {items.map((it, i) => {
        const on = open === i;
        return (
          <div key={it.id} className="border-b border-border">
            <h2 className="m-0">
              <button
                type="button"
                onClick={() => setOpen(on ? -1 : i)}
                aria-expanded={on}
                aria-controls={`${base}-${i}`}
                className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-4 border-0 bg-transparent py-5 text-left text-[17px] font-semibold"
              >
                {it.question}
                <span aria-hidden="true" className={`text-[24px] leading-none font-normal transition-transform duration-200 ${on ? "rotate-45" : ""}`}>
                  +
                </span>
              </button>
            </h2>
            {on ? (
              <p id={`${base}-${i}`} className="m-0 mb-5 leading-[1.6] text-text">
                {it.answer}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
