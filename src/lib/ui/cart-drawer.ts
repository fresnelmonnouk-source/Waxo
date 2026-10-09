"use client";

import { useSyncExternalStore } from "react";

/** État d'ouverture du tiroir panier (partagé : bouton de l'en-tête, boutons « Ajouter », tiroir lui-même). */
let open = false;
const listeners = new Set<() => void>();
const set = (v: boolean) => {
  open = v;
  listeners.forEach((l) => l());
};

export const cartDrawer = { open: () => set(true), close: () => set(false), toggle: () => set(!open) };

export function useCartDrawerOpen(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
    () => false,
  );
}
