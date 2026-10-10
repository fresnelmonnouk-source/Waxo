"use client";

// Chargement des scripts GA4 et Meta Pixel — UNIQUEMENT après consentement, jamais sans identifiant valide.
// Inerte (aucun appel réseau, aucune injection) si NEXT_PUBLIC_GA_ID / NEXT_PUBLIC_META_PIXEL_ID sont absents ou mal formés.
import { validGaId, validPixelId } from "./consent";
import { toGa, toMeta, type TrackEvent } from "./events";

type Gtag = (...args: unknown[]) => void;
type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  loaded: boolean;
  version: string;
  push: unknown;
};
type TrackWindow = {
  dataLayer?: unknown[];
  gtag?: Gtag;
  fbq?: Fbq;
  _fbq?: Fbq;
} & Record<string, unknown>;

export const gaId = (): string | null => validGaId(process.env.NEXT_PUBLIC_GA_ID);
export const pixelId = (): string | null => validPixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID);

let gaLoaded = false;
let pixelLoaded = false;

function addScript(src: string, id: string) {
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

// ───────────────────────── GA4 ─────────────────────────
/** Charge gtag.js (consentement « analytics » accordé). `page_view` toujours manuel (SPA). */
export function loadGa(): void {
  const id = gaId();
  if (!id || typeof window === "undefined") return;
  const w = window as unknown as TrackWindow;
  w[`ga-disable-${id}`] = false;
  if (gaLoaded) {
    w.gtag?.("consent", "update", { analytics_storage: "granted" });
    return;
  }
  gaLoaded = true;
  const dl: unknown[] = (w.dataLayer = w.dataLayer || []);
  // gtag.js attend dans dataLayer l'objet `arguments` lui-même (pas un tableau).
  w.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    dl.push(arguments);
  };
  // Mode consentement : tout refusé par défaut, seule la mesure d'audience est accordée ; jamais de publicité Google.
  w.gtag("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  w.gtag("consent", "update", { analytics_storage: "granted" });
  w.gtag("js", new Date());
  w.gtag("config", id, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
  addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`, "waxo-ga4");
}

/** Retrait du consentement : on coupe l'envoi (le script déjà chargé ne peut pas être déchargé). */
export function unloadGa(): void {
  const id = gaId();
  if (!id || typeof window === "undefined") return;
  const w = window as unknown as TrackWindow;
  w[`ga-disable-${id}`] = true;
  w.gtag?.("consent", "update", { analytics_storage: "denied" });
}

export function gaPageView(path: string): void {
  const w = window as unknown as TrackWindow;
  if (!gaId() || !w.gtag || w[`ga-disable-${gaId()}`] === true) return;
  w.gtag("event", "page_view", { page_path: path, page_location: location.origin + path, page_title: document.title });
}

export function gaEvent(e: TrackEvent): void {
  const w = window as unknown as TrackWindow;
  if (!gaId() || !w.gtag || w[`ga-disable-${gaId()}`] === true) return;
  const c = toGa(e);
  w.gtag("event", c.name, c.params);
}

// ───────────────────────── Meta Pixel ─────────────────────────
/** Charge fbevents.js (consentement « marketing » accordé), avec autoConfig désactivé : aucun événement automatique. */
export function loadPixel(): void {
  const id = pixelId();
  if (!id || typeof window === "undefined") return;
  const w = window as unknown as TrackWindow;
  if (pixelLoaded) {
    w.fbq?.("consent", "grant");
    return;
  }
  pixelLoaded = true;
  if (!w.fbq) {
    const n = function (...args: unknown[]) {
      if (n.callMethod) n.callMethod(...args);
      else n.queue.push(args);
    } as Fbq;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    w.fbq = n;
    w._fbq = n;
  }
  const fbq = w.fbq as Fbq;
  fbq("set", "autoConfig", false, id); // AVANT init : sinon Meta ajoute des « Purchase »/clics automatiques erronés
  fbq("init", id);
  fbq("consent", "grant");
  addScript("https://connect.facebook.net/en_US/fbevents.js", "waxo-meta-pixel");
}

export function unloadPixel(): void {
  const w = window as unknown as TrackWindow;
  if (!pixelId()) return;
  w.fbq?.("consent", "revoke");
}

export function metaPageView(): void {
  const w = window as unknown as TrackWindow;
  if (!pixelId() || !w.fbq) return;
  w.fbq("track", "PageView");
}

export function metaEvent(e: TrackEvent, eventId: string): void {
  const w = window as unknown as TrackWindow;
  if (!pixelId() || !w.fbq) return;
  const c = toMeta(e);
  // eventID : permet à Stape/CAPI de dédoublonner le même événement envoyé côté serveur.
  w.fbq("track", c.name, c.params, { eventID: eventId });
}
