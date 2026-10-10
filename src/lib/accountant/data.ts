import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLedgerRows } from "@/lib/admin/data/ledger";
import adminDemo from "@/lib/demo/admin.json";
import catalogDemo from "@/lib/demo/catalog.json";
import { beninDate } from "./engine";
import { EXPENSE_CATS } from "./types";
import type { AccountantData, ExpenseCat, LedgerRow, OrderLite, ProductLite } from "./types";
import type { WriteResult, Writers } from "./handle";

const PAGE = 200;
const MAX_PAGES = 5; // ≤ 1 000 commandes sur la fenêtre chargée
const WINDOW_DAYS = 130; // ~4 mois : mois courant + 3 précédents
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function hasDb(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// ── Repli démo (aucune écriture) ──
type DemoOrder = { date: string; status: string; sub: number; ship: number; items: { pid: string; name: string; price: number; qty: number }[] };
type DemoProduct = { id: string; price: number; fr: { name: string } };

function demoData(ledger: LedgerRow[]): AccountantData {
  const orders: OrderLite[] = (adminDemo.orders as DemoOrder[]).map((o) => ({
    date: o.date,
    status: o.status,
    sub: o.sub,
    ship: o.ship,
    items: o.items.map((i) => ({ pid: i.pid, name: i.name, price: i.price, qty: i.qty })),
  }));
  const costs = adminDemo.cost as Record<string, number>;
  const products: ProductLite[] = (catalogDemo.products as DemoProduct[]).map((p) => ({ id: p.id, name: p.fr.name, price: p.price, cost: costs[p.id] ?? null }));
  return { orders, products, ledger };
}

type Rel<T> = T | T[] | null;
const one = <T>(r: Rel<T>): T | null => (Array.isArray(r) ? r[0] ?? null : r);

async function loadFromDb(ledger: LedgerRow[]): Promise<AccountantData | null> {
  try {
    const db = createAdminClient();
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
    const orders: OrderLite[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data, error } = await db
        .from("orders")
        .select("created_at,status,subtotal,shipping_fee,order_items(product_id,name,unit_price,qty)")
        .gte("created_at", since)
        .neq("status", "annulee")
        .order("created_at", { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) return null;
      type Row = { created_at: string; status: string; subtotal: number; shipping_fee: number; order_items: { product_id: string | null; name: string; unit_price: number; qty: number }[] | null };
      for (const o of (data ?? []) as unknown as Row[]) {
        orders.push({
          date: o.created_at,
          status: o.status,
          sub: o.subtotal,
          ship: o.shipping_fee,
          items: (o.order_items ?? []).map((i) => ({ pid: i.product_id, name: i.name, price: i.unit_price, qty: i.qty })),
        });
      }
      if ((data?.length ?? 0) < PAGE) break;
    }
    const { data: prods, error: pe } = await db
      .from("products")
      .select("id,price,product_translations(locale,name),product_costs(cost)")
      .limit(PAGE);
    if (pe) return null;
    type PRow = { id: string; price: number; product_translations: { locale: string; name: string }[] | null; product_costs: Rel<{ cost: number }> };
    const products: ProductLite[] = ((prods ?? []) as unknown as PRow[]).map((p) => {
      const tr = p.product_translations ?? [];
      return { id: p.id, name: (tr.find((t) => t.locale === "fr") ?? tr[0])?.name ?? "Produit", price: p.price, cost: one(p.product_costs)?.cost ?? null };
    });
    return { orders, products, ledger };
  } catch {
    return null;
  }
}

/** Données du comptable : base si disponible, sinon démo. Aucune donnée personnelle de client n'est lue. */
export async function loadAccountantData(): Promise<{ data: AccountantData; demo: boolean }> {
  const ledger = await getLedgerRows().catch(() => [] as LedgerRow[]);
  if (hasDb()) {
    const real = await loadFromDb(ledger);
    if (real) return { data: real, demo: false };
  }
  return { data: demoData(ledger), demo: true };
}

const UNAVAILABLE: WriteResult = { ok: false, code: "unavailable", message: "Base non connectée (mode démo)" };
const FAILED: WriteResult = { ok: false, code: "write_failed", message: "l'enregistrement a échoué, réessayez." };

/** Écritures du comptable (service_role, après `assertAdmin()` dans la route). Montants et champs revalidés ici. */
export function dbWriters(): Writers {
  return {
    async addEntry(e: { date: string; cat: ExpenseCat; label: string; amount: number }): Promise<WriteResult> {
      if (!hasDb()) return UNAVAILABLE;
      if (!EXPENSE_CATS.includes(e.cat) || !Number.isInteger(e.amount) || e.amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(e.date) || e.date > beninDate(Date.now(), 1)) {
        return { ok: false, code: "invalid", message: "vérifiez le montant et la date." };
      }
      try {
        const { error } = await createAdminClient().from("ledger").insert({ date: e.date, cat: e.cat, label: e.label.slice(0, 120), amount: e.amount });
        return error ? FAILED : { ok: true };
      } catch {
        return FAILED;
      }
    },
    async setCost(productId: string, cost: number): Promise<WriteResult> {
      if (!hasDb()) return UNAVAILABLE;
      if (!UUID.test(productId) || !Number.isInteger(cost) || cost <= 0) return { ok: false, code: "invalid", message: "produit ou prix invalide." };
      try {
        const { error } = await createAdminClient().from("product_costs").upsert({ product_id: productId, cost }, { onConflict: "product_id" });
        return error ? FAILED : { ok: true };
      } catch {
        return FAILED;
      }
    },
  };
}

/** Écritures désactivées (tests / mode lecture). */
export const noWriters: Writers = { addEntry: async () => UNAVAILABLE, setCost: async () => UNAVAILABLE };
