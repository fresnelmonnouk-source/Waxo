import { z } from "zod";
import { digits, normPhone, validPhone } from "@/lib/checkout/phone";

/**
 * Validation de l'inscription à la newsletter (partagée : formulaire client + route API).
 * Règles de la maquette : e-mail valide, ou numéro WhatsApp béninois de 10 chiffres commençant par 01
 * (après retrait du préfixe 229 éventuel).
 */
export const MIN_FILL_MS = 2500; // délai minimal entre l'affichage du formulaire et l'envoi (anti-robot)

// Téléphone : implémentation unique partagée avec la commande et le compte (src/lib/checkout/phone.ts).
export { digits, normPhone, validPhone };
export const validEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim()) && s.trim().length <= 200;

export const newsletterSchema = z
  .object({
    channel: z.enum(["email", "whatsapp"]),
    value: z.string().trim().min(3).max(200),
    website: z.string().max(200).optional(), // honeypot : doit rester vide
    t: z.number().optional(), // horodatage (ms) de l'affichage du formulaire
  })
  .strict()
  .superRefine((v, ctx) => {
    const ok = v.channel === "email" ? validEmail(v.value) : validPhone(v.value);
    if (!ok) ctx.addIssue({ code: "custom", path: ["value"], message: "invalid_value" });
  });

export type NewsletterInput = z.infer<typeof newsletterSchema>;

/** Valeur à enregistrer : e-mail en minuscules, numéro normalisé sur 10 chiffres. */
export function storedValue(v: Pick<NewsletterInput, "channel" | "value">): string {
  return v.channel === "email" ? v.value.trim().toLowerCase() : normPhone(v.value);
}

/** Vrai si le formulaire a été rempli « trop vite » ou sans horodatage plausible (robot). */
export function isTooFast(t: number | undefined, now: number): boolean {
  if (typeof t !== "number" || !Number.isFinite(t)) return true;
  // Horloge client en avance : on ne peut pas conclure, on accepte (honeypot et limiteur par IP restent les freins).
  const elapsed = now - t;
  return elapsed >= 0 && elapsed < MIN_FILL_MS;
}
