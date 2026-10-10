// Calculs comptables PURS (jamais de LLM ici) : résultat mensuel, comparaison mois sur mois, réponses en français.
// Port de `acct()` et `acFallback()` de la maquette « Waxo Admin », étendu (comparaison, conseils).
import { fmtXof } from "@/lib/money";
import { EXPENSE_CATS, EXPENSE_LABELS } from "./types";
import type { AccountantData, MonthAccount } from "./types";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const BENIN_OFFSET_MS = 3_600_000; // Bénin = UTC+1, sans heure d'été

const pad = (n: number) => String(n).padStart(2, "0");

/** Date « AAAA-MM-JJ » à Cotonou pour un instant donné (+ décalage en jours). */
export function beninDate(now: number, dayOffset = 0): string {
  const d = new Date(now + BENIN_OFFSET_MS + dayOffset * 86_400_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Clé de mois « AAAA-MM » d'une date. Sans fuseau explicite (« 2026-10-08T09:41:00 », « 2026-10-08 ») : lue telle quelle. */
export function monthKeyOf(date: string): string {
  if (!date) return "";
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(date) && date.length > 10) {
    const t = Date.parse(date);
    if (!Number.isNaN(t)) return beninDate(t).slice(0, 7);
  }
  return /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : "";
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const name = MONTHS[Number(m) - 1];
  return name ? `${name} ${y}` : key;
}

export function prevMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
}

export const isMonthKey = (k: unknown): k is string => typeof k === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(k);

export function pct(v: number): string {
  return `${Math.round(v * 100)} %`;
}
const ratio = (v: number) => v.toFixed(1).replace(".", ",");
export const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/** Mois connus (courant + ceux qui ont des commandes ou des écritures), du plus récent au plus ancien. */
export function monthsOf(data: AccountantData, nowKey: string): string[] {
  const set = new Set<string>([nowKey]);
  for (const o of data.orders) {
    const k = monthKeyOf(o.date);
    if (k) set.add(k);
  }
  for (const l of data.ledger) {
    const k = monthKeyOf(l.date);
    if (k) set.add(k);
  }
  return [...set].sort().reverse();
}

/** Compte de résultat d'un mois. Les commandes annulées sont exclues. Coût manquant = produit signalé, marge surestimée. */
export function accountFor(data: AccountantData, key: string): MonthAccount {
  const costById = new Map(data.products.map((p) => [p.id, p.cost]));
  let sales = 0;
  let shipF = 0;
  let cogs = 0;
  let units = 0;
  let orders = 0;
  const missing = new Set<string>();
  const byP = new Map<string, { pid: string; name: string; qty: number; rev: number; margin: number }>();

  for (const o of data.orders) {
    if (o.status === "annulee" || monthKeyOf(o.date) !== key) continue;
    orders += 1;
    sales += o.sub;
    shipF += o.ship;
    for (const i of o.items) {
      const c = i.pid ? costById.get(i.pid) ?? null : null;
      units += i.qty;
      if (c == null) missing.add(i.name);
      else cogs += c * i.qty;
      const id = i.pid ?? `n:${i.name}`;
      const b = byP.get(id) ?? { pid: id, name: i.name, qty: 0, rev: 0, margin: 0 };
      b.qty += i.qty;
      b.rev += i.price * i.qty;
      b.margin += (i.price - (c ?? 0)) * i.qty;
      byP.set(id, b);
    }
  }

  const exp: Record<string, number> = {};
  for (const k of EXPENSE_CATS) exp[k] = 0;
  let entriesCount = 0;
  for (const l of data.ledger) {
    if (monthKeyOf(l.date) !== key) continue;
    entriesCount += 1;
    exp[l.cat] = (exp[l.cat] ?? 0) + l.amount;
  }
  const ca = sales + shipF;
  const gross = ca - cogs;
  const opex = Object.keys(exp)
    .filter((k) => k !== "stock")
    .reduce((a, k) => a + (exp[k] ?? 0), 0);
  return {
    key,
    orders,
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
    stockBuy: exp.stock ?? 0,
    roas: exp.pub ? sales / exp.pub : null,
    missing: [...missing],
    byP: [...byP.values()].sort((a, b) => b.margin - a.margin),
    entriesCount,
  };
}

// ───────────────────────── Réponses déterministes ─────────────────────────

export type Answer = { text: string };

function ml(a: MonthAccount): string {
  return monthLabel(a.key);
}

export function answerSummary(a: MonthAccount): Answer {
  let t = `${cap(ml(a))} : chiffre d'affaires ${fmtXof(a.ca)}, marge brute ${fmtXof(a.gross)} (${pct(a.grossPct)}), charges ${fmtXof(a.opex)}, résultat net ${fmtXof(a.net)}.`;
  if (a.missing.length) t += ` Il manque le prix d'achat de ${a.missing.length} produit${a.missing.length > 1 ? "s" : ""} : la marge est surestimée.`;
  return { text: t };
}

export function answerMargin(a: MonthAccount): Answer {
  if (!a.orders) return { text: `Aucune vente enregistrée en ${ml(a)} : pas de marge à calculer.` };
  let t = `En ${ml(a)}, la marge brute est de ${fmtXof(a.gross)} (${pct(a.grossPct)} du chiffre d'affaires de ${fmtXof(a.ca)}), après ${fmtXof(a.cogs)} de coût d'achat des produits vendus. Après ${fmtXof(a.opex)} de charges, le résultat net est de ${fmtXof(a.net)}.`;
  if (a.missing.length) t += ` Attention : le prix d'achat manque pour ${a.missing.slice(0, 3).join(", ")}${a.missing.length > 3 ? "…" : ""}, la marge est surestimée.`;
  return { text: t };
}

export function answerAds(a: MonthAccount): Answer {
  const pub = a.exp.pub ?? 0;
  if (!pub) return { text: `Aucune dépense de publicité enregistrée en ${ml(a)}.` };
  const be = 1 / Math.max(0.01, a.grossPct);
  const roas = a.roas ?? 0;
  const verdict = a.grossPct <= 0 ? "Sans marge brute positive, la pub ne peut pas être rentable pour l'instant." : roas > be ? "La publicité est donc rentable." : "La publicité n'est donc pas encore rentable : revoyez le ciblage ou le budget.";
  return {
    text: `En ${ml(a)}, ${fmtXof(pub)} de publicité pour ${fmtXof(a.sales)} de ventes produits : 1 F de pub pour ${ratio(roas)} F de ventes. Avec ${pct(a.grossPct)} de marge brute, la pub est rentable tant que ce ratio dépasse ${ratio(be)}. ${verdict}`,
  };
}

export function answerTopProducts(a: MonthAccount): Answer {
  const t3 = a.byP.slice(0, 3);
  if (!t3.length) return { text: `Pas encore de vente en ${ml(a)}.` };
  return {
    text: `En ${ml(a)}, vos produits les plus rentables sont : ${t3.map((b) => `${b.name} (${fmtXof(b.margin)} de marge)`).join(", ")}.`,
  };
}

export function answerExpenses(a: MonthAccount): Answer {
  const rows = EXPENSE_CATS.filter((k) => (a.exp[k] ?? 0) > 0).sort((x, y) => (a.exp[y] ?? 0) - (a.exp[x] ?? 0));
  if (!rows.length) return { text: `Aucune dépense enregistrée en ${ml(a)}.` };
  const total = rows.reduce((s, k) => s + (a.exp[k] ?? 0), 0);
  const list = rows.map((k) => `${EXPENSE_LABELS[k]} ${fmtXof(a.exp[k] ?? 0)}`).join(", ");
  const note = a.stockBuy ? ` Les achats de stock (${fmtXof(a.stockBuy)}) sortent de la trésorerie mais ne sont pas déduits du résultat : leur coût est compté au fil des ventes.` : "";
  return { text: `Dépenses en ${ml(a)} : ${fmtXof(total)} au total. ${list}.${note}` };
}

function evolution(cur: number, prev: number): string {
  if (!prev) return cur ? "nouveau" : "stable";
  const d = Math.round(((cur - prev) / Math.abs(prev)) * 100);
  return d === 0 ? "stable" : `${d > 0 ? "+" : "−"}${Math.abs(d)} %`;
}

export function answerCompare(cur: MonthAccount, prev: MonthAccount, partial: boolean): Answer {
  if (!prev.orders && !prev.entriesCount) return { text: `Pas de données en ${ml(prev)} : comparaison impossible avec ${ml(cur)}.` };
  const line = (label: string, c: number, p: number) => `${label} ${fmtXof(c)} contre ${fmtXof(p)} (${evolution(c, p)})`;
  const head = `${cap(ml(cur))} comparé à ${ml(prev)} : `;
  const body = [line("chiffre d'affaires", cur.ca, prev.ca), line("marge brute", cur.gross, prev.gross), line("charges", cur.opex, prev.opex), line("résultat net", cur.net, prev.net)].join(" ; ");
  const tail = partial ? ` Le mois de ${ml(cur)} n'est pas terminé : l'écart est à relativiser.` : "";
  return { text: `${head}${body}.${tail}` };
}

/** Conseils simples, uniquement à partir des chiffres calculés. */
export function answerAdvice(a: MonthAccount, prev: MonthAccount): Answer {
  const tips: string[] = [];
  if (a.missing.length) tips.push(`Saisissez le prix d'achat de ${a.missing.slice(0, 3).join(", ")}${a.missing.length > 3 ? "…" : ""} (tableau « Prix d'achat des produits ») : sans lui, la marge est surestimée.`);
  const pub = a.exp.pub ?? 0;
  if (pub && a.roas != null && a.grossPct > 0 && a.roas < 1 / a.grossPct) tips.push(`La publicité (${fmtXof(pub)}) ne couvre pas encore son coût : ${ratio(a.roas)} F de ventes par franc dépensé, il en faut plus de ${ratio(1 / a.grossPct)}. Réduisez ou recentrez le budget sur vos meilleurs produits.`);
  if (a.orders && a.net < 0) tips.push(`Le résultat est négatif (${fmtXof(a.net)}) : regardez d'abord les charges (${fmtXof(a.opex)}), puis les prix des produits à faible marge.`);
  const low = a.byP.filter((b) => b.rev > 0 && b.margin / b.rev < 0.3 && b.qty >= 1).sort((x, y) => y.rev - x.rev)[0];
  if (low) tips.push(`${low.name} se vend avec seulement ${pct(low.margin / low.rev)} de marge : un petit relèvement de prix ou un meilleur prix d'achat améliorerait le résultat.`);
  const top = a.byP[0];
  if (top && top.margin > 0) tips.push(`${top.name} est votre meilleur contributeur (${fmtXof(top.margin)} de marge) : gardez-le en stock et mettez-le en avant.`);
  if (prev.ca && a.ca < prev.ca * 0.8 && a.key !== prev.key) tips.push(`Le chiffre d'affaires recule par rapport à ${ml(prev)} : vérifiez si la pub ou le stock ont changé.`);
  if (!tips.length) tips.push("Rien d'alarmant dans les chiffres de ce mois. Continuez à noter chaque dépense pour garder des comptes fiables.");
  return { text: `Conseils pour ${ml(a)} : ${tips.slice(0, 3).join(" ")}` };
}

export function answerMissingCosts(a: MonthAccount, products: AccountantData["products"]): Answer {
  const none = products.filter((p) => p.cost == null).map((p) => p.name);
  if (!none.length && !a.missing.length) return { text: "Tous les prix d'achat sont renseignés : les marges sont complètes." };
  const names = (none.length ? none : a.missing).slice(0, 6).join(", ");
  return { text: `Prix d'achat manquant pour ${none.length || a.missing.length} produit${(none.length || a.missing.length) > 1 ? "s" : ""} : ${names}${(none.length || a.missing.length) > 6 ? "…" : ""}. Renseignez-les dans le tableau « Prix d'achat des produits », ou dites-moi par exemple « prix d'achat lampe 4 500 F ».` };
}

export function answerHelp(): Answer {
  return {
    text: "Je peux vous donner votre marge, la rentabilité de la pub, vos produits les plus rentables, vos dépenses par catégorie, comparer avec le mois précédent ou vous conseiller. Dites-moi aussi une dépense à noter, par exemple « J'ai payé 20 000 F de pub hier », ou un prix d'achat : « prix d'achat lampe 4 500 F ».",
  };
}
