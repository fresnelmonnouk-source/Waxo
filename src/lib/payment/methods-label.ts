/**
 * Moyens de paiement AFFICHÉS (pied de page, héro de l'accueil, fiches produit et pack), construits depuis les réglages
 * (`settings.pay`) et `online` (= `onlinePayAvailable` : un moyen en ligne coché ET une clé FedaPay utilisable).
 * Règle (audit Helena B1, brief du 2026-10-13) : on n'annonce QUE ce qui est réellement proposé.
 * - Mobile Money (MTN MoMo, Moov Money, Celtiis Cash) : coché ET `online` ;
 * - carte (Visa, Mastercard) : `carte` coché ET `online` ;
 * - paiement à la livraison : `cod` coché.
 * Module pur (aucun accès serveur ni navigateur) : utilisable dans un composant serveur ou client, et testable.
 */

export type PayFlags = { momo: boolean; moov: boolean; celtiis: boolean; carte: boolean; cod: boolean };

/** Noms de marque : identiques en français et en anglais. */
const OPERATORS = [
  ["momo", "MTN MoMo"],
  ["moov", "Moov Money"],
  ["celtiis", "Celtiis Cash"],
] as const;
const CARD_BRANDS = ["Visa", "Mastercard"] as const;

const WORDS = {
  fr: { mobile: "par Mobile Money", card: "par carte", cod: "à la réception", or: "ou" },
  en: { mobile: "by Mobile Money", card: "by card", cod: "on delivery", or: "or" },
} as const;

const langOf = (lang: string): "fr" | "en" => (lang === "en" ? "en" : "fr");

/** Opérateurs Mobile Money réellement proposés en ligne. */
export function mobileOperators(pay: PayFlags, online: boolean): string[] {
  return online ? OPERATORS.filter(([k]) => pay[k]).map(([, name]) => name) : [];
}

/** Carte bancaire réellement proposée en ligne. */
export const cardOffered = (pay: PayFlags, online: boolean) => online && pay.carte;

/** Au moins un moyen de paiement EN LIGNE réellement proposé. */
export const anyOnline = (pay: PayFlags, online: boolean) => mobileOperators(pay, online).length > 0 || cardOffered(pay, online);

/** Marques des moyens en ligne proposés, dans l'ordre d'affichage : « MTN MoMo », …, « Visa », « Mastercard ». */
export function onlineBrands(pay: PayFlags, online: boolean): string[] {
  return [...mobileOperators(pay, online), ...(cardOffered(pay, online) ? CARD_BRANDS : [])];
}

/** « a, b ou c » / « a, b or c ». */
export function joinOr(items: readonly string[], lang: string): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${WORDS[langOf(lang)].or} ${items[items.length - 1]}`;
}

/**
 * Liste rédigée pour une phrase « Vous payez {methods}. » : « par Mobile Money, par carte ou à la réception ».
 * Vide quand aucun moyen en ligne n'est proposé (la phrase dédiée au seul paiement à la livraison prend alors le relais).
 */
export function methodsProse(pay: PayFlags, online: boolean, lang: string): string {
  if (!anyOnline(pay, online)) return "";
  const w = WORDS[langOf(lang)];
  const parts: string[] = [];
  if (mobileOperators(pay, online).length) parts.push(w.mobile);
  if (cardOffered(pay, online)) parts.push(w.card);
  if (pay.cod) parts.push(w.cod);
  return joinOr(parts, lang);
}

/** Quelle phrase de paiement afficher : moyens en ligne (+ livraison), livraison seule, ou rien. */
export type PayLineKind = "methods" | "codOnly" | "none";
export function payLineKind(pay: PayFlags, online: boolean): PayLineKind {
  if (anyOnline(pay, online)) return "methods";
  return pay.cod ? "codOnly" : "none";
}

/**
 * Phrase de paiement complète, avec les textes du composant (clés next-intl) :
 * `methods` reçoit la liste rédigée (« par Mobile Money ou à la réception »), `codOnly` la phrase « livraison seule ».
 * Chaîne vide si aucun moyen n'est proposé.
 */
export function payLineText(
  pay: PayFlags,
  online: boolean,
  lang: string,
  texts: { methods: (methods: string) => string; codOnly: () => string },
): string {
  const kind = payLineKind(pay, online);
  if (kind === "methods") return texts.methods(methodsProse(pay, online, lang));
  return kind === "codOnly" ? texts.codOnly() : "";
}
