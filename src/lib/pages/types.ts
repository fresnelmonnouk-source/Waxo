// Types et constantes partagés des pages d'infos (CMS). Module pur : utilisable côté serveur ET client.

export const PAGE_LOCALES = ["fr", "en"] as const;
export type PageLocale = (typeof PAGE_LOCALES)[number];

/** Les 6 pages d'infos pilotées par la table `pages` (slug = segment d'URL public). */
export const PAGE_SLUGS = ["a-propos", "livraison-retours", "cgv", "cgu", "confidentialite", "mentions-legales"] as const;
export type PageSlug = (typeof PAGE_SLUGS)[number];

export function isPageSlug(v: unknown): v is PageSlug {
  return typeof v === "string" && (PAGE_SLUGS as readonly string[]).includes(v);
}
export function isPageLocale(v: unknown): v is PageLocale {
  return v === "fr" || v === "en";
}

/** Libellés d'admin (français uniquement). */
export const PAGE_LABELS: Record<PageSlug, string> = {
  "a-propos": "À propos",
  "livraison-retours": "Livraison et retours",
  cgv: "Conditions générales de vente",
  cgu: "Conditions générales d'utilisation",
  confidentialite: "Politique de confidentialité",
  "mentions-legales": "Mentions légales",
};

/** Bornes de saisie (appliquées côté serveur par l'action d'enregistrement). */
export const TITLE_MAX = 160;
export const BODY_MAX = 30000;

/** Réglages légaux (`settings.legal`, publics, édités par l'admin « Réglages ») — toutes chaînes, vides par défaut. */
export const LEGAL_KEYS = [
  "companyName",
  "legalForm",
  "ifu",
  "rccm",
  "address",
  "phone",
  "email",
  "hostName",
  "hostAddress",
  "publicationDirector",
  "apdpReceipt",
] as const;
export type LegalKey = (typeof LEGAL_KEYS)[number];
export type LegalSettings = Record<LegalKey, string>;

export const EMPTY_LEGAL: LegalSettings = {
  companyName: "",
  legalForm: "",
  ifu: "",
  rccm: "",
  address: "",
  phone: "",
  email: "",
  hostName: "",
  hostAddress: "",
  publicationDirector: "",
  apdpReceipt: "",
};

/** Lit `settings.legal` tel que stocké (jsonb inconnu) : ne garde que les clés connues, en chaînes rognées et bornées. */
export function normalizeLegal(raw: unknown): LegalSettings {
  const out: LegalSettings = { ...EMPTY_LEGAL };
  if (raw && typeof raw === "object") {
    for (const k of LEGAL_KEYS) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === "string") out[k] = v.trim().slice(0, 500);
    }
  }
  return out;
}
