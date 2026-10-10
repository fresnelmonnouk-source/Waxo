// Calendrier du Bénin (WAT = UTC+1, sans heure d'été). Tout le bucketing jour/mois du back-office passe par ici,
// pour que serveur (UTC) et navigateur donnent les mêmes jours. Module pur.

export const WAT_OFFSET_MS = 3_600_000;
export const DAY_MS = 86_400_000;

/** Horloge injectable pour les rendus serveur (les composants ne doivent pas appeler Date.now() directement). */
export const nowMs = (): number => Date.now();

const HAS_TZ = /(Z|[+-]\d{2}:?\d{2})$/;

/** Timestamp (ms) d'une date. Les chaînes SANS fuseau (maquette, dates seules) sont lues en heure du Bénin. */
export function parseTs(v: string | number | Date): number {
  if (typeof v === "number") return v;
  if (v instanceof Date) return v.getTime();
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return Date.parse(`${s}T00:00:00+01:00`);
  if (!HAS_TZ.test(s)) return Date.parse(`${s.replace(" ", "T")}+01:00`);
  return Date.parse(s.replace(" ", "T"));
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Composantes calendaires en heure du Bénin. `wd` : 0 = lundi … 6 = dimanche. */
export function watParts(ts: number): { y: number; m: number; d: number; wd: number; h: number } {
  const x = new Date(ts + WAT_OFFSET_MS);
  return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate(), wd: (x.getUTCDay() + 6) % 7, h: x.getUTCHours() };
}
/** Minuit (heure du Bénin) du jour contenant `ts`. */
export function dayStart(ts: number): number {
  return Math.floor((ts + WAT_OFFSET_MS) / DAY_MS) * DAY_MS - WAT_OFFSET_MS;
}
/** « 2026-10 » du mois contenant `ts`. */
export function monthKeyOf(ts: number): string {
  const p = watParts(ts);
  return `${p.y}-${pad(p.m)}`;
}
/** « 2026-10-09 » (jour du Bénin). */
export function dayKeyOf(ts: number): string {
  const p = watParts(ts);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}
/** Mois (« AAAA-MM ») d'une date-chaîne d'écriture (« AAAA-MM-JJ ») ou d'un horodatage. */
export function monthKeyOfDate(v: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 7) : monthKeyOf(parseTs(v));
}
export const isMonthKey = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
export const isDayKey = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v;
};

const FR_FMT = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Lagos", ...opts });
/** Formatage français en heure du Bénin (équivalent du `fmtDate` de la maquette). */
export function fmtDate(v: string | number | Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }): string {
  const ts = parseTs(v);
  return Number.isFinite(ts) ? FR_FMT(opts).format(ts) : "";
}
