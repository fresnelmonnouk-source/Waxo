"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "./cn";

// Primitives communes aux écrans produits et packs (tiroir, interrupteur, toast, bandeau de source).
// Styles repris de la maquette « Waxo Admin » (tiroir 621-671, toast 683-685).

export const FIELD_LABEL = "flex flex-col gap-1.5 text-sm font-medium";
export const FIELD_ERR = "text-xs font-normal text-[#C2410C]";

export const inputClass = (error?: string) =>
  cn(
    "w-full min-w-0 rounded-[12px] border bg-white p-3 text-[15px] font-normal",
    error ? "border-[#C2410C]" : "border-[#E2DCCF]",
  );

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Dialogue accessible : focus à l'ouverture, piège de tabulation, Échap, retour du focus à la fermeture. */
export function useDialogA11y<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const previous = document.activeElement as HTMLElement | null;
    const items = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    items()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      } else if (e.key === "Tab") {
        const list = items();
        if (!list.length) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    node.addEventListener("keydown", onKey);
    return () => {
      node.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, []);
  return ref;
}

/** Tiroir latéral (520 px) avec voile : ferme au clic sur le voile, sur ×, ou Échap. */
export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useDialogA11y<HTMLElement>(onClose);
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-40 flex justify-end"
      style={{ background: "rgba(20,18,16,.45)" }}
    >
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-[min(520px,100%)] flex-col overflow-y-auto bg-[#F4F1EA]"
        style={{ animation: "wxup .25s ease both" }}
      >
        <div className="sticky top-0 z-[2] flex items-center justify-between border-b border-[#E2DCCF] bg-[#F4F1EA] px-5 py-[18px]">
          <strong className="font-display text-[19px] font-semibold">{title}</strong>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="h-11 w-11 cursor-pointer rounded-full border-0 bg-white text-xl"
          >
            ×
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

/** Interrupteur « Visible en boutique » (maquette 653-655). */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 cursor-pointer items-center gap-2.5 self-start border-0 bg-transparent p-0 text-sm"
    >
      <span className="relative h-[26px] w-11 rounded-full transition-colors" style={{ background: checked ? "#1F6B4A" : "#D6CFC0" }}>
        <span
          className="absolute top-[3px] h-5 w-5 rounded-full bg-white transition-[left]"
          style={{ left: checked ? 21 : 3 }}
        />
      </span>
      {label}
    </button>
  );
}

/** Toast bas de page (maquette 683-685). */
export function useToast(): [ReactNode, (message: string) => void] {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMessage(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 3200);
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
      className="fixed bottom-6 left-1/2 z-[70] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-full bg-[#141210] px-5 py-3 text-sm text-[#F4F1EA]"
      style={{ animation: "wxup .2s ease both" }}
    >
      {message}
    </div>
  ) : null;
  return [node, show];
}

/** Bandeau d'état de la source de données. */
export function SourceNotice({ source, truncated, noun }: { source: "db" | "demo" | "error"; truncated: boolean; noun: string }) {
  if (source === "db" && !truncated) return null;
  if (source === "error") {
    return (
      <div role="alert" className="rounded-[14px] bg-[#F6E1DA] px-3.5 py-2.5 text-[13px] leading-[1.45] text-[#9A3412]">
        Les {noun} n&apos;ont pas pu être lus pour le moment. Rechargez la page dans un instant.
      </div>
    );
  }
  return (
    <div role="note" className="rounded-[14px] bg-[#FBEFC9] px-3.5 py-2.5 text-[13px] leading-[1.45] text-[#4A443C]">
      {source === "demo"
        ? `Base non connectée (mode démo) : les ${noun} affichés sont des exemples, les modifications sont désactivées.`
        : `Affichage limité aux 200 ${noun} les plus récents.`}
    </div>
  );
}
