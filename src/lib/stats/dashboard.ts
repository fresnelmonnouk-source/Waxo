// Tableau de bord : indicateurs et listes (maquette lignes 83-131 + renderVals 1150-1230). Fonctions pures, testées.
import { LOW_STOCK } from "@/lib/admin/ui/constants";
import type { StatOrder, StatProduct } from "./types";
import { DAY_MS, parseTs } from "./time";

export type DashboardData = {
  /** Chiffre d'affaires des 30 derniers jours (hors annulées), livraison comprise. */
  rev30: number;
  count30: number;
  avg30: number;
  /** Commandes « Reçue » ou « En préparation », les plus anciennes d'abord. */
  todo: StatOrder[];
  newCount: number;
  /** Produits actifs à 5 unités ou moins, du plus bas au plus haut. */
  low: StatProduct[];
  /** Les 5 produits les plus vendus. */
  topSold: StatProduct[];
};

export function computeDashboard(orders: StatOrder[], products: StatProduct[], now: number): DashboardData {
  const d30 = now - 30 * DAY_MS;
  const last30 = orders.filter((o) => o.status !== "annulee" && parseTs(o.date) >= d30);
  const rev30 = last30.reduce((a, o) => a + o.total, 0);
  const todo = orders
    .filter((o) => o.status === "nouvelle" || o.status === "preparation")
    .sort((a, b) => parseTs(a.date) - parseTs(b.date));
  const low = products.filter((p) => p.active && p.stock <= LOW_STOCK).sort((a, b) => a.stock - b.stock);
  const topSold = [...products].sort((a, b) => b.sold - a.sold).slice(0, 5);
  return {
    rev30,
    count30: last30.length,
    avg30: last30.length ? rev30 / last30.length : 0,
    todo,
    newCount: orders.filter((o) => o.status === "nouvelle").length,
    low,
    topSold,
  };
}
