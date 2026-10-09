import { z } from "zod";

/**
 * Validation partagée client + serveur (module pur : aucune dépendance serveur).
 * Les messages Zod sont des CODES (ex. "firstRequired") : l'interface les traduit via `Auth.errors.<code>`,
 * l'API ne renvoie donc jamais de texte localisé ni d'erreur interne.
 */

// ───────────────────────── Téléphone / e-mail / numéro de commande ─────────────────────────
const digitsOf = (s: unknown) => String(s ?? "").replace(/\D/g, "");

/** « +229 01 97 11 22 33 » → « 0197112233 » (indicatif Bénin retiré, séparateurs ignorés). */
export function normPhone(s: unknown): string {
  let d = digitsOf(s);
  if (d.length === 15 && d.startsWith("00229")) d = d.slice(5);
  else if (d.length === 13 && d.startsWith("229")) d = d.slice(3);
  return d;
}
/** Numéro béninois à 10 chiffres commençant par 01 (après normalisation). */
export const isValidPhone = (s: unknown) => /^01\d{8}$/.test(normPhone(s));
export const prettyPhone = (s: unknown) => normPhone(s).replace(/(\d{2})(?=\d)/g, "$1 ");
export const isValidEmail = (s: unknown) => {
  const v = String(s ?? "").trim();
  return v.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
};
/** Un identifiant de connexion est soit un e-mail, soit un téléphone. */
export const isEmailOrPhone = (s: unknown) => isValidEmail(s) || isValidPhone(s);

export const ORDER_NUMBER_RE = /^WX-\d{3,8}$/;
/** « wx 10258 », « WX10258 », « 10258 » → « WX-10258 ». */
export function normOrderNumber(s: unknown): string {
  const v = String(s ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (/^\d{3,8}$/.test(v)) return `WX-${v}`;
  const m = /^WX-?(\d{3,8})$/.exec(v);
  return m ? `WX-${m[1]}` : v;
}

// ───────────────────────── Schémas ─────────────────────────
const name = (code: string) => z.string().trim().min(2, code).max(80, "tooLong");
const phone = z.string().refine(isValidPhone, "phoneInvalid").transform(normPhone);
const email = z
  .string()
  .trim()
  .refine(isValidEmail, "emailInvalid")
  .transform((v) => v.toLowerCase());
const newPassword = z.string().min(8, "passShort").max(72, "passLong");

export const loginSchema = z.object({
  id: z.string().trim().min(1, "idRequired").max(200, "idRequired"),
  password: z.string().min(1, "passRequired").max(200, "passRequired"),
});

export const forgotSchema = z.object({
  id: z.string().trim().min(1, "idRequired").max(200, "idRequired"),
});

export const signupSchema = z.object({
  firstName: name("firstRequired"),
  lastName: name("lastRequired"),
  phone,
  email,
  password: newPassword,
  cgu: z.boolean().refine((v) => v === true, "cguRequired"),
  news: z.boolean().optional().default(false),
});

export const profileSchema = z.object({
  firstName: name("firstRequired"),
  lastName: name("lastRequired"),
  phone,
  address: z.string().trim().max(400, "tooLong"),
  news: z.boolean(),
});

/** `current` est exigé par la route sauf session ouverte via un lien de réinitialisation (`recovery`). */
export const passwordSchema = z
  .object({
    current: z.string().max(200, "passRequired").optional(),
    next: newPassword,
    recovery: z.boolean().optional(),
  })
  .refine((v) => !v.current || v.next !== v.current, { path: ["next"], message: "pwSame" });

export const CONTACT_SUBJECTS = ["order", "product", "delivery", "returns", "other"] as const;
export type ContactSubject = (typeof CONTACT_SUBJECTS)[number];
/** Libellés français stockés en base (l'admin est en français). */
export const CONTACT_SUBJECT_LABELS: Record<ContactSubject, string> = {
  order: "Commande",
  product: "Produit",
  delivery: "Livraison",
  returns: "Retour ou échange",
  other: "Autre",
};

export const contactSchema = z.object({
  name: z.string().trim().min(2, "nameRequired").max(120, "tooLong"),
  contact: z
    .string()
    .trim()
    .max(200, "contactInvalid")
    .refine(isEmailOrPhone, "contactInvalid")
    .transform((v) => (isValidEmail(v) ? v.toLowerCase() : normPhone(v))),
  subject: z.enum(CONTACT_SUBJECTS, "invalid"),
  orderNumber: z
    .string()
    .trim()
    .max(40, "orderInvalid")
    .optional()
    .transform((v) => (v ? normOrderNumber(v) : ""))
    .refine((v) => v === "" || ORDER_NUMBER_RE.test(v), "orderInvalid"),
  body: z.string().trim().min(10, "textShort").max(3000, "textLong"),
});

export const trackSchema = z.object({
  number: z
    .string()
    .trim()
    .max(40, "numberInvalid")
    .transform(normOrderNumber)
    .refine((v) => ORDER_NUMBER_RE.test(v), "numberInvalid"),
  contact: z.string().trim().max(200, "contactInvalid").refine(isEmailOrPhone, "contactInvalid"),
});

/** Premier code d'erreur par champ : { firstName: "nameRequired", … }. Les erreurs sans champ vont sous « form ». */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : "form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/** Redirection post-connexion : chemin interne uniquement (anti open-redirect), sans préfixe de langue. */
export function safeInternalPath(p: unknown): string | null {
  if (typeof p !== "string") return null;
  return /^\/[A-Za-z0-9\-/_]{0,100}$/.test(p) && !p.startsWith("//") ? p : null;
}
