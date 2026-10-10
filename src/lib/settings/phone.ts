// Téléphones : fonctions pures (client + serveur). Format interne boutique = 10 chiffres locaux « 01XXXXXXXX » (Bénin).

export const digits = (s: unknown): string => String(s ?? "").replace(/\D/g, "");

/** Retire l'indicatif 229 d'un numéro complet de 13 chiffres ; sinon renvoie les chiffres tels quels. */
export function normPhone(s: unknown): string {
  const d = digits(s);
  return d.length === 13 && d.startsWith("229") ? d.slice(3) : d;
}

/** « 0196554433 » → « 01 96 55 44 33 » */
export function prettyPhone(s: unknown): string {
  return normPhone(s).replace(/(\d{2})(?=\d)/g, "$1 ");
}

export const validEmail = (s: unknown): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s ?? "").trim());

export type NormalizedWhatsapp = { display: string; waNumber: string };

/**
 * Normalise un numéro WhatsApp saisi par l'admin.
 * - Bénin (par défaut) : 10 chiffres « 01… », 8 chiffres (ancien format, « 01 » ajouté) ou 13 chiffres « 229… »
 *   → affichage « +229 01 XX XX XX XX », `waNumber` = « 229… » (13 chiffres, utilisable dans wa.me).
 * - Autre pays : saisie commençant par « + » (ou « 00 ») suivie de 8 à 15 chiffres → conservée telle quelle.
 * Renvoie null si invalide.
 */
export function normalizeWhatsapp(input: unknown): NormalizedWhatsapp | null {
  const raw = String(input ?? "").trim();
  if (!raw || raw.length > 40) return null;
  const international = /^(\+|00)/.test(raw);
  let d = digits(raw);
  if (raw.startsWith("00")) d = d.replace(/^00/, "");
  if (international && !d.startsWith("229")) {
    if (d.length < 8 || d.length > 15) return null;
    return { display: "+" + d, waNumber: d };
  }
  if (d.startsWith("229") && d.length === 13) d = d.slice(3);
  else if (d.length === 8) d = "01" + d;
  if (!/^01\d{8}$/.test(d)) return null;
  return { display: "+229 " + prettyPhone(d), waNumber: "229" + d };
}
