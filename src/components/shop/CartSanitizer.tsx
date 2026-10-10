"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { cart, useCartLines } from "@/lib/cart/store";
import { shopToast } from "./toast";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Retire du panier les articles qui n'existent plus au catalogue (QA-8) : typiquement les ids de démonstration
 * (« lampe », « air »…) restés dans le navigateur après le branchement de la vraie base — la commande serait refusée à chaque
 * essai sans dire quel article retirer. Aucune requête en production courante : seuls les ids qui ne ressemblent PAS à un
 * UUID sont vérifiés (côté serveur : « absent du catalogue » ET « pas un UUID », jamais le contraire — une base lente qui
 * retombe sur la démo ne doit pas vider le panier d'un vrai client). Monté une fois dans la coque.
 */
export function CartSanitizer() {
  const lines = useCartLines();
  const locale = useLocale();
  const suspects = lines
    .filter((l) => !UUID.test(l.id))
    .map((l) => l.id)
    .sort()
    .join(",");

  useEffect(() => {
    if (!suspects) return;
    const ctrl = new AbortController();
    fetch(`/api/checkout/config?lang=${locale === "en" ? "en" : "fr"}&ids=${encodeURIComponent(suspects)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j: { ok?: boolean; stale?: unknown }) => {
        if (!j.ok || !Array.isArray(j.stale)) return;
        const stale = j.stale.filter((x): x is string => typeof x === "string");
        if (stale.length === 0) return;
        cart.removeMany(stale);
        shopToast.show({ kind: "staleRemoved" }, 5000);
      })
      .catch(() => {
        /* hors ligne : on réessaiera au prochain changement du panier */
      });
    return () => ctrl.abort();
  }, [suspects, locale]);

  return null;
}
