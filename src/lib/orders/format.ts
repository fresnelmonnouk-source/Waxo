import { normPhone, prettyPhone } from "@/lib/auth/validation";
import { fmtXof } from "@/lib/money";
import type { AdminOrder, Courier, PayMethod, Zone } from "./types";

export { normPhone, prettyPhone, fmtXof };

export const PAY_LABEL: Record<PayMethod, string> = {
  momo: "MTN MoMo",
  moov: "Moov Money",
  celtiis: "Celtiis Cash",
  carte: "Carte bancaire",
  cod: "Paiement à la livraison",
};
export const ZONE_LABEL: Record<Zone, string> = { cotonou: "Cotonou & Calavi", autre: "Autres villes du Bénin" };
export const ZONE_SHORT: Record<Zone, string> = { cotonou: "Cotonou & Calavi", autre: "Autres villes" };

/** « 3 commandes » / « 1 commande » (maquette : plural). */
export function plural(n: number, one: string, many: string): string {
  return n.toLocaleString("fr-FR") + " " + (n > 1 ? many : one);
}

/** Fuseau fixe du Bénin : rendu identique côté serveur et navigateur (pas de décalage d'hydratation). */
export const TZ = "Africa/Porto-Novo";

export const DATE_SHORT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
export const DATE_LONG: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
};
export const DATE_DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };

export function fmtDate(value: string | number | Date | null | undefined, opts: Intl.DateTimeFormatOptions = DATE_DAY): string {
  if (value === null || value === undefined || value === "") return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { ...opts, timeZone: TZ });
}

/** Minuit (heure du Bénin, UTC+1, sans heure d'été) du jour contenant `now`, en ms epoch. */
export function startOfDayBenin(now: number): number {
  const H = 3_600_000;
  const D = 86_400_000;
  return Math.floor((now + H) / D) * D - H;
}

export function initials(name: string, max = 2): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, max)
    .toUpperCase();
}

export const telLink = (phone: string) => `tel:+229${normPhone(phone)}`;
export const waBase = (phone: string) => `https://wa.me/229${normPhone(phone)}`;
export const waLink = (phone: string, text: string) => `${waBase(phone)}?text=${encodeURIComponent(text)}`;

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

/** Message WhatsApp « Prévenir le client » du tiroir détail. */
export function orderStatusMessage(o: Pick<AdminOrder, "name" | "number" | "total">, statusLabel: string): string {
  return `Bonjour ${firstName(o.name)}, ici Wá xɔ. Votre commande ${o.number} (${fmtXof(o.total)}) est ${statusLabel.toLowerCase()}.`;
}

/** Message WhatsApp « Prévenir le client » de l'onglet livraisons (commande en route). */
export function onRoadMessage(
  o: Pick<AdminOrder, "name" | "number" | "total" | "pay" | "paid">,
  courier: Pick<Courier, "name" | "phone"> | undefined,
): string {
  const who = courier ? ` avec ${firstName(courier.name)} (${prettyPhone(courier.phone)})` : "";
  const cod = o.pay === "cod" && !o.paid ? ` Montant à régler : ${fmtXof(o.total)}.` : "";
  return `Bonjour ${firstName(o.name)}, votre commande ${o.number} est en route${who}.${cod}`;
}

/** Montant restant à encaisser pour une commande (paiement à la livraison non encore payé). */
export const codDue = (o: Pick<AdminOrder, "pay" | "paid" | "total">) => (o.pay === "cod" && !o.paid ? o.total : 0);

/** Tournée envoyée au livreur sur WhatsApp : adresses, téléphones et montants à encaisser. */
export function tourMessage(mine: AdminOrder[], now: number): string {
  const day = fmtDate(now, { weekday: "long", day: "numeric", month: "long" });
  const cod = mine.reduce((a, o) => a + codDue(o), 0);
  const lines = mine.map(
    (o, i) =>
      `${i + 1}. ${o.number} · ${o.name} · ${prettyPhone(o.phone)} · ${o.address}` +
      (codDue(o) ? ` · À encaisser ${fmtXof(o.total)}` : " · Déjà payée"),
  );
  return (
    `Tournée Wá xɔ du ${day} : ${plural(mine.length, "livraison", "livraisons")}\n` +
    lines.join("\n") +
    (cod ? `\nTotal à encaisser : ${fmtXof(cod)}` : "")
  );
}
