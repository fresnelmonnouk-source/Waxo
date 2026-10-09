import "server-only";

export type OrderEmailKind = "confirmation" | "paid" | "preparation" | "livraison" | "livree" | "annulee";

/**
 * STUB posé par le socle — l'agent « paiement + e-mails » le remplace (Resend, gabarits FR/EN, marque injectée depuis `settings.brand`).
 * CONTRAT (ne pas changer la signature : le back-office commandes l'appelle) :
 *  - ne jette JAMAIS ; renvoie { sent:false, reason } si Resend/clé/e-mail client manque ;
 *  - jamais d'envoi en double pour (orderId, kind) si l'appelant réessaie.
 */
export async function sendOrderEmail(
  orderId: string,
  kind: OrderEmailKind,
): Promise<{ sent: boolean; reason?: string }> {
  void orderId;
  void kind;
  return { sent: false, reason: "not_configured" };
}
