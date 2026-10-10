// Normalisation et validation des contacts (pur, utilisable côté client ET serveur).
// Règles de la maquette (waxo-data.js) : numéro béninois à 10 chiffres commençant par 01, indicatif +229 toléré.

export const digits = (s: unknown): string => String(s ?? "").replace(/\D/g, "");

/**
 * UNE SEULE implémentation (checkout, compte, suivi, newsletter la réutilisent : QA-3).
 * « +229 01 97 00 00 00 » / « 00229… » / « 229… » → « 0197000000 ». Les autres formats sont rendus tels quels (chiffres seuls).
 */
export function normPhone(s: unknown): string {
  let d = digits(s);
  if (d.length === 15 && d.startsWith("00229")) d = d.slice(5);
  else if (d.length === 13 && d.startsWith("229")) d = d.slice(3);
  return d;
}

export const validPhone = (s: unknown): boolean => /^01\d{8}$/.test(normPhone(s));

/** « 0197000000 » → « 01 97 00 00 00 ». */
export const prettyPhone = (s: unknown): string => normPhone(s).replace(/(\d{2})(?=\d)/g, "$1 ");

export const validEmail = (s: unknown): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s ?? "").trim());
