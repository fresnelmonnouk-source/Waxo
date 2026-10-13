// Validation de l'inscription à la newsletter SANS zod (fonctions pures) : c'est ce module que le formulaire client
// importe, pour que zod (≈ 31 Ko br) ne parte pas dans le bundle de chaque page (audit perf M3). Le schéma zod de la
// route API reste dans newsletter-schema.ts, qui réexporte ces fonctions : une seule implémentation des règles.
import { digits, normPhone, validPhone } from "@/lib/checkout/phone";

export const MIN_FILL_MS = 2500; // délai minimal entre l'affichage du formulaire et l'envoi (anti-robot)

// Téléphone : implémentation unique partagée avec la commande et le compte (src/lib/checkout/phone.ts).
export { digits, normPhone, validPhone };
export const validEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim()) && s.trim().length <= 200;
