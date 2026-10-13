import { z } from "zod";
import { MIN_FILL_MS, normPhone, validEmail, validPhone } from "./newsletter-validate";

/**
 * Validation de l'inscription à la newsletter côté route API (zod).
 * Règles de la maquette : e-mail valide, ou numéro WhatsApp béninois de 10 chiffres commençant par 01
 * (après retrait du préfixe 229 éventuel).
 */
// Règles pures (sans zod) dans newsletter-validate.ts, importé par le formulaire client ; réexportées ici pour la route et les tests.
// Ce module (zod) ne doit être importé que côté serveur.
export { digits, MIN_FILL_MS, normPhone, validEmail, validPhone } from "./newsletter-validate";

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
