"use client";

import { useSyncExternalStore } from "react";

/** Favoris côté navigateur (invités et connectés). La synchro avec la table `favorites` (comptes) est ajoutée côté compte. */
const KEY = "waxo:favorites:v1";
const EMPTY: string[] = [];

let cache: string[] | null = null;
const listeners = new Set<() => void>();

function read(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function write(ids: string[]) {
  cache = ids;
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* bloqué : reste en mémoire */
  }
  listeners.forEach((l) => l());
}
function snapshot(): string[] {
  if (cache === null) cache = read();
  return cache;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = read();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const favorites = {
  toggle(productId: string) {
    const ids = snapshot();
    write(ids.includes(productId) ? ids.filter((x) => x !== productId) : [...ids, productId]);
  },
  clear() {
    write([]);
  },
};

export function useFavoriteIds(): string[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
export function useIsFavorite(productId: string): boolean {
  return useFavoriteIds().includes(productId);
}
export function useFavoritesCount(): number {
  return useFavoriteIds().length;
}
