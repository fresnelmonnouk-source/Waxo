// Formats d'affichage du back-office (fr-FR, fuseau du Bénin). Fonctions pures.
const TZ = "Africa/Porto-Novo";

function toDate(value: string | number | Date): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  let s = String(value);
  // Date-heure sans fuseau (données de démo) : heure locale du Bénin (UTC+1).
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)) s += "+01:00";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** « 7 octobre 2026 » */
export function fmtDateLong(value: string | number | Date): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: TZ }) : "";
}

/** « 7 oct., 10:12 » */
export function fmtDateShort(value: string | number | Date): string {
  const d = toDate(value);
  return d ? d.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ }) : "";
}

/** Pluriel simple : 1 → singulier, sinon pluriel ; nombre formaté fr-FR. */
export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString("fr-FR")} ${n > 1 ? many : one}`;
}
