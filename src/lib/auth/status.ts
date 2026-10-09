/** Statuts de commande (waxo-data.js de la maquette) : couleurs de pastille et déroulé. Module pur. */
export const STATUS_FLOW = ["nouvelle", "preparation", "livraison", "livree"] as const;
export type OrderStatus = (typeof STATUS_FLOW)[number] | "annulee";

export const STATUS_STYLE: Record<OrderStatus, { bg: string; fg: string }> = {
  nouvelle: { bg: "#FFF4D6", fg: "#8A5A00" },
  preparation: { bg: "#E8E4F5", fg: "#4B3A8C" },
  livraison: { bg: "#DDEBF7", fg: "#1D4F7A" },
  livree: { bg: "#E5EFE7", fg: "#1F6B4A" },
  annulee: { bg: "#F6E1DA", fg: "#9A3412" },
};

export const PAY_METHODS = ["momo", "moov", "celtiis", "carte", "cod"] as const;
export const ZONES = ["cotonou", "autre"] as const;

export function asStatus(v: unknown): OrderStatus {
  return v === "preparation" || v === "livraison" || v === "livree" || v === "annulee" ? v : "nouvelle";
}
/** Une commande « en cours » apparaît dans le menu profil. */
export const isActiveStatus = (s: OrderStatus) => s === "nouvelle" || s === "preparation" || s === "livraison";
