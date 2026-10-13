// Événements de suivi et leur traduction GA4 / Meta Pixel : fonctions PURES (testées dans tests/tracking-events.test.ts).
// Montants en XOF entiers. Aucune donnée personnelle (ni nom, ni e-mail, ni téléphone) n'est jamais envoyée.

export const CURRENCY = "XOF";

export type TrackItem = { id: string; name?: string; price?: number; quantity?: number };

export type TrackEventName = "view_item" | "add_to_cart" | "begin_checkout" | "purchase" | "search" | "generate_lead" | "sign_up";

export type TrackPayload = {
  items?: TrackItem[];
  /** Montant total en XOF (sinon calculé depuis les lignes). */
  value?: number;
  transactionId?: string;
  searchTerm?: string;
  method?: string;
};

export type TrackEvent = { name: TrackEventName } & TrackPayload;

export const EVENT_NAMES: readonly TrackEventName[] = ["view_item", "add_to_cart", "begin_checkout", "purchase", "search", "generate_lead", "sign_up"];

export function isEventName(v: unknown): v is TrackEventName {
  return typeof v === "string" && (EVENT_NAMES as readonly string[]).includes(v);
}

const int = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0);
const str = (s: unknown, max = 100): string => (typeof s === "string" ? s.slice(0, max) : "");

/** Nettoie une charge utile venue d'un événement navigateur (non fiable). */
export function sanitizePayload(raw: unknown): TrackPayload {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const items = Array.isArray(o.items)
    ? o.items
        .slice(0, 50)
        .map((it): TrackItem | null => {
          const i = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
          const id = str(i.id, 64);
          if (!id) return null;
          return { id, name: str(i.name, 120) || undefined, price: i.price === undefined ? undefined : int(i.price), quantity: Math.max(1, int(i.quantity ?? 1)) };
        })
        .filter((x): x is TrackItem => x !== null)
    : undefined;
  return {
    items,
    value: o.value === undefined ? undefined : int(o.value),
    transactionId: str(o.transactionId, 40) || undefined,
    searchTerm: str(o.searchTerm, 80) || undefined,
    method: str(o.method, 30) || undefined,
  };
}

export function itemsValue(items: TrackItem[] | undefined): number {
  return (items ?? []).reduce((sum, i) => sum + int(i.price) * Math.max(1, int(i.quantity ?? 1)), 0);
}

export function eventValue(p: TrackPayload): number {
  return p.value !== undefined ? int(p.value) : itemsValue(p.items);
}

export type GaCall = { name: string; params: Record<string, unknown> };

/** Traduit un événement en appel GA4 (`gtag('event', name, params)`). */
export function toGa(e: TrackEvent): GaCall {
  const items = (e.items ?? []).map((i) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity ?? 1 }));
  switch (e.name) {
    case "view_item":
    case "add_to_cart":
    case "begin_checkout":
      return { name: e.name, params: { currency: CURRENCY, value: eventValue(e), items } };
    case "purchase":
      return { name: "purchase", params: { transaction_id: e.transactionId, currency: CURRENCY, value: eventValue(e), items } };
    case "search":
      return { name: "search", params: { search_term: e.searchTerm ?? "" } };
    case "generate_lead":
      return { name: "generate_lead", params: {} };
    case "sign_up":
      return { name: "sign_up", params: { method: e.method ?? "email" } };
  }
}

export type MetaCall = { name: string; params: Record<string, unknown> };

/** Traduit un événement en appel Meta Pixel (`fbq('track', name, params)`). */
export function toMeta(e: TrackEvent): MetaCall {
  const ids = (e.items ?? []).map((i) => i.id);
  const qty = (e.items ?? []).reduce((n, i) => n + Math.max(1, int(i.quantity ?? 1)), 0);
  const content = { content_ids: ids, content_type: "product", currency: CURRENCY, value: eventValue(e) };
  switch (e.name) {
    case "view_item":
      return { name: "ViewContent", params: { ...content, content_name: e.items?.[0]?.name } };
    case "add_to_cart":
      return { name: "AddToCart", params: { ...content, content_name: e.items?.[0]?.name } };
    case "begin_checkout":
      return { name: "InitiateCheckout", params: { ...content, num_items: qty } };
    case "purchase":
      return { name: "Purchase", params: { ...content, num_items: qty } };
    case "search":
      return { name: "Search", params: { search_string: e.searchTerm ?? "" } };
    case "generate_lead":
      return { name: "Lead", params: {} };
    case "sign_up":
      return { name: "CompleteRegistration", params: { status: true } };
  }
}

/** Retire la langue d'un chemin : `/fr/produit/x` → `/produit/x`. */
export function stripLocale(pathname: string): string {
  const m = /^\/(fr|en)(\/.*)?$/.exec(pathname);
  return m ? (m[2] ?? "/") : pathname;
}

/** Slug d'une fiche produit à partir du chemin, ou null. */
export function productSlugFromPath(pathname: string): string | null {
  const m = /^\/produit\/([^/]+)\/?$/.exec(stripLocale(pathname));
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

export const isCheckoutPath = (pathname: string): boolean => /^\/commande\/?$/.test(stripLocale(pathname));
export const isThanksPath = (pathname: string): boolean => /^\/commande\/merci\/?$/.test(stripLocale(pathname));
export const isCatalogPath = (pathname: string): boolean => /^\/catalogue\/?$/.test(stripLocale(pathname));

/** Pages jamais mesurées (compte, panier de paiement… restent mesurées en page_view mais sans paramètres sensibles). */
export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** Différence de panier : lignes dont la quantité a augmenté (le « delta » est ce qui vient d'être ajouté). */
export type CartSnap = { kind: string; id: string; qty: number; name: string; price: number };
export function cartAdditions(prev: CartSnap[], next: CartSnap[]): TrackItem[] {
  const before = new Map(prev.map((l) => [`${l.kind}:${l.id}`, l.qty]));
  const out: TrackItem[] = [];
  for (const l of next) {
    const delta = l.qty - (before.get(`${l.kind}:${l.id}`) ?? 0);
    if (delta > 0) out.push({ id: l.kind === "pack" ? `pack:${l.id}` : l.id, name: l.name, price: l.price, quantity: delta });
  }
  return out;
}

/** Slug d'une fiche pack à partir du chemin, ou null. */
export function packSlugFromPath(pathname: string): string | null {
  const m = /^\/packs\/([^/]+)\/?$/.exec(stripLocale(pathname));
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

/** Dernier segment (décodé) et section d'une URL absolue ou relative : `https://x/fr/produit/savon` → ["produit", "savon"]. */
function urlTail(url: string): [string, string] | null {
  try {
    const parts = new URL(url, "https://x.invalid").pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    let last = parts[parts.length - 1];
    try {
      last = decodeURIComponent(last);
    } catch {
      /* segment déjà brut */
    }
    return [parts[parts.length - 2], last];
  } catch {
    return null;
  }
}

/**
 * Contrat JSON-LD ↔ suivi (docs/AUDIT-SEO-BRIEF.md) : lit le `Product` posé par l'équipe SEO sur la fiche.
 * Identifiant = `productID` (UUID, `sku` identique en repli), prix = `offers.price` (XOF entier) : c'est le même
 * identifiant que `add_to_cart` (ligne de panier) et le prix de la fiche. Les packs sont préfixés `pack:` comme au panier.
 * Renvoie null si l'identifiant ou le prix manque, ou si le JSON-LD décrit une autre page (navigation en cours) :
 * dans ce cas aucun `view_item` n'est envoyé (jamais d'événement au slug ni sans valeur).
 */
export function productItemFromJsonLd(data: unknown, page: { section: "produit" | "packs"; slug: string }): TrackItem | null {
  const roots = Array.isArray(data) ? data : [data];
  const nodes: unknown[] = [];
  for (const r of roots) {
    nodes.push(r);
    const graph = r && typeof r === "object" ? (r as { "@graph"?: unknown })["@graph"] : undefined;
    if (Array.isArray(graph)) nodes.push(...graph);
  }
  for (const n of nodes) {
    if (!n || typeof n !== "object") continue;
    const o = n as Record<string, unknown>;
    const type = o["@type"];
    if (!(type === "Product" || (Array.isArray(type) && type.includes("Product")))) continue;
    const rawId = typeof o.productID === "string" && o.productID.trim() ? o.productID : typeof o.sku === "string" ? o.sku : "";
    const id = rawId.trim();
    if (!id) continue;
    const offer = (Array.isArray(o.offers) ? o.offers[0] : o.offers) as Record<string, unknown> | undefined;
    const price = typeof offer?.price === "number" ? offer.price : typeof offer?.price === "string" && offer.price.trim() ? Number(offer.price) : NaN;
    if (!Number.isFinite(price) || price < 0) continue;
    const url = typeof o.url === "string" ? o.url : typeof offer?.url === "string" ? offer.url : null;
    if (url) {
      const tail = urlTail(url);
      if (!tail || tail[0] !== page.section || tail[1] !== page.slug) continue;
    }
    return {
      id: page.section === "packs" ? `pack:${id}` : id,
      name: typeof o.name === "string" ? o.name.slice(0, 120) : undefined,
      price: Math.round(price),
      quantity: 1,
    };
  }
  return null;
}
