"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCartLines } from "@/lib/cart/store";
import { useConsent } from "@/lib/tracking/consent-client";
import {
  cartAdditions,
  isAdminPath,
  isCatalogPath,
  isCheckoutPath,
  isThanksPath,
  productSlugFromPath,
  type CartSnap,
  type TrackItem,
} from "@/lib/tracking/events";
import { loadGa, loadPixel, unloadGa, unloadPixel } from "@/lib/tracking/providers";
import { TRACK_EVENT, eventFromDetail, track, trackPageView } from "@/lib/tracking/track";

const CART_KEY = "waxo:cart:v1"; // même clé que src/lib/cart/store.ts (lecture seule)
const LAST_ORDER_KEY = "waxo:last-order:v1"; // même clé que src/lib/checkout/last-order.ts (lecture seule)
const SENT_ORDERS_KEY = "waxo:tracked-orders:v1";

function readCartSnap(): CartSnap[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CART_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
      .map((l) => ({
        kind: l.kind === "pack" ? "pack" : "product",
        id: String(l.id ?? ""),
        qty: Number.isInteger(l.qty) ? (l.qty as number) : 0,
        name: String(l.name ?? ""),
        price: typeof l.price === "number" ? l.price : 0,
      }))
      .filter((l) => l.id && l.qty > 0);
  } catch {
    return [];
  }
}

const toItems = (lines: CartSnap[]): TrackItem[] =>
  lines.map((l) => ({ id: l.kind === "pack" ? `pack:${l.id}` : l.id, name: l.name, price: l.price, quantity: l.qty }));

/** Cherche le JSON-LD `Product` de la page (posé par `productJsonLd`), pour connaître id, nom et prix de la fiche. */
function readProductFromJsonLd(): TrackItem | null {
  try {
    for (const s of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
      const data: unknown = JSON.parse(s.textContent ?? "null");
      const list = Array.isArray(data) ? data : [data];
      for (const d of list) {
        const o = d as { "@type"?: string; sku?: string; name?: string; offers?: { price?: number | string } } | null;
        if (o && o["@type"] === "Product" && o.sku) {
          const price = Number(o.offers?.price);
          return { id: String(o.sku), name: o.name, price: Number.isFinite(price) ? price : undefined, quantity: 1 };
        }
      }
    }
  } catch {
    /* JSON-LD absent ou illisible */
  }
  return null;
}

function wasOrderTracked(number: string): boolean {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(SENT_ORDERS_KEY) ?? "[]");
    return Array.isArray(list) && list.includes(number);
  } catch {
    return false;
  }
}
function markOrderTracked(number: string) {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(SENT_ORDERS_KEY) ?? "[]");
    const next = (Array.isArray(list) ? list : []).filter((x) => typeof x === "string").slice(-19);
    localStorage.setItem(SENT_ORDERS_KEY, JSON.stringify([...next, number]));
  } catch {
    /* stockage bloqué : au pire un doublon sur rechargement */
  }
}

function RouteTracker() {
  const pathname = usePathname();
  const search = useSearchParams();
  const consent = useConsent();
  const active = !!consent && (consent.analytics || consent.marketing);
  const lastPage = useRef<string | null>(null);
  const lastSearch = useRef<string>("");

  // page_view (GA4 + PageView Meta) à chaque changement de chemin — manuels : la navigation SPA ne recharge pas la page.
  useEffect(() => {
    if (!active || isAdminPath(pathname) || lastPage.current === pathname) return;
    lastPage.current = pathname;
    // On laisse Next mettre à jour document.title après la navigation.
    const id = window.setTimeout(() => trackPageView(pathname), 60);
    return () => window.clearTimeout(id);
  }, [active, pathname]);

  // view_item : fiche produit.
  useEffect(() => {
    if (!active) return;
    const slug = productSlugFromPath(pathname);
    if (!slug) return;
    let tries = 0;
    let timer = 0;
    const attempt = () => {
      const item = readProductFromJsonLd();
      if (item || tries >= 8) {
        track({ name: "view_item", items: [item ?? { id: slug, name: document.title.split(" · ")[0], quantity: 1 }] });
        return;
      }
      tries += 1;
      timer = window.setTimeout(attempt, 150);
    };
    timer = window.setTimeout(attempt, 100);
    return () => window.clearTimeout(timer);
  }, [active, pathname]);

  // begin_checkout : arrivée sur la page de commande avec un panier non vide.
  useEffect(() => {
    if (!active || !isCheckoutPath(pathname)) return;
    const lines = readCartSnap();
    if (lines.length) track({ name: "begin_checkout", items: toItems(lines) });
  }, [active, pathname]);

  // purchase : page de confirmation. Les paiements en ligne non confirmés (pending) ne comptent pas encore.
  useEffect(() => {
    if (!active || !isThanksPath(pathname)) return;
    try {
      const o = JSON.parse(sessionStorage.getItem(LAST_ORDER_KEY) ?? "null") as { number?: unknown; total?: unknown; pending?: unknown } | null;
      if (!o || typeof o.number !== "string" || !/^WX-\d+$/.test(o.number) || typeof o.total !== "number" || o.pending) return;
      if (wasOrderTracked(o.number)) return;
      markOrderTracked(o.number);
      track({ name: "purchase", transactionId: o.number, value: o.total });
    } catch {
      /* pas de commande en mémoire */
    }
  }, [active, pathname]);

  // search : recherche du catalogue (?q=), temporisée pour ne pas compter chaque frappe.
  const q = isCatalogPath(pathname) ? (search.get("q") ?? "").trim() : "";
  useEffect(() => {
    if (!active || !q || q === lastSearch.current) return;
    const id = window.setTimeout(() => {
      lastSearch.current = q;
      track({ name: "search", searchTerm: q });
    }, 1200);
    return () => window.clearTimeout(id);
  }, [active, q]);

  return null;
}

/**
 * Charge GA4 / Meta Pixel selon le consentement et branche les événements e-commerce.
 * Aucun script avant choix ; aucun effet sans identifiant ; jamais monté dans /admin (autre layout racine).
 */
export function TrackingProvider() {
  const consent = useConsent();
  const lines = useCartLines();
  const prevCart = useRef<CartSnap[] | null>(null);
  const analytics = !!consent?.analytics;
  const marketing = !!consent?.marketing;

  // Chargement / retrait selon le choix.
  useEffect(() => {
    if (analytics) loadGa();
    else unloadGa();
  }, [analytics]);
  useEffect(() => {
    if (marketing) loadPixel();
    else unloadPixel();
  }, [marketing]);

  // add_to_cart : on compare le panier à sa version précédente. La base de comparaison est lue dans localStorage
  // au montage, sinon l'hydratation du panier (vide → réel) serait prise pour un ajout.
  useEffect(() => {
    if (prevCart.current === null) {
      prevCart.current = readCartSnap();
      return;
    }
    const next: CartSnap[] = lines.map((l) => ({ kind: l.kind, id: l.id, qty: l.qty, name: l.name, price: l.price }));
    const added = cartAdditions(prevCart.current, next);
    prevCart.current = next;
    if (added.length) track({ name: "add_to_cart", items: added });
  }, [lines]);

  // Événements émis par d'autres composants (`waxo:track`) et réussite des formulaires contact / inscription.
  useEffect(() => {
    if (!analytics && !marketing) return;
    const onTrack = (ev: Event) => {
      const e = eventFromDetail((ev as CustomEvent).detail);
      if (!e) return;
      if (e.name === "purchase" && e.transactionId) {
        if (wasOrderTracked(e.transactionId)) return;
        markOrderTracked(e.transactionId);
      }
      track(e);
    };
    window.addEventListener(TRACK_EVENT, onTrack);

    // Observation passive des réponses de /api/contact et /api/auth/signup (on ne modifie ni la requête ni la réponse).
    const originalFetch = window.fetch;
    const observed: typeof window.fetch = async (input, init) => {
      const res = await originalFetch(input, init);
      try {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const method = (init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase();
        if (method === "POST" && res.ok) {
          const path = new URL(url, location.origin).pathname;
          const lead = path === "/api/contact";
          const signup = path === "/api/auth/signup";
          if (lead || signup) {
            void res
              .clone()
              .json()
              .then((body: { ok?: boolean }) => {
                if (body?.ok === true) track(lead ? { name: "generate_lead" } : { name: "sign_up", method: "email" });
              })
              .catch(() => undefined);
          }
        }
      } catch {
        /* l'observation ne doit jamais gêner la requête */
      }
      return res;
    };
    window.fetch = observed;
    return () => {
      window.removeEventListener(TRACK_EVENT, onTrack);
      if (window.fetch === observed) window.fetch = originalFetch;
    };
  }, [analytics, marketing]);

  return (
    <Suspense fallback={null}>
      <RouteTracker />
    </Suspense>
  );
}
