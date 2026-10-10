// Statistiques : mêmes calculs que `statsVals()` de la maquette (lignes 1028-1074). Fonctions pures, testées.
import { fmtXof } from "@/lib/money";
import type { StatOrder, StatProduct } from "./types";
import { DAY_MS, dayStart, fmtDate, parseTs, watParts } from "./time";
import { WEEKDAYS_SHORT } from "./format";

export const STATS_RANGES = [7, 30, 90] as const;
export type StatsRange = (typeof STATS_RANGES)[number];
export const isStatsRange = (v: unknown): v is StatsRange => STATS_RANGES.includes(v as StatsRange);

export type Bar = { v: number; label: string; tip: string };
export type GroupRow = { key: string; value: number; share: number; widthPct: number };

export type StatsResult = {
  range: StatsRange;
  ca: number;
  prevCa: number;
  count: number;
  prevCount: number;
  avg: number;
  prevAvg: number;
  units: number;
  buyers: number;
  cancelRate: number;
  cancelledCount: number;
  bars: Bar[];
  byCategory: GroupRow[];
  byPay: GroupRow[];
  byZone: GroupRow[];
  topRev: { name: string; qty: number; rev: number }[];
  /** Commandes (hors annulées) par jour de la semaine, lundi → dimanche. */
  weekCounts: number[];
};

/** Normalise un numéro béninois pour compter des clients distincts (chiffres seuls, sans indicatif 229). */
export function normPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00229")) d = d.slice(5);
  else if (d.startsWith("229") && d.length > 10) d = d.slice(3);
  return d;
}

/** Variation en pourcentage vs la période précédente (null si pas de base de comparaison). */
export function deltaPct(current: number, previous: number): number | null {
  return previous ? (current - previous) / previous : null;
}

function group(
  orders: StatOrder[],
  keysOf: (o: StatOrder) => [string, number][],
): GroupRow[] {
  const m = new Map<string, number>();
  for (const o of orders) for (const [k, v] of keysOf(o)) m.set(k, (m.get(k) ?? 0) + v);
  const total = [...m.values()].reduce((a, b) => a + b, 0) || 1;
  const max = Math.max(1, ...m.values());
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({ key, value, share: value / total, widthPct: Math.round((value / max) * 100) }));
}

export function computeStats(orders: StatOrder[], products: StatProduct[], range: StatsRange, now: number): StatsResult {
  const start = now - range * DAY_MS;
  const pstart = start - range * DAY_MS;
  const within = (o: StatOrder, a: number, b: number) => {
    const t = parseTs(o.date);
    return t >= a && t < b;
  };
  const all = orders.filter((o) => within(o, start, now + 1));
  const prevAll = orders.filter((o) => within(o, pstart, start));
  const ok = all.filter((o) => o.status !== "annulee");
  const pok = prevAll.filter((o) => o.status !== "annulee");
  const ca = ok.reduce((a, o) => a + o.total, 0);
  const prevCa = pok.reduce((a, o) => a + o.total, 0);
  const units = ok.reduce((a, o) => a + o.items.reduce((b, i) => b + i.qty, 0), 0);
  const cancelledCount = all.length - ok.length;

  const bars: Bar[] = [];
  if (range <= 30) {
    const today0 = dayStart(now);
    for (let i = range - 1; i >= 0; i--) {
      const d0 = today0 - i * DAY_MS;
      const d1 = d0 + DAY_MS;
      const v = ok.filter((o) => within(o, d0, d1)).reduce((a, o) => a + o.total, 0);
      const p = watParts(d0);
      bars.push({
        v,
        label: range === 7 ? WEEKDAYS_SHORT[p.wd] : i % 5 === 0 ? `${p.d}/${p.m}` : "",
        tip: `${fmtDate(d0, { weekday: "long", day: "numeric", month: "long" })} : ${fmtXof(v)}`,
      });
    }
  } else {
    for (let i = 12; i >= 0; i--) {
      const d1 = now - i * 7 * DAY_MS;
      const d0 = d1 - 7 * DAY_MS;
      const v = ok.filter((o) => within(o, d0, d1 + 1)).reduce((a, o) => a + o.total, 0);
      bars.push({
        v,
        label: i % 2 === 0 ? fmtDate(d0, { day: "numeric", month: "short" }) : "",
        tip: `Semaine du ${fmtDate(d0, { day: "numeric", month: "long" })} : ${fmtXof(v)}`,
      });
    }
  }

  const catOf = new Map(products.map((p) => [p.id, p.cat]));
  const byProduct = new Map<string, { name: string; qty: number; rev: number }>();
  for (const o of ok)
    for (const i of o.items) {
      const b = byProduct.get(i.pid) ?? { name: i.name, qty: 0, rev: 0 };
      b.qty += i.qty;
      b.rev += i.qty * i.price;
      byProduct.set(i.pid, b);
    }
  const weekCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const o of ok) weekCounts[watParts(parseTs(o.date)).wd]++;

  return {
    range,
    ca,
    prevCa,
    count: ok.length,
    prevCount: pok.length,
    avg: ok.length ? ca / ok.length : 0,
    prevAvg: pok.length ? prevCa / pok.length : 0,
    units,
    buyers: new Set(ok.map((o) => normPhone(o.phone))).size,
    cancelRate: all.length ? cancelledCount / all.length : 0,
    cancelledCount,
    bars,
    byCategory: group(ok, (o) => o.items.map((i) => [catOf.get(i.pid) ?? "autre", i.qty * i.price])),
    byPay: group(ok, (o) => [[o.pay, 1]]),
    byZone: group(ok, (o) => [[o.zone, o.total]]),
    topRev: [...byProduct.values()].sort((a, b) => b.rev - a.rev).slice(0, 6),
    weekCounts,
  };
}
