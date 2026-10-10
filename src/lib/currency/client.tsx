"use client";

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { DEFAULT_FX, fmtMoney, isCurrency, type Currency, type FxRates } from "./core";

/**
 * Devise d'affichage choisie par le visiteur (localStorage). Rend toujours « XOF » côté serveur et au premier rendu
 * client : les pages restent statiques, sans décalage d'hydratation (un visiteur en € voit le FCFA une fraction de seconde).
 * Purement cosmétique : le serveur ne reçoit jamais la devise ni un montant converti.
 */
const KEY = "waxo:currency:v1";
let cache: Currency | null = null;
const listeners = new Set<() => void>();

function read(): Currency {
  try {
    const raw = localStorage.getItem(KEY);
    return isCurrency(raw) ? raw : "XOF";
  } catch {
    return "XOF";
  }
}

function snapshot(): Currency {
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

export function setCurrency(next: Currency) {
  cache = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* stockage bloqué : la devise tient pour la session */
  }
  listeners.forEach((l) => l());
}

const FxContext = createContext<FxRates>(DEFAULT_FX);

/** Fournit le taux (lu en base côté serveur, toujours transmis — même si le visiteur est en FCFA — pour que la bascule soit juste). */
export function CurrencyProvider({ fx, children }: { fx: FxRates; children: ReactNode }) {
  return <FxContext.Provider value={fx}>{children}</FxContext.Provider>;
}

export function useCurrency(): Currency {
  return useSyncExternalStore(subscribe, snapshot, () => "XOF" as Currency);
}

/** Formateur FCFA → devise choisie. Stable tant que devise/langue/taux ne changent pas. */
export function usePrice(): (xof: number) => string {
  const currency = useCurrency();
  const fx = useContext(FxContext);
  const locale = useLocale();
  return useCallback((xof: number) => fmtMoney(xof, currency, fx, locale), [currency, fx, locale]);
}

/** Équivalent « ≈ » du montant dans la devise choisie, ou null si le visiteur est en FCFA (rien à ajouter). */
export function useApproxPrice(): (xof: number) => string | null {
  const currency = useCurrency();
  const fx = useContext(FxContext);
  const locale = useLocale();
  return useCallback((xof: number) => (currency === "XOF" ? null : fmtMoney(xof, currency, fx, locale)), [currency, fx, locale]);
}

/** Prix à insérer dans du JSX (serveur ou client). */
export function Price({ amount }: { amount: number }) {
  const fmt = usePrice();
  return <>{fmt(amount)}</>;
}
