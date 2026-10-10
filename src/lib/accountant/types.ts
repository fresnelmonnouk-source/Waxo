// Types partagés du Comptable IA (aucune dépendance serveur : importable côté client et en test).

export const EXPENSE_CATS = ["stock", "pub", "livraison", "emballage", "loyer", "salaire", "autre"] as const;
export type ExpenseCat = (typeof EXPENSE_CATS)[number];

/** Libellés des catégories (identiques à `expenseCats` de la maquette / admin.json). */
export const EXPENSE_LABELS: Record<ExpenseCat, string> = {
  stock: "Achat de stock",
  pub: "Publicité",
  livraison: "Livraison",
  emballage: "Emballage",
  loyer: "Loyer et charges",
  salaire: "Salaires",
  autre: "Autre",
};

/** Ligne du carnet : contrat `getLedgerRows()` (A2). */
export type LedgerRow = { id: string; date: string; cat: string; label: string; amount: number };

export type OrderItemLite = { pid: string | null; name: string; price: number; qty: number };
/** Commande réduite à ce qui sert aux comptes. Aucune donnée personnelle de client. */
export type OrderLite = {
  date: string;
  status: string;
  sub: number;
  ship: number;
  items: OrderItemLite[];
};
export type ProductLite = { id: string; name: string; price: number; cost: number | null };

export type AccountantData = { orders: OrderLite[]; products: ProductLite[]; ledger: LedgerRow[] };

/** Résultat comptable d'un mois (port de `acct()` de la maquette). */
export type MonthAccount = {
  key: string;
  orders: number;
  units: number;
  sales: number;
  shipF: number;
  ca: number;
  cogs: number;
  gross: number;
  grossPct: number;
  exp: Record<string, number>;
  opex: number;
  net: number;
  stockBuy: number;
  roas: number | null;
  missing: string[];
  byP: { pid: string; name: string; qty: number; rev: number; margin: number }[];
  entriesCount: number;
};

// ── Contrat de la route POST /api/admin/accountant ──
export type AccountantRequest = {
  messages: { role: "user" | "assistant"; text: string }[];
  /** Mois affiché dans le carnet (AAAA-MM), optionnel. */
  month?: string;
};
export type AccountantResponse =
  | { ok: true; reply: string; notes: string[]; changed: boolean; mode: "deterministic" | "llm" }
  | { ok: false; code: string; message: string };
