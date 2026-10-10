// Export CSV : UTF-8 avec BOM, séparateur « ; », neutralisation de l'injection de formule (=, +, -, @, tab, retour chariot).

export const CSV_BOM = "\uFEFF";

export function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[";\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCsv(rows: unknown[][]): string {
  return CSV_BOM + rows.map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}
