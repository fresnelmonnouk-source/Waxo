"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { STATUS_META } from "@/lib/orders/status";
import type { DataSource, OrderStatus } from "@/lib/orders/types";

// Petits éléments d'interface partagés par les écrans commandes / livraisons / clients (styles de la maquette).

export const btnDark =
  "inline-flex min-h-10 items-center justify-center rounded-full border-0 bg-[#141210] px-4 text-[13px] font-semibold text-[#F4F1EA] no-underline cursor-pointer hover:bg-[#2C2823] hover:text-[#F4F1EA] disabled:cursor-not-allowed disabled:opacity-50";
export const btnLeaf =
  "inline-flex min-h-10 items-center justify-center rounded-full border-0 bg-[#1F6B4A] px-4 text-[13px] font-semibold text-white no-underline cursor-pointer hover:bg-[#185A3E] hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
export const btnLine =
  "inline-flex min-h-10 items-center justify-center rounded-full border border-[#D6CFC0] bg-transparent px-4 text-[13px] text-[#141210] no-underline cursor-pointer hover:bg-[#F4F1EA] hover:text-[#141210] disabled:cursor-not-allowed disabled:opacity-50";
export const btnDanger =
  "inline-flex min-h-10 items-center justify-center rounded-full border border-[#9A3412] bg-transparent px-4 text-[13px] font-semibold text-[#9A3412] cursor-pointer hover:bg-[#F6E1DA] disabled:cursor-not-allowed disabled:opacity-50";
export const btnLinkText =
  "cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium underline underline-offset-[3px] text-[#141210] hover:text-[#1F6B4A]";
export const selectLine =
  "min-h-10 min-w-0 cursor-pointer rounded-full border border-[#D6CFC0] bg-white px-3 text-[13px] text-[#141210]";
export const fieldInput =
  "min-h-[42px] min-w-0 rounded-xl border border-[#E2DCCF] bg-[#FAF8F3] px-3 py-2.5 text-sm text-[#141210]";

/** Pastille de statut (couleurs de admin.json). */
export function StatusPill({ status, className = "" }: { status: OrderStatus; className?: string }) {
  const m = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-semibold ${className}`}
      style={{ background: m.bg, color: m.color }}
    >
      {m.label}
    </span>
  );
}

/** Pastille de paiement des tournées : « À encaisser X F » (jaune) ou « Payée · moyen » (vert). */
export function PayPill({ due, label }: { due: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-[3px] text-xs font-semibold"
      style={{ background: due ? "#FFF4D6" : "#E5EFE7", color: due ? "#8A5A00" : "#1F6B4A" }}
    >
      {label}
    </span>
  );
}

/** Bandeau « démo » / « erreur de lecture » en tête de page. */
export function SourceNote({ source, error }: { source: DataSource; error: boolean }) {
  if (error) {
    return (
      <div role="alert" className="rounded-[14px] bg-[#F6E1DA] px-3.5 py-2.5 text-[13px] leading-[1.45] text-[#9A3412]">
        Les données n&apos;ont pas pu être lues pour le moment. Rechargez la page dans un instant.
      </div>
    );
  }
  if (source === "demo") {
    return (
      <div role="note" className="rounded-[14px] bg-[#FBEFC9] px-3.5 py-2.5 text-[13px] leading-[1.45] text-[#4A443C]">
        Base non connectée (mode démo) : les données affichées sont des exemples et les modifications sont désactivées.
      </div>
    );
  }
  return null;
}

export function EmptyBox({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-[#D6CFC0] p-6 text-[#4A443C]">{children}</div>;
}

/** Notification passagère (annoncée aux lecteurs d'écran). */
export function useToast() {
  const [msg, setMsg] = useState<{ text: string; warn: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const show = useCallback((text: string, warn = false) => {
    setMsg({ text, warn });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), warn ? 7000 : 4000);
  }, []);
  const node = (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex justify-center px-4"
    >
      {msg ? (
        <span
          className="pointer-events-auto max-w-[560px] rounded-2xl px-4 py-3 text-sm font-medium shadow-lg"
          style={{ background: msg.warn ? "#FFF4D6" : "#141210", color: msg.warn ? "#8A5A00" : "#F4F1EA" }}
        >
          {msg.text}
        </span>
      ) : null}
    </div>
  );
  return { show, node };
}

/** Résultat minimal d'une server action, pour afficher message / avertissement. */
export type ActionOutcome = { ok: boolean; message?: string; warning?: string };
export function toastFor(res: ActionOutcome, success: string, show: (t: string, warn?: boolean) => void) {
  if (!res.ok) return show(res.message ?? "Une erreur est survenue.", true);
  show(res.message ?? success);
  if (res.warning) show(`${res.message ?? success}. ${res.warning}`, true);
}
