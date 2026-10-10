// Carnet de comptes : compte de résultat mensuel, marges, export CSV (maquette `acct`, `ledgerVals`, `exportLedger`). Fonctions pures, testées.
import { EXPENSE_CATS, EXPENSE_IDS, isExpenseCat, type ExpenseCatId } from "@/lib/admin/ui/constants";
import type { LedgerEntry, StatOrder, StatProduct } from "./types";
import { isDayKey, monthKeyOf, monthKeyOfDate, parseTs } from "./time";

export type ProductMargin = { pid: string; name: string; qty: number; rev: number; margin: number };

export type MonthAccount = {
  key: string;
  orders: number;
  units: number;
  /** Ventes de produits (hors livraison). */
  sales: number;
  /** Frais de livraison facturés. */
  shipF: number;
  /** Chiffre d'affaires = ventes + livraison. */
  ca: number;
  /** Coût d'achat des produits vendus. */
  cogs: number;
  gross: number;
  grossPct: number;
  /** Dépenses par catégorie (toutes catégories présentes, 0 par défaut). */
  exp: Record<ExpenseCatId, number>;
  /** Charges hors achats de stock. */
  opex: number;
  net: number;
  stockBuy: number;
  /** Ventes produits ÷ dépenses pub (null sans dépense pub). */
  roas: number | null;
  /** Noms des produits vendus sans prix d'achat connu. */
  missing: string[];
  byProduct: ProductMargin[];
  entries: LedgerEntry[];
};

/** Mois présents dans les commandes et le carnet, du plus récent au plus ancien (le mois courant est toujours là). */
export function listMonths(orders: StatOrder[], ledger: LedgerEntry[], now: number): string[] {
  const set = new Set<string>([monthKeyOf(now)]);
  for (const o of orders) set.add(monthKeyOf(parseTs(o.date)));
  for (const l of ledger) set.add(monthKeyOfDate(l.date));
  return [...set].sort().reverse();
}

export function computeAccount(key: string, orders: StatOrder[], products: StatProduct[], ledger: LedgerEntry[]): MonthAccount {
  const byId = new Map(products.map((p) => [p.id, p]));
  const os = orders.filter((o) => o.status !== "annulee" && monthKeyOf(parseTs(o.date)) === key);
  let sales = 0;
  let shipF = 0;
  let cogs = 0;
  let units = 0;
  const missing = new Set<string>();
  const byP = new Map<string, ProductMargin>();
  for (const o of os) {
    sales += o.sub;
    shipF += o.ship;
    for (const i of o.items) {
      const p = byId.get(i.pid);
      const cost = p ? p.cost : (i.cost ?? null);
      units += i.qty;
      if (cost == null) missing.add(i.name);
      else cogs += cost * i.qty;
      const b = byP.get(i.pid) ?? { pid: i.pid, name: i.name, qty: 0, rev: 0, margin: 0 };
      b.qty += i.qty;
      b.rev += i.price * i.qty;
      b.margin += (i.price - (cost ?? 0)) * i.qty;
      byP.set(i.pid, b);
    }
  }
  const exp = Object.fromEntries(EXPENSE_IDS.map((k) => [k, 0])) as Record<ExpenseCatId, number>;
  const entries = ledger.filter((l) => monthKeyOfDate(l.date) === key);
  for (const l of entries) exp[l.cat] += l.amount;
  const ca = sales + shipF;
  const gross = ca - cogs;
  const opex = EXPENSE_IDS.filter((k) => k !== "stock").reduce((a, k) => a + exp[k], 0);
  return {
    key,
    orders: os.length,
    units,
    sales,
    shipF,
    ca,
    cogs,
    gross,
    grossPct: ca ? gross / ca : 0,
    exp,
    opex,
    net: gross - opex,
    stockBuy: exp.stock,
    roas: exp.pub ? sales / exp.pub : null,
    missing: [...missing],
    byProduct: [...byP.values()].sort((a, b) => b.margin - a.margin),
    entries,
  };
}

/** Taux de marge d'un produit (null si prix d'achat ou de vente inconnu). */
export function marginRate(price: number, cost: number | null): number | null {
  return cost != null && price ? (price - cost) / price : null;
}

/** Seuil de rentabilité de la pub : 1 ÷ taux de marge brute (borné pour éviter la division par ~0). */
export function adBreakEven(grossPct: number): number {
  return 1 / Math.max(0.01, grossPct);
}

// ───────────────────────── Saisie d'une écriture ─────────────────────────
export type EntryInput = { date: string; cat: ExpenseCatId; label: string; amount: number };
export type EntryCheck = { ok: true; value: EntryInput } | { ok: false; field: "amount" | "label" | "date" | "cat"; message: string };

/** Montant saisi (« 15 000 », « 15000 F ») → entier ≥ 0 ; chaîne sans chiffre → 0. */
export function parseAmount(raw: string | number): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
  const d = raw.replace(/\D/g, "");
  return d ? Math.min(parseInt(d, 10), 2_000_000_000) : 0;
}

/** Validation d'une écriture (mêmes règles que la maquette : montant > 0, libellé ≥ 2 caractères) + bornes de sécurité. */
export function checkEntry(raw: { date?: unknown; cat?: unknown; label?: unknown; amount?: unknown }, today: string): EntryCheck {
  const amount = parseAmount(typeof raw.amount === "number" || typeof raw.amount === "string" ? raw.amount : "");
  if (!(amount > 0)) return { ok: false, field: "amount", message: "Indiquez un montant." };
  const label = typeof raw.label === "string" ? raw.label.trim().replace(/\s+/g, " ") : "";
  if (label.length < 2) return { ok: false, field: "label", message: "Indiquez un libellé." };
  if (label.length > 120) return { ok: false, field: "label", message: "Libellé trop long (120 caractères au maximum)." };
  const date = typeof raw.date === "string" && raw.date ? raw.date : today;
  if (!isDayKey(date)) return { ok: false, field: "date", message: "Date invalide." };
  if (!isExpenseCat(raw.cat)) return { ok: false, field: "cat", message: "Catégorie inconnue." };
  return { ok: true, value: { date, cat: raw.cat, label, amount } };
}

// ───────────────────────── Export CSV ─────────────────────────
/** Cellule CSV : guillemets doublés, et neutralisation des formules (= + - @ tabulation retour) par une apostrophe. */
export function csvCell(v: string | number): string {
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
/** CSV UTF-8 avec BOM, séparateur « ; », fins de ligne CRLF. */
export function toCsv(rows: (string | number)[][]): string {
  return "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}
export function ledgerCsv(entries: LedgerEntry[]): string {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  return toCsv([
    ["Date", "Catégorie", "Libellé", "Montant (F)"],
    ...sorted.map((l) => [l.date, EXPENSE_CATS[l.cat][0], l.label, l.amount]),
  ]);
}
