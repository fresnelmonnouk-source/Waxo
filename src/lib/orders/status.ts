import type { AdminOrder, OrderEmailEvent, OrderStatus } from "./types";

/** Libellés et couleurs : identiques à `status` de src/lib/demo/admin.json (testé). */
export const STATUS_META: Record<OrderStatus, { label: string; bg: string; color: string }> = {
  nouvelle: { label: "Reçue", bg: "#FFF4D6", color: "#8A5A00" },
  preparation: { label: "En préparation", bg: "#E8E4F5", color: "#4B3A8C" },
  livraison: { label: "En livraison", bg: "#DDEBF7", color: "#1D4F7A" },
  livree: { label: "Livrée", bg: "#E5EFE7", color: "#1F6B4A" },
  annulee: { label: "Annulée", bg: "#F6E1DA", color: "#9A3412" },
};

export const STATUS_LIST: OrderStatus[] = ["nouvelle", "preparation", "livraison", "livree", "annulee"];

export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === "string" && (STATUS_LIST as string[]).includes(v);
}

/** Étape suivante du flux nominal, avec le libellé du bouton (maquette : NEXT). */
export const NEXT_STEP: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  nouvelle: { to: "preparation", label: "Passer en préparation" },
  preparation: { to: "livraison", label: "Marquer en livraison" },
  livraison: { to: "livree", label: "Marquer livrée" },
};

/**
 * Transitions autorisées. Le flux avance d'une étape à la fois ; l'annulation est possible tant que la commande
 * n'est pas livrée ; le SEUL retour en arrière est « livraison → préparation » (échec de livraison, action explicite).
 * « livree » et « annulee » sont définitifs (cancel_order ne sait pas annuler une annulation).
 */
const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  nouvelle: ["preparation", "annulee"],
  preparation: ["livraison", "annulee"],
  livraison: ["livree", "preparation", "annulee"],
  livree: [],
  annulee: [],
};

export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  return ALLOWED[from] ?? [];
}
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return allowedTransitions(from).includes(to);
}

export type TransitionInput = Pick<AdminOrder, "status" | "pay" | "paid" | "courierId">;
export type TransitionPlan =
  | {
      ok: true;
      /** true → passer par la fonction SQL cancel_order (restitue le stock) au lieu d'un UPDATE. */
      cancel: boolean;
      /** Colonnes à mettre à jour (vide pour une annulation). */
      patch: Record<string, string | boolean | null>;
      /** E-mail client à déclencher (null = aucun). */
      email: OrderEmailEvent | null;
    }
  | { ok: false; code: string; message: string };

/**
 * Décide, sans toucher à la base, ce que provoque un changement de statut. Utilisé par la server action
 * (autorité) et par l'interface (pour n'afficher que des options valides).
 */
export function planTransition(
  order: TransitionInput,
  to: OrderStatus,
  opts: { courierId?: string | null; now?: Date } = {},
): TransitionPlan {
  const nowIso = (opts.now ?? new Date()).toISOString();
  if (order.status === to) return { ok: false, code: "same_status", message: "La commande est déjà dans ce statut." };
  if (!canTransition(order.status, to)) {
    return {
      ok: false,
      code: "invalid_transition",
      message:
        order.status === "livree" || order.status === "annulee"
          ? `Une commande « ${STATUS_META[order.status].label.toLowerCase()} » ne peut plus changer de statut.`
          : `Passage impossible de « ${STATUS_META[order.status].label} » à « ${STATUS_META[to].label} » : suivez les étapes une à une.`,
    };
  }
  if (to === "annulee") return { ok: true, cancel: true, patch: {}, email: "annulee" };

  if (to === "preparation") {
    if (order.status === "nouvelle" && order.pay !== "cod" && !order.paid) {
      return {
        ok: false,
        code: "unpaid",
        message: "Paiement en ligne non reçu : attendez la confirmation, ou marquez la commande payée après vérification.",
      };
    }
    // Échec de livraison (livraison → préparation) : retour explicite, aucun e-mail « en préparation » renvoyé.
    return {
      ok: true,
      cancel: false,
      patch: { status: "preparation" },
      email: order.status === "nouvelle" ? "preparation" : null,
    };
  }

  if (to === "livraison") {
    const courier = opts.courierId ?? order.courierId;
    if (!courier) return { ok: false, code: "courier_required", message: "Choisissez d'abord un livreur." };
    return { ok: true, cancel: false, patch: { status: "livraison", courier_id: courier }, email: "livraison" };
  }

  // to === "livree"
  const patch: Record<string, string | boolean | null> = { status: "livree", delivered_at: nowIso };
  // Paiement à la livraison : le livreur a encaissé à la remise → la commande est payée.
  if (order.pay === "cod" && !order.paid) {
    patch.paid = true;
    patch.paid_at = nowIso;
  }
  return { ok: true, cancel: false, patch, email: "livree" };
}
