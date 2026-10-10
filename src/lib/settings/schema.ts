import { z } from "zod";
import { normalizeWhatsapp, validEmail } from "./phone";

// Réglages de la boutique : validation pure (client + serveur). Stockés dans `settings` (clés brand, shipping, pay, legal, flags).

export const PAY_IDS = ["momo", "moov", "celtiis", "carte", "cod"] as const;
export type PayId = (typeof PAY_IDS)[number];
export const PAY_LABELS: Record<PayId, string> = {
  momo: "MTN MoMo",
  moov: "Moov Money",
  celtiis: "Celtiis Cash",
  carte: "Carte bancaire",
  cod: "Paiement à la livraison",
};

export const LEGAL_FIELDS = [
  { key: "companyName", label: "Raison sociale", max: 200 },
  { key: "legalForm", label: "Forme juridique", max: 120 },
  { key: "ifu", label: "IFU", max: 60 },
  { key: "rccm", label: "RCCM", max: 80 },
  { key: "address", label: "Adresse du siège", max: 400 },
  { key: "phone", label: "Téléphone", max: 40 },
  { key: "email", label: "E-mail légal", max: 200 },
  { key: "hostName", label: "Hébergeur", max: 200 },
  { key: "hostAddress", label: "Adresse de l'hébergeur", max: 400 },
  { key: "publicationDirector", label: "Directeur de la publication", max: 160 },
  { key: "apdpReceipt", label: "Récépissé APDP", max: 120 },
] as const;
export type LegalKey = (typeof LEGAL_FIELDS)[number]["key"];
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

/** Valeurs affichées dans le formulaire (chaînes pour les champs texte/nombre : saisie brute). */
export type SettingsForm = {
  shopName: string;
  whatsapp: string;
  email: string;
  hours: string;
  shipCotonou: string;
  shipOther: string;
  freeFrom: string;
  cutoff: string;
  pay: Record<PayId, boolean>;
  autoDraft: boolean;
  aiSign: string;
  legal: LegalSettings;
};

export const DEFAULT_FORM: SettingsForm = {
  shopName: "Wá xɔ",
  whatsapp: "+229 01 00 00 00 00",
  email: "contact@waxo.bj",
  hours: "Du lundi au samedi, de 8 h à 19 h",
  shipCotonou: "1000",
  shipOther: "2500",
  freeFrom: "15000",
  cutoff: "18",
  pay: { momo: true, moov: true, celtiis: true, carte: true, cod: true },
  autoDraft: true,
  aiSign: "L'équipe Wá xɔ",
  legal: { ...EMPTY_LEGAL },
};

export type SettingsFieldKey =
  | "shopName"
  | "whatsapp"
  | "email"
  | "hours"
  | "shipCotonou"
  | "shipOther"
  | "freeFrom"
  | "cutoff"
  | "pay"
  | "aiSign"
  | "form"
  | `legal.${LegalKey}`;
export type SettingsErrors = Partial<Record<SettingsFieldKey, string>>;

/** Valeurs normalisées prêtes à être fusionnées dans les lignes `settings`. */
export type ParsedSettings = {
  brand: { shopName: string; whatsapp: string; waNumber: string; email: string; hours: string; aiSign: string };
  shipping: { cotonou: number; autre: number; freeFrom: number; cutoff: number };
  pay: Record<PayId, boolean>;
  legal: LegalSettings;
  flags: { autoDraft: boolean };
};

const MSG_INT = "Nombre entier positif requis.";
const intField = z
  .union([z.string(), z.number()], { error: MSG_INT })
  .transform((v) => String(v).replace(/[\s ]/g, ""))
  .pipe(z.string().regex(/^\d{1,9}$/, MSG_INT))
  .transform((s) => Number(s));

const legalShape = Object.fromEntries(LEGAL_FIELDS.map((f) => [f.key, z.string().trim().max(f.max, `${f.max} caractères maximum.`)])) as Record<
  LegalKey,
  z.ZodString
>;

const formSchema = z
  .object({
    shopName: z.string().trim().max(80, "80 caractères maximum."),
    whatsapp: z.string().max(40, "Numéro WhatsApp invalide."),
    email: z.string().trim().max(200, "Adresse e-mail invalide."),
    hours: z.string().trim().max(120, "120 caractères maximum."),
    shipCotonou: intField,
    shipOther: intField,
    freeFrom: intField,
    cutoff: intField,
    pay: z.object({ momo: z.boolean(), moov: z.boolean(), celtiis: z.boolean(), carte: z.boolean(), cod: z.boolean() }).strict(),
    autoDraft: z.boolean(),
    aiSign: z.string().trim().max(120, "120 caractères maximum."),
    legal: z.object(legalShape).strict(),
  })
  .strict();

/** Valide le formulaire complet. Renvoie les valeurs normalisées ou les erreurs par champ. */
export function parseSettingsForm(input: unknown): { ok: true; data: ParsedSettings } | { ok: false; errors: SettingsErrors } {
  const r = formSchema.safeParse(input);
  const errors: SettingsErrors = {};
  if (!r.success) {
    for (const issue of r.error.issues) {
      const head = String(issue.path[0] ?? "form");
      const key = (head === "legal" && issue.path[1] !== undefined ? `legal.${String(issue.path[1])}` : head) as SettingsFieldKey;
      if (!errors[key]) errors[key] = issue.path.length ? issue.message : "Données invalides.";
    }
    return { ok: false, errors };
  }
  const v = r.data;
  const wa = normalizeWhatsapp(v.whatsapp);
  if (!wa) errors.whatsapp = "Numéro WhatsApp invalide.";
  if (!validEmail(v.email)) errors.email = "Adresse e-mail invalide.";
  if (v.cutoff < 0 || v.cutoff > 23) errors.cutoff = "Entre 0 et 23 h.";
  if (!PAY_IDS.some((id) => v.pay[id])) errors.pay = "Gardez au moins un moyen de paiement.";
  if (v.legal.email && !validEmail(v.legal.email)) errors["legal.email"] = "Adresse e-mail invalide.";
  let legalPhone = v.legal.phone;
  if (legalPhone) {
    const lp = normalizeWhatsapp(legalPhone);
    if (!lp) errors["legal.phone"] = "Numéro de téléphone invalide.";
    else legalPhone = lp.display;
  }
  if (Object.keys(errors).length || !wa) return { ok: false, errors };
  return {
    ok: true,
    data: {
      brand: {
        shopName: v.shopName || DEFAULT_FORM.shopName,
        whatsapp: wa.display,
        waNumber: wa.waNumber,
        email: v.email,
        hours: v.hours,
        aiSign: v.aiSign || DEFAULT_FORM.aiSign,
      },
      shipping: { cotonou: v.shipCotonou, autre: v.shipOther, freeFrom: v.freeFrom, cutoff: v.cutoff },
      pay: v.pay,
      legal: { ...v.legal, phone: legalPhone },
      flags: { autoDraft: v.autoDraft },
    },
  };
}

// ───────────────────────── Lecture : lignes `settings` → formulaire ─────────────────────────
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown, fallback: string): string => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback: string): string => (typeof v === "number" && Number.isFinite(v) ? String(Math.max(0, Math.round(v))) : fallback);

/** Construit le formulaire à partir des valeurs `settings` (clés brand, shipping, pay, legal, flags). Tolérant : défauts si champ absent. */
export function formFromSettings(values: Partial<Record<"brand" | "shipping" | "pay" | "legal" | "flags", unknown>>): SettingsForm {
  const brand = rec(values.brand);
  const shipping = rec(values.shipping);
  const pay = rec(values.pay);
  const legal = rec(values.legal);
  const flags = rec(values.flags);
  const d = DEFAULT_FORM;
  return {
    shopName: str(brand.shopName, d.shopName),
    whatsapp: str(brand.whatsapp, d.whatsapp),
    email: str(brand.email, d.email),
    hours: str(brand.hours, d.hours),
    shipCotonou: num(shipping.cotonou, d.shipCotonou),
    shipOther: num(shipping.autre, d.shipOther),
    freeFrom: num(shipping.freeFrom, d.freeFrom),
    cutoff: num(shipping.cutoff, d.cutoff),
    pay: Object.fromEntries(PAY_IDS.map((id) => [id, typeof pay[id] === "boolean" ? pay[id] : d.pay[id]])) as Record<PayId, boolean>,
    autoDraft: typeof flags.autoDraft === "boolean" ? flags.autoDraft : d.autoDraft,
    aiSign: str(brand.aiSign, d.aiSign),
    legal: Object.fromEntries(LEGAL_FIELDS.map((f) => [f.key, str(legal[f.key], "")])) as LegalSettings,
  };
}
