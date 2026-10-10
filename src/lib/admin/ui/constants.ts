// Constantes d'interface du back-office (couleurs/étiquettes de la maquette « Waxo Admin », waxo-data.js). Module pur, sans « server-only ».

export type OrderStatusId = "nouvelle" | "preparation" | "livraison" | "livree" | "annulee";

/** Statut → [libellé, fond, texte] (maquette : STATUS). */
export const STATUS: Record<OrderStatusId, readonly [string, string, string]> = {
  nouvelle: ["Reçue", "#FFF4D6", "#8A5A00"],
  preparation: ["En préparation", "#E8E4F5", "#4B3A8C"],
  livraison: ["En livraison", "#DDEBF7", "#1D4F7A"],
  livree: ["Livrée", "#E5EFE7", "#1F6B4A"],
  annulee: ["Annulée", "#F6E1DA", "#9A3412"],
};

/** Étape suivante d'une commande : [statut, libellé du bouton] (maquette : NEXT). */
export const NEXT_STATUS: Partial<Record<OrderStatusId, readonly [OrderStatusId, string]>> = {
  nouvelle: ["preparation", "Passer en préparation"],
  preparation: ["livraison", "Marquer en livraison"],
  livraison: ["livree", "Marquer livrée"],
};

export const PAY_LABEL: Record<string, string> = {
  momo: "MTN MoMo",
  moov: "Moov Money",
  celtiis: "Celtiis Cash",
  carte: "Carte bancaire",
  cod: "Paiement à la livraison",
};
export const PAY_COLOR: Record<string, string> = {
  momo: "#F5B800",
  moov: "#1D4F7A",
  celtiis: "#2B8FC4",
  carte: "#141210",
  cod: "#1F6B4A",
};
export const ZONE_LABEL: Record<string, string> = { cotonou: "Cotonou & Calavi", autre: "Autres villes du Bénin" };
export const CATEGORY_COLOR: Record<string, string> = {
  maison: "#E2552B",
  cuisine: "#F5B800",
  beaute: "#C2668A",
  tech: "#4B3A8C",
  bureau: "#8A5A00",
  voyage: "#1F6B4A",
};
export const CATEGORY_LABEL: Record<string, string> = {
  maison: "Maison",
  cuisine: "Cuisine",
  beaute: "Beauté",
  tech: "Tech",
  bureau: "Bureau",
  voyage: "Voyage",
};

/** Catégories de dépenses du carnet : id → [libellé, fond, texte] (CHECK SQL de `ledger.cat`). */
export const EXPENSE_CATS = {
  stock: ["Achat de stock", "#E8E4F5", "#4B3A8C"],
  pub: ["Publicité", "#FFF4D6", "#8A5A00"],
  livraison: ["Livraison", "#DDEBF7", "#1D4F7A"],
  emballage: ["Emballage", "#EDE4CF", "#4A443C"],
  loyer: ["Loyer et charges", "#F1DCD6", "#9A3412"],
  salaire: ["Salaires", "#E5EFE7", "#1F6B4A"],
  autre: ["Autre", "#E2DCCF", "#4A443C"],
} as const satisfies Record<string, readonly [string, string, string]>;
export type ExpenseCatId = keyof typeof EXPENSE_CATS;
export const EXPENSE_IDS = Object.keys(EXPENSE_CATS) as ExpenseCatId[];
export const isExpenseCat = (v: unknown): v is ExpenseCatId => typeof v === "string" && v in EXPENSE_CATS;
/** Seuil « stock faible » de la maquette (5 unités ou moins). */
export const LOW_STOCK = 5;
