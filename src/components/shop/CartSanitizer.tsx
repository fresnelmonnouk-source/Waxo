"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { cart, useCartLines } from "@/lib/cart/store";
import { shopToast } from "./toast";

/**
 * Retire du panier les articles qui n'existent plus au catalogue (QA-8) : typiquement les ids de démonstration
 * (« lampe », « air »…) restés dans le navigateur après le branchement de la vraie base (la commande serait refusée à chaque
 * essai sans dire quel article retirer), et aligne les prix affichés sur les prix courants (campagnes). Une requête par
 * changement du panier, mise en cache 30 s. Le serveur ne déclare « périmé » qu'un id non-UUID (côté serveur : « absent du catalogue » ET « pas un UUID », jamais le contraire — une base lente qui
 * retombe sur la démo ne doit pas vider le panier d'un vrai client). Monté une fois dans la coque.
 */
export function CartSanitizer() {
  const lines = useCartLines();
  const locale = useLocale();
  // Tous les articles du panier : restes de démo (id non-UUID) à retirer, packs (si désactivés depuis l'admin) et
  // prix courants (une campagne qui commence ou finit change le prix affiché ; le serveur facture toujours le bon prix).
  const packIds = lines.filter((l) => l.kind === "pack").map((l) => l.id);
  const suspects = [...new Set(lines.map((l) => l.id))].sort().join(",");
  const packKey = packIds.join(",");

  useEffect(() => {
    if (!suspects) return;
    const ctrl = new AbortController();
    fetch(`/api/checkout/config?lang=${locale === "en" ? "en" : "fr"}&ids=${encodeURIComponent(suspects)}`, { signal: ctrl.signal })
      .then((r) => r.json())
            .then((j: { ok?: boolean; stale?: unknown; packsEnabled?: unknown; prices?: unknown }) => {
        if (!j.ok || !Array.isArray(j.stale)) return;
        if (j.prices && typeof j.prices === "object") cart.syncPrices(j.prices as Record<string, number>);
        const stale = j.stale.filter((x): x is string => typeof x === "string");
        if (j.packsEnabled === false && packKey) stale.push(...packKey.split(","));
        if (stale.length === 0) return;
        cart.removeMany(stale);
        shopToast.show({ kind: "staleRemoved" }, 5000);
      })
      .catch(() => {
        /* hors ligne : on réessaiera au prochain changement du panier */
      });
    return () => ctrl.abort();
  }, [suspects, packKey, locale]);

  return null;
}
