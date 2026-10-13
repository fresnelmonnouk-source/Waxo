"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

/**
 * Widget Cloudflare Turnstile (audit Raphaël M1 / O2), partagé par la commande et l'inscription.
 * - Rendu SEULEMENT si une clé de site est fournie (le serveur ne la donne que si la vérification est configurée) :
 *   sans clés, rien n'est chargé ni affiché.
 * - Le script de Cloudflare n'est injecté qu'à l'affichage de ce composant (jamais sur les autres pages).
 * - Mode « interaction-only » : invisible pour la plupart des visiteurs, une case n'apparaît qu'en cas de doute.
 * - Jeton à usage unique : `token()` attend le jeton (8 s au plus), `reset()` en redemande un après chaque envoi.
 */

export type TurnstileHandle = {
  /** Jeton courant, en l'attendant jusqu'à 8 s ; null si aucun (widget absent, échec, délai dépassé). */
  token(): Promise<string | null>;
  /** Après un envoi : le jeton est consommé, on en demande un nouveau. */
  reset(): void;
};

type TurnstileApi = {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  reset(id?: string): void;
  remove(id?: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const WAIT_MS = 8000;
let loading: Promise<TurnstileApi | null> | null = null;

function loadScript(): Promise<TurnstileApi | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(window.turnstile ?? null);
    s.onerror = () => {
      loading = null; // réseau : un prochain affichage réessaiera
      resolve(null);
    };
    document.head.appendChild(s);
  });
  return loading;
}

export function TurnstileWidget({
  siteKey,
  lang,
  ref,
}: {
  siteKey: string | null;
  lang: "fr" | "en";
  ref?: Ref<TurnstileHandle>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const current = useRef<string | null>(null);
  const waiters = useRef<((t: string | null) => void)[]>([]);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    const settle = (t: string | null) => {
      current.current = t;
      if (t) for (const w of waiters.current.splice(0)) w(t);
    };
    void loadScript().then((api) => {
      if (cancelled || !api || !box.current) return;
      widgetId.current = api.render(box.current, {
        sitekey: siteKey,
        language: lang,
        appearance: "interaction-only",
        callback: (t: string) => settle(t),
        "expired-callback": () => settle(null),
        "error-callback": () => settle(null),
      });
    });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey, lang]);

  useImperativeHandle(
    ref,
    () => ({
      token() {
        if (!siteKey) return Promise.resolve(null);
        if (current.current) return Promise.resolve(current.current);
        return new Promise<string | null>((resolve) => {
          const done = (t: string | null) => {
            clearTimeout(timer);
            resolve(t);
          };
          const timer = setTimeout(() => {
            waiters.current = waiters.current.filter((w) => w !== done);
            resolve(null);
          }, WAIT_MS);
          waiters.current.push(done);
        });
      },
      reset() {
        current.current = null;
        if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
      },
    }),
    [siteKey],
  );

  if (!siteKey) return null;
  return <div ref={box} className="min-h-0 empty:hidden" />;
}
