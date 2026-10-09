"use client";

import { useRecordView } from "./viewed";

/** Rend rien : enregistre la consultation d'un produit pour la sélection de l'accueil. À monter dans la fiche produit. */
export function ViewedTracker({ productId }: { productId: string }) {
  useRecordView(productId);
  return null;
}
