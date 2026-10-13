import { NotFoundBody } from "./_status/NotFoundBody";

/**
 * 404 sous `[lang]` hors de la boutique (rare : la boutique a sa propre 404 avec en-tête et pied de page,
 * `(shop)/not-found.tsx`). Rendue dans le layout de langue : `<html lang>` correct, statut 404 conservé.
 */
export default function NotFound() {
  return <NotFoundBody />;
}
