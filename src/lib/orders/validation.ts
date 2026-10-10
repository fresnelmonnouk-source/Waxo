import { z } from "zod";
import { isValidPhone, normPhone } from "@/lib/auth/validation";

// Schémas Zod des server actions du back-office « ventes ». Module pur (testé).

export const orderStatusSchema = z.enum(["nouvelle", "preparation", "livraison", "livree", "annulee"]);

export const setStatusSchema = z.object({
  orderId: z.uuid(),
  to: orderStatusSchema,
  courierId: z.uuid().nullable().optional(),
});

export const assignCourierSchema = z.object({
  orderId: z.uuid(),
  courierId: z.uuid().nullable(),
});

export const orderIdSchema = z.object({ orderId: z.uuid() });

export const codVerifiedSchema = z.object({ orderId: z.uuid(), verified: z.boolean() });

export const courierFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Indiquez le nom du livreur.")
    .max(80, "Nom trop long (80 caractères maximum)."),
  phone: z
    .string()
    .trim()
    .max(30, "Numéro à 10 chiffres commençant par 01.")
    .refine(isValidPhone, "Numéro à 10 chiffres commençant par 01.")
    .transform(normPhone),
  zone: z.enum(["cotonou", "autre"], "Choisissez une zone."),
});

export const courierUpdateSchema = courierFieldsSchema.extend({ courierId: z.uuid() });
export const courierToggleSchema = z.object({ courierId: z.uuid(), active: z.boolean() });
export const courierDeleteSchema = z.object({ courierId: z.uuid() });

/** Premier message d'erreur lisible d'un échec de validation Zod. */
export function firstIssue(error: z.ZodError, fallback = "Données invalides."): string {
  return error.issues[0]?.message || fallback;
}
