"use client";

// Magasin de consentement côté navigateur (localStorage + cookie 6 mois). Même style que cart/favorites : aucun fournisseur React.
import { useSyncExternalStore } from "react";
import {
  CONSENT_CHANGED_EVENT,
  CONSENT_STORAGE_KEY,
  effectiveConsent,
  consentCookieString,
  isTrackingCookieName,
  makeConsent,
  parseConsent,
  parseCookieValue,
  readCookieValue,
  type ConsentChoice,
  type StoredConsent,
} from "./consent";

/** `undefined` = pas encore lu (serveur / hydratation) ; `null` = aucun choix enregistré. */
export type ConsentState = StoredConsent | null | undefined;

let cache: ConsentState = undefined;
const listeners = new Set<() => void>();

function readStored(): StoredConsent | null {
  const now = Date.now();
  try {
    const fromLs = parseConsent(localStorage.getItem(CONSENT_STORAGE_KEY), now);
    if (fromLs) return fromLs;
  } catch {
    /* stockage bloqué : on essaie le cookie */
  }
  try {
    return parseCookieValue(readCookieValue(document.cookie), now);
  } catch {
    return null;
  }
}

function snapshot(): ConsentState {
  if (cache === undefined) cache = readStored();
  return cache;
}

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === CONSENT_STORAGE_KEY) {
      cache = readStored();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Efface les cookies GA / Meta posés avant le retrait du consentement (chemin racine et domaine parent). */
export function purgeTrackingCookies(): void {
  try {
    const host = location.hostname;
    const parts = host.split(".");
    const domains = [host, ...(parts.length > 2 ? [`.${parts.slice(-2).join(".")}`] : []), `.${host}`];
    for (const raw of document.cookie.split(";")) {
      const name = raw.split("=")[0].trim();
      if (!isTrackingCookieName(name)) continue;
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
      for (const d of domains) document.cookie = `${name}=; Max-Age=0; Path=/; Domain=${d}; SameSite=Lax`;
    }
  } catch {
    /* rien à purger */
  }
}

/** Enregistre le choix (localStorage + cookie) et prévient les écouteurs. */
export function saveConsent(choice: ConsentChoice): StoredConsent {
  const prev = effectiveConsent(snapshot() ?? null);
  const next = makeConsent(choice, Date.now());
  cache = next;
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* le cookie fait foi */
  }
  try {
    document.cookie = consentCookieString(next, location.protocol === "https:");
  } catch {
    /* cookies bloqués : le choix reste valable pour la session via le cache mémoire */
  }
  if ((prev.analytics && !next.analytics) || (prev.marketing && !next.marketing)) purgeTrackingCookies();
  emit();
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: { analytics: next.analytics, marketing: next.marketing } }));
  } catch {
    /* environnement sans CustomEvent */
  }
  return next;
}

/** Choix effectif sans hook (hors React) ; sans choix enregistré : le défaut (Meta actif, GA4 coupé). */
export function currentConsent(): ConsentChoice {
  return effectiveConsent(snapshot() ?? null);
}

export function useConsent(): ConsentState {
  return useSyncExternalStore(subscribe, snapshot, () => undefined);
}

/** Choix effectif pour le suivi ; `undefined` tant que le navigateur n'a pas été lu (serveur / hydratation). */
export function useEffectiveConsent(): ConsentChoice | undefined {
  const c = useConsent();
  return c === undefined ? undefined : effectiveConsent(c);
}
