"use client";

import { useSyncExternalStore } from "react";

/**
 * Panier côté navigateur (localStorage). Ne contient QUE des identifiants et un instantané d'affichage :
 * le serveur recalcule toujours prix, stock et frais à la commande (place_order).
 */
export type CartLine = {
  kind: "product" | "pack";
  id: string;
  qty: number;
  // Instantané d'affichage (jamais fiable côté serveur)
  slug: string;
  name: string;
  price: number;
  bg: string | null;
  imageUrl: string | null;
};

const KEY = "waxo:cart:v1";
const MAX_QTY = 99;
const EMPTY: CartLine[] = [];

let cache: CartLine[] | null = null;
const listeners = new Set<() => void>();

function read(): CartLine[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as CartLine[]) : [];
    return Array.isArray(parsed)
      ? parsed.filter((l) => l && typeof l.id === "string" && Number.isInteger(l.qty) && l.qty > 0)
      : [];
  } catch {
    return [];
  }
}

function write(lines: CartLine[]) {
  cache = lines;
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* stockage plein ou bloqué : le panier reste en mémoire pour la session */
  }
  listeners.forEach((l) => l());
}

function snapshot(): CartLine[] {
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

export const cart = {
  add(line: Omit<CartLine, "qty">, qty = 1) {
    const lines = snapshot();
    const i = lines.findIndex((l) => l.kind === line.kind && l.id === line.id);
    if (i >= 0) {
      const next = [...lines];
      next[i] = { ...next[i], ...line, qty: Math.min(MAX_QTY, Math.max(1, next[i].qty + qty)) };
      write(next);
    } else {
      write([...lines, { ...line, qty: Math.min(MAX_QTY, Math.max(1, qty)) }]);
    }
  },
  setQty(kind: CartLine["kind"], id: string, qty: number) {
    if (qty <= 0) return cart.remove(kind, id);
    write(snapshot().map((l) => (l.kind === kind && l.id === id ? { ...l, qty: Math.min(MAX_QTY, qty) } : l)));
  },
  /** Retire toutes les lignes dont l'id est listé (articles disparus du catalogue). */
  removeMany(ids: string[]) {
    const set = new Set(ids);
    const lines = snapshot();
    const next = lines.filter((l) => !set.has(l.id));
    if (next.length !== lines.length) write(next);
  },
  remove(kind: CartLine["kind"], id: string) {
    write(snapshot().filter((l) => !(l.kind === kind && l.id === id)));
  },
  clear() {
    write([]);
  },
};

/** Lignes du panier. Rend [] côté serveur et au premier rendu client (pas de décalage d'hydratation). */
export function useCartLines(): CartLine[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

export function useCartCount(): number {
  return useCartLines().reduce((n, l) => n + l.qty, 0);
}

export function useCartSubtotal(): number {
  return useCartLines().reduce((n, l) => n + l.price * l.qty, 0);
}
