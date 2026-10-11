import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/payment/config";
import { sendViaResend } from "./resend";
import { renderReviewRequest } from "./review-request-template";

/**
 * Demandes d'avis (tâche quotidienne) : commandes livrées depuis 3 à 14 jours, avec un e-mail, jamais sollicitées.
 * Une seule demande par commande (orders.review_requested_at, posé AVANT l'envoi, migration 0015). Échec d'envoi =
 * nouvel essai le lendemain, jusqu'à 14 jours après la livraison. S'arrête à `deadline` (budget du cron). Ne jette jamais.
 */
export const REVIEW_REQUEST_AFTER_DAYS = 3;
const GIVE_UP_AFTER_DAYS = 14; // premier passage : pas de vague d'e-mails sur des livraisons anciennes (audit Tariq)
const MAX_PER_RUN = 15;

type OrderRow = {
  id: string;
  number: string;
  name: string;
  email: string | null;
  locale: string | null;
  order_items: { product_id: string | null; name: string }[] | null;
};

export async function sendReviewRequests(
  admin: SupabaseClient,
  opts: { now?: number; deadline?: number } = {},
): Promise<{ sent: number; skipped: number; failed: number }> {
  const now = opts.now ?? Date.now();
  const deadline = opts.deadline ?? Number.POSITIVE_INFINITY;
  const out = { sent: 0, skipped: 0, failed: 0 };
  const from = new Date(now - GIVE_UP_AFTER_DAYS * 86_400_000).toISOString();
  const to = new Date(now - REVIEW_REQUEST_AFTER_DAYS * 86_400_000).toISOString();
  const { data, error } = await admin
    .from("orders")
    .select("id,number,name,email,locale,order_items(product_id,name)")
    .eq("status", "livree")
    .is("review_requested_at", null)
    .not("email", "is", null)
    .gte("delivered_at", from)
    .lte("delivered_at", to)
    .order("delivered_at", { ascending: true })
    .limit(MAX_PER_RUN);
  if (error || !data) return out; // colonne absente (0015 non appliquée) : rien à faire

  for (const o of data as unknown as OrderRow[]) {
    if (Date.now() >= deadline) break; // budget de temps du cron : le reste partira demain
    try {
      const locale = o.locale === "en" ? "en" : "fr";
      const ids = [...new Set((o.order_items ?? []).map((i) => i.product_id).filter((x): x is string => !!x))];
      const { data: tr } = ids.length
        ? await admin.from("product_translations").select("product_id,slug,name,locale").in("product_id", ids).eq("locale", locale)
        : { data: [] as { product_id: string; slug: string; name: string }[] };
      const products = ids
        .map((id) => (tr ?? []).find((t) => t.product_id === id))
        .filter((t): t is { product_id: string; slug: string; name: string; locale: string } => !!t)
        .map((t) => ({ name: t.name, slug: t.slug }));
      const email = renderReviewRequest({ locale, firstName: (o.name ?? "").split(/\s+/)[0] ?? "", orderNumber: o.number, products, siteUrl: siteUrl() });
      if (!email || !o.email) {
        // Rien à demander (pack seul, produits supprimés, site sans URL) : on marque pour ne plus y revenir.
        await admin.from("orders").update({ review_requested_at: new Date(now).toISOString() }).eq("id", o.id);
        out.skipped += 1;
        continue;
      }
      // Marquée AVANT l'envoi (jamais deux e-mails si la mise à jour échouait après coup), remise à zéro si l'envoi échoue.
      const { data: claimed } = await admin
        .from("orders")
        .update({ review_requested_at: new Date(now).toISOString() })
        .eq("id", o.id)
        .is("review_requested_at", null)
        .select("id");
      if (!claimed?.length) {
        out.skipped += 1;
        continue;
      }
      const res = await sendViaResend({ to: o.email, subject: email.subject, html: email.html, text: email.text, idempotencyKey: `review:${o.id}` });
      if (!res.ok) {
        await admin.from("orders").update({ review_requested_at: null }).eq("id", o.id);
        out.failed += 1;
        continue;
      }
      out.sent += 1;
    } catch {
      out.failed += 1;
    }
  }
  return out;
}
