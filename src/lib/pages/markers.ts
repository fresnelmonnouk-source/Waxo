// Marqueurs `{{clé}}` des pages d'infos : valeurs venant des réglages (jamais codées en dur dans les textes).
// Module pur (client + serveur) : l'aperçu de l'éditeur admin s'en sert aussi.
import type { MarkerResolver } from "./markdown";
import { LEGAL_KEYS, type LegalKey, type LegalSettings, type PageLocale } from "./types";

/** Sous-ensemble des réglages boutique dont les textes ont besoin (structure de `ShopSettings`, sans l'importer : module pur). */
export type MarkerShop = {
  brand: { shopName: string; whatsapp: string; email: string };
  shipping: { cotonou: number; autre: number; freeFrom: number; cutoff: number; returnDays: number };
  pay: { cod: boolean };
};
export type MarkerContext = { locale: PageLocale; shop: MarkerShop; legal: LegalSettings };

const NBSP = " ";
/** Montant XOF « 12 500 F » (même rendu que `fmtXof`, dupliqué ici pour rester sans dépendance). */
function xof(n: number): string {
  return Math.round(n || 0).toLocaleString("fr-FR") + NBSP + "F";
}
/** « 7 jours » / « 1 jour » (FR : 0 et 1 au singulier, comme ICU) ; « 7 days » / « 1 day ». */
function days(locale: PageLocale, n: number): string {
  if (locale === "fr") return `${n} ${n < 2 ? "jour" : "jours"}`;
  return `${n} ${n === 1 ? "day" : "days"}`;
}

const COD_CGV = {
  fr: ", ainsi que le paiement à la livraison (espèces ou Mobile Money)",
  en: ", as well as payment on delivery (cash or Mobile Money)",
};
const COD_SHIP = {
  fr: "Si vous avez choisi le paiement à la livraison, préparez le montant en espèces ou payez par Mobile Money.",
  en: "If you chose payment on delivery, have the amount ready in cash or pay by Mobile Money.",
};
export const TBC_LABEL: Record<PageLocale, string> = { fr: "[à compléter]", en: "[to be completed]" };

export type MarkerGroup = "Réglages légaux" | "Boutique" | "Livraison" | "Paiement";
export type MarkerDoc = { key: string; label: string; group: MarkerGroup };

/** Catalogue affiché dans l'éditeur (boutons d'insertion). Les clés `legal.*` rendent « [à compléter] » tant qu'elles sont vides. */
export const MARKER_DOCS: MarkerDoc[] = [
  { key: "legal.companyName", label: "Raison sociale", group: "Réglages légaux" },
  { key: "legal.legalForm", label: "Forme juridique", group: "Réglages légaux" },
  { key: "legal.rccm", label: "RCCM", group: "Réglages légaux" },
  { key: "legal.ifu", label: "IFU", group: "Réglages légaux" },
  { key: "legal.address", label: "Adresse du siège", group: "Réglages légaux" },
  { key: "legal.phone", label: "Téléphone", group: "Réglages légaux" },
  { key: "legal.email", label: "E-mail légal", group: "Réglages légaux" },
  { key: "legal.hostName", label: "Hébergeur", group: "Réglages légaux" },
  { key: "legal.hostAddress", label: "Adresse de l'hébergeur", group: "Réglages légaux" },
  { key: "legal.publicationDirector", label: "Directeur de la publication", group: "Réglages légaux" },
  { key: "legal.apdpReceipt", label: "Récépissé APDP", group: "Réglages légaux" },
  { key: "brand.shopName", label: "Nom de la boutique", group: "Boutique" },
  { key: "brand.whatsapp", label: "WhatsApp", group: "Boutique" },
  { key: "brand.email", label: "E-mail de contact", group: "Boutique" },
  { key: "shipping.cotonou", label: "Frais Cotonou", group: "Livraison" },
  { key: "shipping.autre", label: "Frais autres villes", group: "Livraison" },
  { key: "shipping.freeFrom", label: "Livraison offerte dès", group: "Livraison" },
  { key: "shipping.cutoff", label: "Heure limite J+1", group: "Livraison" },
  { key: "shipping.returnDays", label: "Délai de retour", group: "Livraison" },
  { key: "pay.codCgv", label: "Mention paiement à la livraison (CGV)", group: "Paiement" },
  { key: "pay.codShip", label: "Mention paiement à la livraison (livraison)", group: "Paiement" },
];

export function isLegalKey(k: string): k is LegalKey {
  return (LEGAL_KEYS as readonly string[]).includes(k);
}

/** Construit le résolveur de marqueurs. Valeur légale vide → « [à compléter] » ; marqueur inconnu → laissé tel quel. */
export function makeMarkerResolver(ctx: MarkerContext): MarkerResolver {
  const { locale, shop, legal } = ctx;
  const values: Record<string, string> = {
    "brand.shopName": shop.brand.shopName,
    "brand.whatsapp": shop.brand.whatsapp,
    "brand.email": shop.brand.email,
    "shipping.cotonou": xof(shop.shipping.cotonou),
    "shipping.autre": xof(shop.shipping.autre),
    "shipping.freeFrom": xof(shop.shipping.freeFrom),
    "shipping.cutoff": String(shop.shipping.cutoff),
    "shipping.returnDays": days(locale, shop.shipping.returnDays),
    "pay.codCgv": shop.pay.cod ? COD_CGV[locale] : "",
    "pay.codShip": shop.pay.cod ? COD_SHIP[locale] : "",
  };
  return (key) => {
    if (key.startsWith("legal.")) {
      const k = key.slice(6);
      if (!isLegalKey(k)) return { status: "unknown" };
      return legal[k] ? { status: "ok", text: legal[k] } : { status: "empty", label: TBC_LABEL[locale] };
    }
    if (Object.hasOwn(values, key)) return { status: "ok", text: values[key] };
    return { status: "unknown" };
  };
}

/** Clés connues (pour signaler une faute de frappe dans l'éditeur). */
export function isKnownMarker(key: string): boolean {
  return MARKER_DOCS.some((m) => m.key === key);
}
