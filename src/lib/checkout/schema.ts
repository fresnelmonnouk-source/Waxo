import { z } from "zod";
import { validEmail, validPhone } from "./phone";
import { isMobileMoney, PAY_METHODS, ZONES } from "./shipping";

/** Schémas Zod des entrées serveur (commande, avis). Longueurs bornées ; les montants ne sont JAMAIS acceptés. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const checkoutSchema = z
  .object({
    items: z
      .array(
        z.object({
          kind: z.enum(["product", "pack"]),
          id: z.string().regex(UUID),
          qty: z.number().int().min(1).max(99),
        }),
      )
      .min(1)
      .max(50),
    customer: z.object({
      name: z.string().trim().min(3).max(120),
      phone: z.string().max(30).refine(validPhone),
      email: z
        .string()
        .trim()
        .max(200)
        .refine((v) => v === "" || validEmail(v))
        .optional(),
      address: z.string().trim().min(5).max(400),
      note: z.string().trim().max(500).optional(),
    }),
    zone: z.enum(ZONES),
    pay: z.enum(PAY_METHODS),
    /** Numéro Mobile Money à valider (obligatoire pour momo/moov/celtiis). */
    payerPhone: z.string().max(30).optional(),
    lang: z.enum(["fr", "en"]).default("fr"),
    /** Honeypot (doit rester vide) et horodatage d'affichage du formulaire (ms epoch). */
    website: z.string().max(200).optional(),
    t: z.number().int().optional(),
  })
  .superRefine((v, ctx) => {
    if (isMobileMoney(v.pay) && !validPhone(v.payerPhone)) {
      ctx.addIssue({ code: "custom", path: ["payerPhone"], message: "invalid_payer_phone" });
    }
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const reviewSchema = z.object({
  productId: z.string().regex(UUID),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(15).max(1500),
  /** Repli si le profil n'a pas de nom : jamais prioritaire sur le profil. */
  author: z.string().trim().max(80).optional(),
  lang: z.enum(["fr", "en"]).default("fr"),
  website: z.string().max(200).optional(),
  t: z.number().int().optional(),
});

export type ReviewInput = z.infer<typeof reviewSchema>;

/** Délai minimal (ms) entre l'affichage du formulaire et l'envoi : en dessous, c'est un robot. */
export const MIN_FORM_DELAY_MS = 2500;

/** Honeypot rempli, horodatage absent, ou envoi réellement trop rapide → vrai si la requête ressemble à un robot. */
export function looksLikeBot(input: { website?: string; t?: number }, now = Date.now()): boolean {
  if (input.website && input.website.trim() !== "") return true;
  if (typeof input.t !== "number") return true;
  // Horloge client en avance (t futur) : on ne peut pas conclure, on accepte (le honeypot et les limiteurs restent).
  const elapsed = now - input.t;
  return elapsed >= 0 && elapsed < MIN_FORM_DELAY_MS;
}
