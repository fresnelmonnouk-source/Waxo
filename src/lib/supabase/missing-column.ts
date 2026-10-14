// Colonne absente (migration pas encore appliquée) : Postgres 42703 « column does not exist », PostgREST PGRST204
// (« Could not find the 'x' column »). Module pur, sans dépendance.
export function isMissingColumn(e: { code?: string; message?: string } | null | undefined): boolean {
  return !!e && (e.code === "42703" || e.code === "PGRST204");
}
