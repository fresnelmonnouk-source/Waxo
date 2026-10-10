// Codes d'erreur de l'API commande/avis et messages localisés (réponses JSON propres, jamais de détail interne).

export type ApiLang = "fr" | "en";

export type ApiErrorCode =
  | "invalid_request"
  | "cart_invalid"
  | "out_of_stock"
  | "product_unavailable"
  | "payment_method_disabled"
  | "payment_unavailable"
  | "rate_limited"
  | "quantity_limit"
  | "unavailable"
  | "login_required"
  | "already_reviewed"
  | "server_error";

export const API_STATUS: Record<ApiErrorCode, number> = {
  invalid_request: 400,
  cart_invalid: 422,
  out_of_stock: 409,
  product_unavailable: 409,
  payment_method_disabled: 422,
  payment_unavailable: 502,
  rate_limited: 429,
  quantity_limit: 422,
  unavailable: 503,
  login_required: 401,
  already_reviewed: 409,
  server_error: 500,
};

const MESSAGES: Record<ApiLang, Record<ApiErrorCode, string>> = {
  fr: {
    invalid_request: "Certaines informations sont invalides. Vérifiez le formulaire et réessayez.",
    cart_invalid: "Votre panier contient un article invalide. Mettez-le à jour et réessayez.",
    out_of_stock: "Un article de votre panier n'est plus disponible en quantité suffisante. Mettez votre panier à jour.",
    product_unavailable: "Un article de votre panier n'est plus disponible. Retirez-le puis réessayez.",
    payment_method_disabled: "Ce moyen de paiement n'est pas disponible pour le moment. Choisissez-en un autre.",
    payment_unavailable: "Le paiement n'a pas pu être lancé. Votre commande est enregistrée : nous vous contactons sur WhatsApp.",
    rate_limited: "Trop de tentatives. Patientez quelques minutes avant de réessayer.",
    quantity_limit: "Quantité trop élevée : 10 exemplaires par article et 20 articles par commande au maximum. Pour une commande plus grande, contactez-nous.",
    unavailable: "Le service est momentanément indisponible. Réessayez dans quelques instants.",
    login_required: "Connectez-vous pour donner votre avis. Seuls les clients inscrits peuvent publier un avis.",
    already_reviewed: "Vous avez déjà donné votre avis sur ce produit.",
    server_error: "Une erreur est survenue. Réessayez dans quelques instants.",
  },
  en: {
    invalid_request: "Some details are invalid. Check the form and try again.",
    cart_invalid: "Your cart contains an invalid item. Update it and try again.",
    out_of_stock: "An item in your cart is no longer available in the quantity requested. Please update your cart.",
    product_unavailable: "An item in your cart is no longer available. Remove it and try again.",
    payment_method_disabled: "This payment method is not available right now. Please choose another one.",
    payment_unavailable: "The payment could not be started. Your order is saved: we will contact you on WhatsApp.",
    rate_limited: "Too many attempts. Please wait a few minutes before trying again.",
    quantity_limit: "Quantity too high: 10 per item and 20 items per order at most. For a larger order, please contact us.",
    unavailable: "The service is temporarily unavailable. Please try again in a moment.",
    login_required: "Sign in to leave a review. Only registered customers can post a review.",
    already_reviewed: "You have already reviewed this product.",
    server_error: "Something went wrong. Please try again in a moment.",
  },
};

export const apiMessage = (lang: ApiLang, code: ApiErrorCode): string => MESSAGES[lang][code];

/** Traduit le message d'une exception SQL de place_order en code d'erreur public. */
export function mapPlaceOrderError(message: string | null | undefined): ApiErrorCode {
  const m = message ?? "";
  if (m.includes("quantity_limit")) return "quantity_limit";
  if (m.includes("too_many_open_orders")) return "rate_limited";
  if (m.includes("out_of_stock")) return "out_of_stock";
  if (m.includes("product_unavailable") || m.includes("pack_unavailable")) return "product_unavailable";
  if (m.includes("payment_method_disabled")) return "payment_method_disabled";
  if (m.includes("invalid_zone") || m.includes("invalid_items") || m.includes("invalid_qty") || m.includes("invalid_kind")) {
    return "cart_invalid";
  }
  if (m.includes("shipping_not_configured")) return "unavailable";
  // 40P01 = deadlock détecté : le client peut réessayer sans risque (la transaction a été annulée).
  if (m.includes("deadlock")) return "rate_limited";
  // Identifiant non-UUID, contrainte, etc. : jamais de détail au client.
  return "server_error";
}
