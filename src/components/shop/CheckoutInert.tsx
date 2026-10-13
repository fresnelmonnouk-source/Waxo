"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";

/** Pages du tunnel : calque plein écran posé au-dessus de la coque de la boutique (CheckoutShell, `fixed inset-0`). */
export function isCheckoutPath(pathname: string): boolean {
  return pathname === "/commande" || pathname.startsWith("/commande/");
}

/**
 * Enveloppe une partie de la coque (bandeau, en-tête, newsletter, pied de page) et la rend inerte sur le tunnel de commande
 * (audit Mia 3.2) : masquée par le calque, elle restait dans l'ordre de tabulation et dans l'arbre d'accessibilité
 * (Tab après « Confirmer la commande » partait dans le pied de page invisible). `inert` retire focus, clics et lecture ;
 * `aria-hidden` couvre les navigateurs sans `inert`. `display: contents` : aucune boîte, l'en-tête reste collant.
 */
export function CheckoutInert({ children }: { children: ReactNode }) {
  const hidden = isCheckoutPath(usePathname());
  return (
    <div className="contents" inert={hidden} aria-hidden={hidden || undefined}>
      {children}
    </div>
  );
}
