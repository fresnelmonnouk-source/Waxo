"use client";

import { useSyncExternalStore } from "react";
import type { AssistantAction, CardProduct } from "@/lib/assistant/types";
import { cartDrawer } from "@/lib/ui/cart-drawer";

/**
 * État du widget « Assistant » (module partagé : le bouton flottant, la fenêtre et tous les boutons « Demander à l'assistant »
 * du site parlent au même store). Les messages vivent en mémoire de l'onglet : rien n'est stocké ni envoyé hors des
 * 10 derniers tours transmis à /api/assistant.
 */
export type ChatMsg =
  | { id: number; role: "u"; text: string }
  | { id: number; role: "a"; text: string; products: CardProduct[]; sources: string[]; actions: AssistantAction[] }
  | { id: number; role: "err"; code: "network" | "rate" };

type State = {
  open: boolean;
  busy: boolean;
  msgs: ChatMsg[];
  nudge: boolean;
  nudgeDismissed: boolean;
  /** Barre d'achat collante mobile visible (fiche produit) : le bouton flottant se décale au-dessus. */
  stickyBuy: boolean;
  lang: "fr" | "en";
  productSlug: string | null;
};

let state: State = { open: false, busy: false, msgs: [], nudge: false, nudgeDismissed: false, stickyBuy: false, lang: "fr", productSlug: null };
let seq = 0;
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

const MAX_TURNS = 10;
const MAX_CHARS = 500;

function isAction(a: unknown): a is AssistantAction {
  if (!a || typeof a !== "object") return false;
  const o = a as Record<string, unknown>;
  const href = o.href;
  return (
    (o.kind === "page" || o.kind === "whatsapp") &&
    typeof o.label === "string" &&
    typeof href === "string" &&
    ((o.kind === "page" && href.startsWith("/") && !href.startsWith("//")) || (o.kind === "whatsapp" && href.startsWith("https://wa.me/")))
  );
}

function isCard(p: unknown): p is CardProduct {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.slug === "string" && typeof o.name === "string" && typeof o.price === "number" && typeof o.stock === "number";
}

async function send(raw: string): Promise<void> {
  const text = raw.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
  if (!text || state.busy) return;
  const userMsg: ChatMsg = { id: ++seq, role: "u", text };
  // Les messages d'erreur locaux ne sont pas envoyés au serveur.
  const msgs = [...state.msgs, userMsg];
  set({ msgs, busy: true, open: true, nudge: false, nudgeDismissed: true });

  const turns = msgs
    .filter((m): m is Extract<ChatMsg, { role: "u" | "a" }> => m.role !== "err")
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role === "u" ? ("user" as const) : ("assistant" as const), text: m.text.slice(0, MAX_CHARS) }));
  while (turns.length && turns[0].role !== "user") turns.shift();

  try {
    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang: state.lang, messages: turns, ...(state.productSlug ? { page: { product: state.productSlug } } : {}) }),
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 429) throw new Error("rate");
    const data: unknown = await res.json().catch(() => null);
    const d = data as { ok?: unknown; text?: unknown; products?: unknown; sources?: unknown; actions?: unknown } | null;
    if (!res.ok || !d || d.ok !== true || typeof d.text !== "string") throw new Error("network");
    const reply: ChatMsg = {
      id: ++seq,
      role: "a",
      text: d.text,
      products: Array.isArray(d.products) ? d.products.filter(isCard).slice(0, 3) : [],
      sources: Array.isArray(d.sources) ? d.sources.filter((s): s is string => typeof s === "string").slice(0, 2) : [],
      actions: Array.isArray(d.actions) ? d.actions.filter(isAction).slice(0, 3) : [],
    };
    set({ busy: false, msgs: [...state.msgs, reply] });
  } catch (e) {
    const code = e instanceof Error && e.message === "rate" ? "rate" : "network";
    set({ busy: false, msgs: [...state.msgs, { id: ++seq, role: "err", code }] });
  }
}

let nudgeTimer: ReturnType<typeof setTimeout> | undefined;

export const assistant = {
  open() {
    cartDrawer.close();
    set({ open: true, nudge: false, nudgeDismissed: true });
  },
  close() {
    set({ open: false });
  },
  /** Ouvre la fenêtre puis envoie `text` (vide = ouvre seulement). */
  ask(text?: string) {
    assistant.open();
    if (text && text.trim()) void send(text);
  },
  send,
  dismissNudge() {
    set({ nudge: false, nudgeDismissed: true });
  },
  /** Affiche la bulle d'invitation après `ms`, une seule fois (désactivée par défaut, comme la maquette). */
  scheduleNudge(ms = 9000) {
    clearTimeout(nudgeTimer);
    nudgeTimer = setTimeout(() => {
      if (!state.open && !state.nudgeDismissed) set({ nudge: true });
    }, ms);
    return () => clearTimeout(nudgeTimer);
  },
  setContext(ctx: { lang: "fr" | "en"; productSlug: string | null }) {
    if (ctx.lang !== state.lang) set({ ...ctx, msgs: [] }); // changement de langue : nouvelle conversation
    else if (ctx.productSlug !== state.productSlug) set(ctx);
  },
  setStickyBuy(v: boolean) {
    if (v !== state.stickyBuy) set({ stickyBuy: v });
  },
};

export function useAssistant(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => state,
    () => state,
  );
}
