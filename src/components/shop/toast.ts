"use client";

import { useSyncExternalStore } from "react";

/**
 * Petit message éphémère en bas d'écran (maquette : « {produit} ajouté au panier » + bouton « Voir le panier »).
 * Le store ne garde qu'un type de message et ses paramètres : la traduction est faite par <ShopToast />.
 * Utilisable par les autres pages : `shopToast.show({ kind: "added", name })`.
 */
export type ToastMessage =
  | { kind: "added"; name: string }
  | { kind: "soldOut" }
  | { kind: "maxStock"; n: number };

let current: (ToastMessage & { id: number }) | null = null;
let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const shopToast = {
  show(message: ToastMessage, ms = 3000) {
    clearTimeout(timer);
    current = { ...message, id: ++seq };
    emit();
    timer = setTimeout(() => shopToast.hide(), ms);
  },
  hide() {
    clearTimeout(timer);
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
