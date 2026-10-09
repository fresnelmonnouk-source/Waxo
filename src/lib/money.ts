// Montants en XOF (FCFA), entiers. Même rendu que la maquette : « 12 500 F » avec espace insécable avant F.
const NBSP = " ";

export function fmtXof(amount: number): string {
  return Math.round(amount || 0).toLocaleString("fr-FR") + NBSP + "F";
}

/** Pourcentage de réduction entre un prix barré et un prix actuel (arrondi). */
export function discountPercent(compare: number | null | undefined, price: number): number {
  if (!compare || compare <= price) return 0;
  return Math.round(((compare - price) / compare) * 100);
}
