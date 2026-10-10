"use client";

// Point d'entrée unique : `track({ name: "add_to_cart", items: [...] })`. Respecte le consentement par catégorie ;
// sans consentement ou sans identifiant, l'appel est silencieusement ignoré.
import { currentConsent } from "./consent-client";
import { sanitizePayload, isEventName, type TrackEvent } from "./events";
import { gaEvent, gaPageView, loadGa, loadPixel, metaEvent, metaPageView } from "./providers";

/** Événement `window` : `new CustomEvent("waxo:track", { detail: { name, items?, value?, ... } })` — pour les composants d'autres agents. */
export const TRACK_EVENT = "waxo:track";

let seq = 0;
const newEventId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function track(e: TrackEvent): void {
  if (typeof window === "undefined") return;
  const c = currentConsent();
  if (!c.analytics && !c.marketing) return;
  try {
    // loadX est idempotent : garantit que gtag/fbq existent (file d attente) même si un effet enfant passe avant le chargement.
    if (c.analytics) {
      loadGa();
      gaEvent(e);
    }
    if (c.marketing) {
      loadPixel();
      metaEvent(e, newEventId());
    }
  } catch {
    /* le suivi ne doit jamais casser la page */
  }
}

export function trackPageView(path: string): void {
  if (typeof window === "undefined") return;
  const c = currentConsent();
  try {
    if (c.analytics) {
      loadGa();
      gaPageView(path);
    }
    if (c.marketing) {
      loadPixel();
      metaPageView();
    }
  } catch {
    /* idem */
  }
}

/** Convertit le détail d'un événement `waxo:track` (non fiable) en événement typé, ou null. */
export function eventFromDetail(detail: unknown): TrackEvent | null {
  const o = (detail && typeof detail === "object" ? detail : null) as Record<string, unknown> | null;
  if (!o || !isEventName(o.name)) return null;
  return { name: o.name, ...sanitizePayload(o) };
}
