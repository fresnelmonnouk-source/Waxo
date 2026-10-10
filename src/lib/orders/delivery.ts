import { codDue, onRoadMessage, tourMessage, waLink } from "./format";
import type { AdminOrder, Courier, Zone } from "./types";

export type ZoneFilter = "all" | Zone;
export const ZONE_FILTERS: { id: ZoneFilter; label: string }[] = [
  { id: "all", label: "Toutes les zones" },
  { id: "cotonou", label: "Cotonou & Calavi" },
  { id: "autre", label: "Autres villes" },
];
export function parseZoneFilter(v: string | string[] | undefined): ZoneFilter {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "cotonou" || s === "autre" ? s : "all";
}

export type DeliveryOrder = AdminOrder & { courierName: string; waHref: string };
export type CourierCard = Courier & {
  inRoad: number;
  delivered30: number;
  codDue: number;
  /** Lien WhatsApp « Envoyer la tournée » (null si rien en cours ou livreur en pause). */
  routeHref: string | null;
};
export type DeliveryBoard = {
  kpis: { toShip: number; toShipNew: number; onRoad: number; couriersOut: number; deliveredToday: number; codDue: number };
  zoneCounts: Record<ZoneFilter, number>;
  toShip: DeliveryOrder[];
  onRoad: DeliveryOrder[];
  delivered: DeliveryOrder[];
  couriers: CourierCard[];
};

export type DeliveryInput = {
  /** Commandes nouvelle / préparation / livraison (toutes zones). */
  active: AdminOrder[];
  /** Dernières commandes livrées (déjà triées, récentes d'abord). */
  recentDelivered: AdminOrder[];
  deliveredToday: number;
  /** Livraisons des 30 derniers jours : seul le livreur compte. */
  delivered30: { courierId: string | null }[];
  couriers: Courier[];
  zone: ZoneFilter;
  now: number;
};

/** Construit le tableau de bord des livraisons (maquette : deliveryVals). Fonction pure. */
export function buildDeliveryBoard(input: DeliveryInput): DeliveryBoard {
  const { active, couriers, zone, now } = input;
  const byId = new Map(couriers.map((c) => [c.id, c]));
  const inZone = (o: AdminOrder) => zone === "all" || o.zone === zone;
  const decorate = (o: AdminOrder): DeliveryOrder => {
    const c = o.courierId ? byId.get(o.courierId) : undefined;
    return { ...o, courierName: c ? c.name : "Sans livreur", waHref: waLink(o.phone, onRoadMessage(o, c)) };
  };

  const ship = active.filter((o) => o.status === "nouvelle" || o.status === "preparation");
  const road = active.filter((o) => o.status === "livraison");
  const toShip = ship
    .filter(inZone)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(decorate);
  const onRoad = road
    .filter(inZone)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(decorate);

  const both = [...ship, ...road];
  const zoneCounts: Record<ZoneFilter, number> = {
    all: both.length,
    cotonou: both.filter((o) => o.zone === "cotonou").length,
    autre: both.filter((o) => o.zone === "autre").length,
  };

  const cards: CourierCard[] = couriers.map((c) => {
    const mine = road.filter((o) => o.courierId === c.id);
    const cod = mine.reduce((a, o) => a + codDue(o), 0);
    const done = input.delivered30.filter((d) => d.courierId === c.id).length;
    return {
      ...c,
      inRoad: mine.length,
      delivered30: done,
      codDue: cod,
      routeHref: mine.length > 0 && c.active ? waLink(c.phone, tourMessage(mine, now)) : null,
    };
  });

  return {
    kpis: {
      toShip: ship.length,
      toShipNew: ship.filter((o) => o.status === "nouvelle").length,
      onRoad: road.length,
      couriersOut: new Set(road.map((o) => o.courierId).filter(Boolean)).size,
      deliveredToday: input.deliveredToday,
      codDue: road.reduce((a, o) => a + codDue(o), 0),
    },
    zoneCounts,
    toShip,
    onRoad,
    delivered: input.recentDelivered.filter(inZone).slice(0, 6).map(decorate),
    couriers: cards,
  };
}
