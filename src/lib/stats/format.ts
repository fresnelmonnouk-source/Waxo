// Formats de texte communs aux écrans du back-office (maquette : plural, pctTxt, monthLabel, cap). Module pur.

export const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const WEEKDAYS_SHORT = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

export const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
/** Entier groupé à la française avec espace insécable (stable serveur/navigateur). */
export function nf(n: number): string {
  return Math.round(n)
    .toLocaleString("fr-FR")
    .replace(/[  ]/g, " ");
}
/** « 12 commandes » (singulier jusqu'à 1 inclus, comme la maquette : n > 1 → pluriel). */
export const plural = (n: number, one: string, many: string) => `${nf(n)} ${n > 1 ? many : one}`;
export const pctTxt = (v: number) => `${Math.round(v * 100)} %`;
/** Une décimale à virgule : 2,5 */
export const dec1 = (v: number) => v.toFixed(1).replace(".", ",");

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTHS[Number(m) - 1] ?? ""} ${y}`;
}
export const monthOnly = (key: string) => MONTHS[Number(key.split("-")[1]) - 1] ?? "";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.charAt(0) ?? "") + (parts[1]?.charAt(0) ?? "")).toUpperCase() || "A";
}
