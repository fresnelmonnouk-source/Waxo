import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/payment/config";
import { getAdminIds } from "@/lib/admin/data/team";
import { withTimeout } from "@/lib/settings/db";
import { button, join, p, renderLayout } from "./layout";
import { sendViaResend } from "./resend";
import { safeSiteUrl } from "./template";

/**
 * Alerte de sécurité à TOUS les admins quand les clés de paiement FedaPay changent (audit Raphaël F2) : un admin
 * hameçonné qui colle SA clé détournerait tous les paiements Mobile Money sans que personne ne le voie.
 * Aucune clé en clair : seulement la version masquée (préfixe + 4 derniers caractères). Ne jette jamais.
 */

export type PaymentKeysChange = {
  actorEmail: string;
  /** Description lisible, ex. « a enregistré une nouvelle clé API (mode réel) ». */
  what: string[];
  /** Clé et secret actifs APRÈS le changement, masqués. */
  secretMasked: string | null;
  webhookMasked: string | null;
  mode: "sandbox" | "live" | null;
  at?: Date;
};

const MODE_LABEL = { live: "réel", sandbox: "essai" } as const;

/** Lignes du message (pures, testées). */
export function paymentAlertLines(c: PaymentKeysChange): { subject: string; lines: string[] } {
  const when = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Porto-Novo" }).format(c.at ?? new Date());
  const lines = [
    `${c.actorEmail || "Un administrateur"} ${c.what.join(" et ")}, le ${when} (heure du Bénin).`,
    `Clé API active : ${c.secretMasked ?? "aucune"}. Secret de webhook actif : ${c.webhookMasked ?? "aucun"}. Mode : ${c.mode ? MODE_LABEL[c.mode] : "non configuré"}.`,
  ];
  return { subject: "Wá xɔ · les clés de paiement ont changé", lines };
}

export async function sendPaymentKeysAlert(to: string[], c: PaymentKeysChange): Promise<void> {
  const site = safeSiteUrl(siteUrl());
  const { subject, lines } = paymentAlertLines(c);
  const warning =
    "Si vous n'êtes pas à l'origine de ce changement, effacez ces clés dans Réglages, changez votre mot de passe et vérifiez l'équipe : les paiements en ligne pourraient arriver sur un autre compte FedaPay.";
  const html = renderLayout({
    locale: "fr",
    title: subject,
    preheader: lines[0],
    eyebrow: "Back office · sécurité",
    heading: "Les clés de paiement ont changé",
    body: join(p(lines[0], "strong"), p(lines[1]), p(warning), site ? button(`${site}/admin/reglages`, "Voir les réglages") : null),
    footer: ["Alerte automatique envoyée à chaque administrateur de la boutique Wá xɔ."],
    logoUrl: site ? `${site}/email/logo-light.png` : null,
  });
  const text = `${lines.join("\n")}\n\n${warning}${site ? `\n\n${site}/admin/reglages` : ""}`;
  const key = `paykeys:${(c.at ?? new Date()).getTime()}`;
  await Promise.all(
    [...new Set(to.filter(Boolean))].map((addr) => sendViaResend({ to: addr, subject, html, text, idempotencyKey: `${key}:${addr}` }).catch(() => undefined)),
  );
}

/** Adresses de tous les admins (service_role). Liste vide en cas de panne : l'action admin n'échoue jamais pour ça. */
export async function adminEmails(sb: SupabaseClient): Promise<string[]> {
  try {
    const ids = await getAdminIds(sb);
    const emails = await Promise.all(
      ids.map((id) => withTimeout(sb.auth.admin.getUserById(id)).then((r) => r.data.user?.email ?? "").catch(() => "")),
    );
    return emails.filter(Boolean);
  } catch {
    return [];
  }
}
