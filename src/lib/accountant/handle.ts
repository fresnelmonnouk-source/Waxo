// Orchestration pure du Comptable IA : message → intention → (écriture éventuelle) → réponse calculée.
// Les écritures sont injectées (testables sans base). Le LLM n'intervient jamais ici.
import { fmtXof } from "@/lib/money";
import {
  accountFor, answerAds, answerAdvice, answerCompare, answerExpenses, answerHelp, answerMargin, answerMissingCosts, answerSummary, answerTopProducts,
  beninDate, isMonthKey, prevMonthKey,
} from "./engine";
import { matchProduct, monthFromText, norm, parseIntent } from "./intent";
import { EXPENSE_LABELS } from "./types";
import type { AccountantData, ExpenseCat } from "./types";

export type WriteResult = { ok: true } | { ok: false; code: string; message: string };
export type Writers = {
  addEntry(e: { date: string; cat: ExpenseCat; label: string; amount: number }): Promise<WriteResult>;
  setCost(productId: string, cost: number): Promise<WriteResult>;
};
export type HandleResult = {
  reply: string;
  notes: string[];
  changed: boolean;
  /** true = la réponse n'est que des chiffres calculés : le LLM peut la reformuler. */
  rephrasable: boolean;
};

const SHORT_MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${SHORT_MONTHS[m - 1] ?? ""}`;
}

const DEMO_MSG = "Base non connectée (mode démo) : rien n'a été enregistré.";

export async function handleMessage(args: { text: string; month?: string; data: AccountantData; now: number; writers: Writers }): Promise<HandleResult> {
  const { text, data, now, writers } = args;
  const nowKey = beninDate(now).slice(0, 7);
  const intent = parseIntent(text, now);

  if (intent.kind === "add_expense") {
    const r = await writers.addEntry({ date: intent.date, cat: intent.cat, label: intent.label, amount: intent.amount });
    if (!r.ok) {
      return { reply: r.code === "unavailable" ? DEMO_MSG : `Je n'ai pas pu enregistrer cette écriture : ${r.message}`, notes: [], changed: false, rephrasable: false };
    }
    return {
      reply: "C'est noté dans le carnet de bord.",
      notes: [`${EXPENSE_LABELS[intent.cat]} · ${intent.label} · ${fmtXof(intent.amount)} (${shortDate(intent.date)})`],
      changed: true,
      rephrasable: false,
    };
  }

  if (intent.kind === "set_cost") {
    const p = matchProduct(intent.query, data.products);
    if (!p) {
      return { reply: "Je n'ai pas trouvé de quel produit il s'agit. Précisez son nom, par exemple « prix d'achat lampe 4 500 F ».", notes: [], changed: false, rephrasable: false };
    }
    const r = await writers.setCost(p.id, intent.amount);
    if (!r.ok) {
      return { reply: r.code === "unavailable" ? DEMO_MSG : `Je n'ai pas pu enregistrer ce prix d'achat : ${r.message}`, notes: [], changed: false, rephrasable: false };
    }
    const warn = p.price && intent.amount >= p.price ? ` Attention : ce prix d'achat est supérieur ou égal au prix de vente (${fmtXof(p.price)}), la marge est nulle ou négative.` : "";
    return { reply: `C'est enregistré.${warn}`, notes: [`Prix d'achat · ${p.name} · ${fmtXof(intent.amount)}`], changed: true, rephrasable: false };
  }

  const s = norm(text);
  const asked = monthFromText(s, nowKey);
  const key = asked ?? (isMonthKey(args.month) ? args.month : nowKey);
  const cur = accountFor(data, key);
  const prevKey = prevMonthKey(key);

  let answer: { text: string };
  switch (intent.kind) {
    case "ads": answer = answerAds(cur); break;
    case "margin": answer = answerMargin(cur); break;
    case "top": answer = answerTopProducts(cur); break;
    case "expenses": answer = answerExpenses(cur); break;
    case "compare": answer = answerCompare(cur, accountFor(data, prevKey), key === nowKey); break;
    case "advice": answer = answerAdvice(cur, accountFor(data, prevKey)); break;
    case "missing": answer = answerMissingCosts(cur, data.products); break;
    case "help": answer = answerHelp(); break;
    default: answer = answerSummary(cur);
  }
  return { reply: answer.text, notes: [], changed: false, rephrasable: intent.kind !== "help" };
}
