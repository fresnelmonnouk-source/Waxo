"use client";

import { useSyncExternalStore } from "react";

/**
 * Petit message éphémère en bas d'écran (maquette : « {produit} ajouté au panier » + bouton « Voir le panier »).
 * Le store ne garde qu'un type de message et ses paramètres : la traduction est faite par <ShopToast />.
 * Utilisable par les autres pages : `shopToast.show({ kind: "added", name })`.
 * Durée 5 s par défaut, en pause tant que le message est survolé ou contient le focus (audit Mia 4.11 : le bouton
 * « Voir le panier » disparaissait en 3 s, trop vite pour le clavier et les lecteurs d'écran ; WCAG 2.2.1).
 */
export type ToastMessage =
  | { kind: "added"; name: string }
  | { kind: "soldOut" }
  | { kind: "maxStock"; n: number }
  | { kind: "staleRemoved" };

let current: (ToastMessage & { id: number }) | null = null;
let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
/** Échéance du message courant (ms) et temps restant mémorisé pendant une pause. */
let deadline = 0;
let remaining: number | null = null;
/** Temps minimal laissé après une pause, pour lire le message une fois la souris ou le focus partis. */
const RESUME_MIN_MS = 2000;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const shopToast = {
  show(message: ToastMessage, ms = 5000) {
    clearTimeout(timer);
    remaining = null;
    current = { ...message, id: ++seq };
    emit();
    deadline = Date.now() + ms;
    timer = setTimeout(() => shopToast.hide(), ms);
  },
  /** Survol ou focus : le message reste affiché. */
  pause() {
    if (current === null || remaining !== null) return;
    clearTimeout(timer);
    remaining = Math.max(RESUME_MIN_MS, deadline - Date.now());
  },
  /** Fin du survol / du focus : le compte à rebours reprend (au moins 2 s). */
  resume() {
    if (current === null || remaining === null) return;
    const ms = remaining;
    remaining = null;
    deadline = Date.now() + ms;
    timer = setTimeout(() => shopToast.hide(), ms);
  },
  hide() {
    clearTimeout(timer);
    remaining = null;
    if (current !== null) {
      current = null;
      emit();
    }
  },
};

export function useToast(): (ToastMessage & { id: number }) | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => current,
    () => null,
  );
}
