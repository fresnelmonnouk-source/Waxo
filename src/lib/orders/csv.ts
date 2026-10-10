// Export CSV : UTF-8 avec BOM, séparateur « ; », cellules entre guillemets.
// Neutralise l'injection de formule (Excel/Sheets) : toute chaîne commençant par = + - @ (ou tab / retour chariot)
// est préfixée d'une apostrophe.

export type CsvValue = string | number | boolean | null | undefined;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '""';
  let s: string;
  if (typeof value === "number") s = Number.isFinite(value) ? String(value) : "";
  else if (typeof value === "boolean") s = value ? "oui" : "non";
  else {
    s = String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  }
  return '"' + s.replace(/"/g, '""') + '"';
}

export function toCsv(rows: CsvValue[][]): string {
  return "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}
