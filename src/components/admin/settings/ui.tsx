"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

// Petites briques partagées par les écrans Avis / Messages / Newsletter / Réglages (styles de la maquette Waxo Admin).

export const cardCls = "bg-white rounded-[22px] p-5 flex flex-col";
export const labelCls = "flex flex-col gap-1.5 text-[14px] font-medium";
export const fieldCls =
  "border bg-[#FAF8F3] rounded-[12px] px-3 py-[11px] text-[15px] font-normal min-w-0 w-full min-h-[44px]";
export const fieldSmCls = "border border-[#E2DCCF] bg-white rounded-[12px] px-3 py-2.5 text-[14px] font-normal min-w-0 w-full";
export const errCls = "text-[#C2410C] text-[12px] font-normal";
export const btnDark =
  "inline-flex items-center justify-center border-0 bg-ink text-cream rounded-full font-semibold cursor-pointer no-underline hover:bg-[#2C2823] hover:text-cream disabled:opacity-60 disabled:cursor-not-allowed";
export const btnLine =
  "inline-flex items-center justify-center border border-[#D6CFC0] bg-transparent rounded-full cursor-pointer hover:bg-cream disabled:opacity-60 disabled:cursor-not-allowed";
export const btnLink =
  "border-0 bg-transparent text-[#9A3412] cursor-pointer underline underline-offset-[3px] hover:text-[#9A3412] disabled:opacity-60 disabled:cursor-not-allowed";

export const borderOf = (error?: string) => (error ? "border-[#C2410C]" : "border-[#E2DCCF]");

/** Interrupteur accessible (maquette : piste 44×26, pastille 20, vert #1F6B4A quand actif). */
export function Switch({ on, onToggle, label, hint }: { on: boolean; onToggle: () => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex items-center justify-between gap-3 border-0 bg-transparent cursor-pointer text-[14px] min-h-[48px] w-full text-left p-0"
    >
      <span className="flex flex-col gap-0.5">
        {label}
        {hint ? <span className="text-[12px] text-text">{hint}</span> : null}
      </span>
      <span aria-hidden="true" className="w-11 h-[26px] flex-none rounded-full relative transition-colors duration-200" style={{ background: on ? "#1F6B4A" : "#C9C1B2" }}>
        <span className="absolute top-[3px] w-5 h-5 rounded-full bg-white transition-[left] duration-200" style={{ left: on ? 21 : 3 }} />
      </span>
    </button>
  );
}

/** Puce de filtre (maquette : pilule 40 px, active = fond encre). */
export function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-full px-3.5 min-h-[44px] text-[13px] font-medium cursor-pointer flex gap-1.5 items-center border"
      style={{ borderColor: active ? "#141210" : "#D6CFC0", background: active ? "#141210" : "transparent", color: active ? "#F4F1EA" : "#141210" }}
    >
      {label}
      <span className="opacity-65 text-[12px]">{count.toLocaleString("fr-FR")}</span>
    </button>
  );
}

/** Notification flottante (maquette : pilule encre en bas de page) + exécution d'actions serveur. */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string) => {
    setMessage(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 3500);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const node = message ? (
    <div
      role="status"
      className="fixed left-1/2 bottom-6 -translate-x-1/2 z-[70] bg-ink text-cream rounded-full px-5 py-3 text-[14px] max-w-[calc(100vw-32px)] text-center"
      style={{ animation: "wxup .2s ease both" }}
    >
      {message}
    </div>
  ) : null;
  return { show, node };
}

export function EmptyBox({ children }: { children: ReactNode }) {
  return <div className="border border-dashed border-[#D6CFC0] rounded-2xl p-6 text-text">{children}</div>;
}

/** Bandeau « Base non connectée (mode démo) » : les lectures viennent des données de démonstration. */
export function DemoBanner({ connected }: { connected: boolean }) {
  if (connected) return null;
  return (
    <div role="note" className="bg-[#FFF4D6] text-[#8A5A00] rounded-2xl px-4 py-3 text-[13px]">
      Base non connectée (mode démo) : les données affichées sont des exemples et les modifications ne sont pas enregistrées.
    </div>
  );
}
