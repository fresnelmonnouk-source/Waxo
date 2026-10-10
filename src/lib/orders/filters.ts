import { normPhone } from "@/lib/auth/validation";
import { isOrderStatus } from "./status";
import type { AdminOrder, OrderStatus } from "./types";

export type Period = "7" | "30" | "90" | "all";
export type OrderFilters = { status: OrderStatus | "all"; q: string; period: Period; page: number };
export type SearchParams = Record<string, string | string[] | undefined>;

/** Lignes par page (≤ 200 : limite du brief). */
export const PAGE_SIZE = 50;
export const PERIODS: { id: Period; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "7", label: "7 jours" },
  { id: "30", label: "30 jours" },
  { id: "90", label: "90 jours" },
];

const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));

/** Minuscules sans accents (comparaison de recherche). */
export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Texte de recherche sûr : lettres, chiffres, espace, tiret, apostrophe, point ; borné à 60 caractères. */
export function sanitizeSearch(q: string): string {
  return q
    .normalize("NFC")
    .replace(/[^\p{L}\p{N} '.\-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export function parseOrderFilters(sp: SearchParams): OrderFilters {
  const s = first(sp.statut);
  const p = first(sp.periode);
  const page = Number.parseInt(first(sp.page), 10);
  return {
    status: isOrderStatus(s) ? s : "all",
    q: sanitizeSearch(first(sp.q)),
    period: p === "7" || p === "30" || p === "90" ? p : "all",
    page: Number.isFinite(page) && page >= 1 && page <= 10_000 ? page : 1,
  };
}

/** Début de période en ms epoch (null = pas de borne). */
export function periodStart(period: Period, now: number): number | null {
  return period === "all" ? null : now - Number(period) * 86_400_000;
}

/** Filtre + tri (récentes d'abord) d'une liste déjà chargée (repli démo). */
export function filterOrders(orders: AdminOrder[], f: Pick<OrderFilters, "status" | "q" | "period">, now: number): AdminOrder[] {
  const q = norm(f.q);
  const digits = normPhone(f.q);
  const since = periodStart(f.period, now);
  return orders
    .filter((o) => {
      if (f.status !== "all" && o.status !== f.status) return false;
      if (since !== null && new Date(o.createdAt).getTime() < since) return false;
      if (!q) return true;
      if (norm(`${o.number} ${o.name}`).includes(q)) return true;
      return digits.length >= 3 && normPhone(o.phone).includes(digits);
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Conditions `.or()` PostgREST pour la recherche (le texte a été passé par sanitizeSearch : pas de `,()%_`). */
export function searchOrClause(q: string): string | null {
  const t = sanitizeSearch(q);
  if (!t) return null;
  const parts = [`number.ilike.%${t}%`, `name.ilike.%${t}%`];
  const d = normPhone(t);
  if (d.length >= 3) parts.push(`phone.ilike.%${d}%`);
  return parts.join(",");
}

/** Reconstruit une query string (paramètres par défaut omis). */
export function filtersToQuery(f: Partial<OrderFilters>, extra: Record<string, string | undefined> = {}): string {
  const p = new URLSearchParams();
  if (f.status && f.status !== "all") p.set("statut", f.status);
  if (f.period && f.period !== "all") p.set("periode", f.period);
  if (f.q) p.set("q", f.q);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const ORDER_NUMBER = /^WX-\d{3,8}$/;
export function parseSelected(sp: SearchParams, key = "commande"): string | null {
  const v = first(sp[key]).trim().toUpperCase();
  return ORDER_NUMBER.test(v) ? v : null;
}
