"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Produits consultés récemment (12 max, le plus récent en premier). Alimente « Notre sélection pour vous »
 * (maquette : `viewed`). Stocke uniquement des identifiants produit, dans le navigateur.
 */
const KEY = "waxo:viewed:v1";
const MAX = 12;
const EMPTY: string[] = [];

let cache: string[] | null = null;
const listeners = new Set<() => void>();

function read(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}
function snapshot(): string[] {
  if (cache === null) cache = read();
  return cache;
}
function write(ids: string[]) {
  cache = ids;
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* stockage bloqué : reste en mémoire */
  }
  listeners.forEach((l) => l());
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

export const viewed = {
  record(productId: string) {
    const ids = snapshot();
    if (ids[0] === productId) return;
    write([productId, ...ids.filter((x) => x !== productId)].slice(0, MAX));
  },
};

export function useViewedIds(): string[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

/** À monter dans la fiche produit : enregistre la visite (ne rend rien). */
export function useRecordView(productId: string) {
  useEffect(() => {
    viewed.record(productId);
  }, [productId]);
}
