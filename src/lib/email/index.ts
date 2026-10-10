import "server-only";
import { claimEmail, confirmEmail, emailKey, releaseEmail } from "./guard";
import { loadOrderEmail } from "./load";
import { sendViaResend } from "./resend";
import { renderOrderEmail } from "./template";
import type { OrderEmailKind } from "./copy";

export type { OrderEmailKind } from "./copy";

const KINDS: readonly OrderEmailKind[] = ["confirmation", "paid", "preparation", "livraison", "livree", "annulee"];

/**
 * E-mails de commande (Resend) — CONTRAT (le back-office commandes et le paiement l'appellent) :
 *  - ne jette JAMAIS ; renvoie { sent:false, reason } si Resend/clé/e-mail client manque ;
 *  - jamais d'envoi en double pour (orderId, kind) : garde mémoire + en-tête Idempotency-Key Resend ;
 *  - langue = orders.locale (FR par défaut) ; marque/contact = settings.brand ; données client échappées ;
 *  - destinataire = orders.email, sinon l'e-mail du compte rattaché ; aucun envoi sans adresse.
 */
export async function sendOrderEmail(
  orderId: string,
  kind: OrderEmailKind,
): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (typeof orderId !== "string" || !orderId || !KINDS.includes(kind)) return { sent: false, reason: "invalid_input" };
    if (!process.env.RESEND_API_KEY?.trim()) return { sent: false, reason: "not_configured" };

    const key = emailKey(orderId, kind);
    if (!claimEmail(key)) return { sent: false, reason: "duplicate" };

    try {
      const loaded = await loadOrderEmail(orderId);
      if (loaded.to === null) {
        releaseEmail(key);
        return { sent: false, reason: loaded.reason };
      }
      const mail = renderOrderEmail(loaded.data, kind);
      const result = await sendViaResend({
        to: loaded.to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        replyTo: loaded.data.brand.email || undefined,
        idempotencyKey: `waxo-order-${key}`,
      });
      if (!result.ok) {
        releaseEmail(key);
        return { sent: false, reason: result.reason };
      }
      confirmEmail(key);
      return { sent: true };
    } catch {
      releaseEmail(key);
      return { sent: false, reason: "error" };
    }
  } catch {
    return { sent: false, reason: "error" };
  }
}
