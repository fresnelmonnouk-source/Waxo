import { z } from "zod";
import { ORDER_NUMBER_RE, isEmailOrPhone, isValidEmail, normOrderNumber, normPhone } from "@/lib/auth/validation";
import { BODY_MAX, BODY_MIN, CATEGORIES, SOURCES, type Category } from "./types";

/**
 * Validation partagée client + serveur (module PUR). Les messages Zod sont des CODES traduits par l'interface
 * (`Conversations.errors.<code>`, sinon `Contact.errors` / `Auth.errors`) : l'API ne renvoie jamais de texte interne.
 */

/** Anciens sujets du formulaire de contact (navigateur resté sur l'ancienne version pendant un déploiement). */
const LEGACY_SUBJECT: Record<string, Category> = { order: "commande", product: "question", delivery: "commande", returns: "retour", other: "autre" };

const body = z.string().trim().min(BODY_MIN, "textShort").max(BODY_MAX, "textLong");

export const createSchema = z
  .object({
    name: z.string().trim().min(2, "nameRequired").max(120, "tooLong"),
    contact: z
      .string()
      .trim()
      .max(200, "contactInvalid")
      .refine(isEmailOrPhone, "contactInvalid")
      .transform((v) => (isValidEmail(v) ? v.toLowerCase() : normPhone(v))),
    category: z.enum(CATEGORIES, "categoryRequired").optional(),
    subject: z.string().optional(),
    orderNumber: z
      .string()
      .trim()
      .max(40, "orderInvalid")
      .optional()
      .transform((v) => (v ? normOrderNumber(v) : ""))
      .refine((v) => v === "" || ORDER_NUMBER_RE.test(v), "orderInvalid"),
    body: z.string().trim().min(10, "textShort").max(BODY_MAX, "textLong"),
    lang: z.enum(["fr", "en"]).optional().default("fr"),
    source: z.enum(SOURCES).optional().default("contact"),
  })
  .transform((v, ctx) => {
    const category = v.category ?? (v.subject ? LEGACY_SUBJECT[v.subject] : undefined);
    if (!category) {
      ctx.addIssue({ code: "custom", path: ["category"], message: "categoryRequired" });
      return z.NEVER;
    }
    return { name: v.name, contact: v.contact, category, orderNumber: v.orderNumber, body: v.body, lang: v.lang, source: v.source };
  });
export type CreateInput = z.output<typeof createSchema>;

/** Réponse du client depuis le lien privé. */
export const tokenReplySchema = z.object({
  token: z.string().max(100),
  body,
  lang: z.enum(["fr", "en"]).optional().default("fr"),
});

/** Réponse du client connecté depuis « Mes demandes ». */
export const accountReplySchema = z.object({ body, lang: z.enum(["fr", "en"]).optional().default("fr") });

/** Réponse ou note de l'équipe (admin). */
export const adminBodySchema = z.string().trim().min(1, "Message vide.").max(BODY_MAX, "Message trop long (3 000 caractères au plus).");
