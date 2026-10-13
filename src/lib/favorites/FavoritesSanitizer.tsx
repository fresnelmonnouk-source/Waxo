"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { favorites, staleFavoriteIds, useFavoriteIds } from "./store";

/** Plafond de GET /api/products (MAX_IDS) : au-delà, le reste est vérifié au passage suivant. */
const BATCH = 60;
/** Identifiants déjà confirmés par le catalogue pendant cette visite : ajouter un cœur ne relance pas toute la liste. */
const checked = new Set<string>();

/**
 * Retire des favoris les produits qui n'existent plus (audit Mia 4.7) : après la purge de la démo, les identifiants restés
 * dans le navigateur gonflaient le compteur de l'en-tête alors que la page /favoris était vide. Même principe que
 * CartSanitizer : monté une fois dans la coque, une requête par nouvel identifiant, rien n'est retiré si la réponse n'est
 * pas un succès (hors ligne, base injoignable → 502).
 */
export function FavoritesSanitizer() {
  const ids = useFavoriteIds();
  const locale = useLocale();
  const todo = ids.filter((id) => !checked.has(id)).slice(0, BATCH);
  const key = todo.join(",");

  useEffect(() => {
    if (!key) return;
    const asked = key.split(",");
    const ctrl = new AbortController();
    fetch(`/api/products?ids=${encodeURIComponent(key)}&lang=${locale === "en" ? "en" : "fr"}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { products?: unknown; error?: unknown } | null) => {
        if (!data || data.error || !Array.isArray(data.products)) return;
        const found = data.products
          .map((p) => (p && typeof p === "object" && typeof (p as { id?: unknown }).id === "string" ? (p as { id: string }).id : null))
          .filter((x): x is string => x !== null);
        found.forEach((id) => checked.add(id));
        const stale = staleFavoriteIds(asked, found);
        if (stale.length) favorites.removeMany(stale);
      })
      .catch(() => {
        /* hors ligne : nouvel essai au prochain changement des favoris */
      });
    return () => ctrl.abort();
  }, [key, locale]);

  return null;
}
