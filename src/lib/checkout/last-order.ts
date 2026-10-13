// Mémoire de la dernière commande (sessionStorage) : alimente la page de confirmation /commande/merci,
// qui survit ainsi à un rechargement. Aucune donnée sensible : numéro, montants, nom, téléphone de livraison.

import type { PayMethod, Zone } from "./shipping";

export type LastOrder = {
  number: string;
  total: number;
  pay: PayMethod;
  zone: Zone;
  name: string;
  phone: string;
  /** Paiement en ligne non encore confirmé (webhook à venir). */
  pending: boolean;
  placedAt: number;
  /** Lignes pour l'événement `purchase` (mêmes identifiants que `add_to_cart` : UUID, `pack:<UUID>` pour un pack). */
  items?: { id: string; price: number; quantity: number }[];
};

const KEY = "waxo:last-order:v1";

export function saveLastOrder(order: LastOrder): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(order));
  } catch {
    /* stockage bloqué : la page de confirmation affichera la version générique */
  }
}

/** Contenu brut (chaîne stable, utilisable comme instantané useSyncExternalStore). */
export function readLastOrderRaw(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Valide et normalise le contenu stocké ; null si absent ou altéré. */
export function parseLastOrder(raw: string | null): LastOrder | null {
  try {
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<LastOrder>;
    if (typeof o.number !== "string" || !/^WX-\d+$/.test(o.number) || typeof o.total !== "number") return null;
    const pay = (["momo", "moov", "celtiis", "carte", "cod"] as const).find((m) => m === o.pay) ?? "cod";
    return {
      number: o.number,
      total: o.total,
      pay,
      zone: o.zone === "autre" ? "autre" : "cotonou",
      name: typeof o.name === "string" ? o.name : "",
      phone: typeof o.phone === "string" ? o.phone : "",
      pending: !!o.pending,
      placedAt: typeof o.placedAt === "number" ? o.placedAt : 0,
      items: Array.isArray(o.items)
        ? o.items
            .filter((i) => i && typeof i.id === "string" && Number.isFinite(i.price) && Number.isInteger(i.quantity) && i.quantity > 0)
            .map((i) => ({ id: i.id, price: i.price, quantity: i.quantity }))
        : undefined,
    };
  } catch {
    return null;
  }
}
