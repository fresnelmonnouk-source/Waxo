import "server-only";
import adminDemo from "@/lib/demo/admin.json";
import { createAdminClient } from "@/lib/supabase/admin";
import { isExpenseCat } from "@/lib/admin/ui/constants";
import { computeAccount, isMonthKey, listMonths, marginRate, type LedgerEntry, type MonthAccount } from "@/lib/stats";
import { monthKeyOf } from "@/lib/stats/time";
import { fetchAll, hasAdminDb, loadStatInputs, type DataSource } from "./stats";

type LedgerRow = { id: string; date: string; cat: string; label: string; amount: number };

function toEntries(rows: LedgerRow[]): LedgerEntry[] {
  return rows
    .filter((r) => isExpenseCat(r.cat))
    .map((r) => ({ id: r.id, date: r.date, cat: r.cat as LedgerEntry["cat"], label: r.label, amount: r.amount }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Toutes les écritures du carnet (plus récentes d'abord) + origine des données. Ne jette jamais. */
export async function loadLedger(): Promise<{ source: DataSource; entries: LedgerEntry[] }> {
  if (!hasAdminDb()) return { source: "demo", entries: toEntries(adminDemo.ledger as LedgerRow[]) };
  try {
    const sb = createAdminClient();
    const rows = await fetchAll<LedgerRow>(
      (a, b) =>
        sb.from("ledger").select("id, date, cat, label, amount").order("date", { ascending: false }).order("id").range(a, b) as unknown as PromiseLike<{
          data: LedgerRow[] | null;
          error: unknown;
        }>,
    );
    return { source: "db", entries: toEntries(rows) };
  } catch {
    return { source: "error", entries: [] };
  }
}

/**
 * CONTRAT avec l'agent « comptable IA » (src/lib/accountant) : écritures du carnet.
 * Signature figée : Promise<{ id; date; cat; label; amount }[]> (date = « AAAA-MM-JJ », montants XOF entiers).
 */
export async function getLedgerRows(): Promise<{ id: string; date: string; cat: string; label: string; amount: number }[]> {
  return (await loadLedger()).entries;
}

export type CostRow = {
  id: string;
  name: string;
  price: number;
  cost: number | null;
  soldInMonth: number;
  margin: number | null;
};

export type LedgerPageData = {
  source: DataSource;
  months: string[];
  key: string;
  account: MonthAccount;
  costRows: CostRow[];
};

/** Données de la page Carnet pour un mois donné (`?mois=AAAA-MM`, repli : mois le plus récent). Ne jette jamais. */
export async function getLedgerPage(monthParam: string | undefined, now: number = Date.now()): Promise<LedgerPageData> {
  const [inputs, ledger] = await Promise.all([loadStatInputs(now), loadLedger()]);
  const source: DataSource = inputs.source === "error" || ledger.source === "error" ? "error" : inputs.source;
  const months = listMonths(inputs.orders, ledger.entries, now);
  const key = isMonthKey(monthParam) && months.includes(monthParam) ? monthParam : (months[0] ?? monthKeyOf(now));
  const account = computeAccount(key, inputs.orders, inputs.products, ledger.entries);
  const soldBy = new Map(account.byProduct.map((b) => [b.pid, b.qty]));
  const costRows = [...inputs.products]
    .sort((x, y) => (soldBy.get(y.id) ?? 0) - (soldBy.get(x.id) ?? 0) || y.sold - x.sold)
    .map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      cost: p.cost,
      soldInMonth: soldBy.get(p.id) ?? 0,
      margin: marginRate(p.price, p.cost),
    }));
  return { source, months, key, account, costRows };
}
