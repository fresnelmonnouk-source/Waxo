"use client";

import { useSyncExternalStore } from "react";
import type { MeUser } from "./types";

/**
 * État côté navigateur : session (via GET /api/me, pour que les pages restent statiques), fenêtre de connexion et toasts.
 * Stores minimalistes (même style que cart/favorites) : aucun fournisseur React à monter.
 */

// ───────────────────────── Session ─────────────────────────
export type MeState = { status: "loading" | "ready"; user: MeUser | null };
const LOADING: MeState = { status: "loading", user: null };
let me: MeState = LOADING;
let inflight: Promise<MeUser | null> | null = null;
const meListeners = new Set<() => void>();
const setMe = (next: MeState) => {
  me = next;
  meListeners.forEach((l) => l());
};

async function fetchMe(): Promise<MeUser | null> {
  try {
    const res = await fetch("/api/me", { credentials: "same-origin", cache: "no-store" });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const user = (data as { user?: MeUser | null } | null)?.user;
    return user && typeof user.id === "string" ? user : null;
  } catch {
    return null;
  }
}

/** Charge la session une seule fois (les appels suivants réutilisent le résultat). */
export function ensureMe(): void {
  if (me.status === "ready" || inflight) return;
  inflight = fetchMe().then((user) => {
    inflight = null;
    setMe({ status: "ready", user });
    return user;
  });
}
/** Recharge la session (après connexion, déconnexion, modification du profil). */
export async function refreshMe(): Promise<MeUser | null> {
  const user = await fetchMe();
  setMe({ status: "ready", user });
  return user;
}
export function clearMe(): void {
  setMe({ status: "ready", user: null });
}
export function useMe(): MeState {
  return useSyncExternalStore(
    (l) => {
      meListeners.add(l);
      return () => meListeners.delete(l);
    },
    () => me,
    () => LOADING,
  );
}

// ───────────────────────── Appels API ─────────────────────────
export type ApiResult = { status: number; data: Record<string, unknown> | null };

/** JSON → JSON, ne lève jamais : status 0 = réseau coupé. */
export async function api(url: string, method: "GET" | "POST" | "PATCH", body?: unknown): Promise<ApiResult> {
  try {
    const res = await fetch(url, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data: Record<string, unknown> | null = null;
    try {
      const parsed: unknown = await res.json();
      data = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      data = null;
    }
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  }
}

/** Code d'erreur (clé de `Auth.errors.*`) d'une réponse d'échec. */
export function errorCode(res: ApiResult): string {
  if (res.status === 0) return "network";
  const code = res.data?.code;
  return typeof code === "string" ? code : "generic";
}
/** Erreurs par champ renvoyées par l'API : { phone: "phoneInvalid" }. */
export function apiFieldErrors(res: ApiResult): Record<string, string> {
  const f = res.data?.fields;
  if (!f || typeof f !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(f as Record<string, unknown>)) if (typeof v === "string") out[k] = v;
  return out;
}

// ───────────────────────── Fenêtre de connexion ─────────────────────────
export type AuthMode = "login" | "signup" | "forgot";
export type AuthRequest = {
  mode: AuthMode;
  /** Message d'accueil déjà localisé (ex. « Connectez-vous pour retrouver vos informations de livraison. »). */
  message?: string;
  /** Chemin interne (sans préfixe de langue) vers lequel aller après connexion. */
  redirect?: string;
  /** Appelé après une connexion réussie (ex. rouvrir le formulaire d'avis). */
  onSuccess?: () => void;
};
let authReq: AuthRequest | null = null;
const authListeners = new Set<() => void>();
const setAuth = (next: AuthRequest | null) => {
  authReq = next;
  authListeners.forEach((l) => l());
};
/** `authModal.open("login", { message })` — utilisable depuis n'importe quel composant client (panier, avis…). */
export const authModal = {
  open: (mode: AuthMode = "login", opts: Omit<AuthRequest, "mode"> = {}) => setAuth({ mode, ...opts }),
  close: () => setAuth(null),
};
export function useAuthRequest(): AuthRequest | null {
  return useSyncExternalStore(
    (l) => {
      authListeners.add(l);
      return () => authListeners.delete(l);
    },
    () => authReq,
    () => null,
  );
}

// ───────────────────────── Toast ─────────────────────────
let toastText: string | null = null;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
const toastListeners = new Set<() => void>();
const setToast = (t: string | null) => {
  toastText = t;
  toastListeners.forEach((l) => l());
};
export const toast = {
  show(text: string) {
    clearTimeout(toastTimer);
    setToast(text);
    toastTimer = setTimeout(() => setToast(null), 4000);
  },
  hide() {
    clearTimeout(toastTimer);
    setToast(null);
  },
};
export function useToastText(): string | null {
  return useSyncExternalStore(
    (l) => {
      toastListeners.add(l);
      return () => toastListeners.delete(l);
    },
    () => toastText,
    () => null,
  );
}
