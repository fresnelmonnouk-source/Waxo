import "server-only";
import { siteUrl } from "@/lib/payment/config";
import { button, join, p, renderLayout } from "./layout";
import { sendViaResend } from "./resend";
import { safeSiteUrl } from "./template";
import { ACTION_LABEL, type TeamAction } from "@/lib/admin/team";

/**
 * Alerte de sécurité envoyée à TOUS les admins à chaque changement de l'équipe (audit Raphaël) : un accès admin donné
 * ou retiré à l'insu des autres doit se voir. Ne jette jamais ; l'échec d'envoi ne bloque pas l'action.
 */
export async function sendTeamAlert(args: { to: string[]; actorEmail: string; targetEmail: string; action: TeamAction; key: string }): Promise<void> {
  const site = safeSiteUrl(siteUrl());
  const line = `${args.actorEmail} ${ACTION_LABEL[args.action]} ${args.targetEmail}.`;
  const subject = "Wá xɔ · changement dans l'équipe d'administration";
  const html = renderLayout({
    locale: "fr",
    title: subject,
    preheader: line,
    eyebrow: "Back office · sécurité",
    heading: "L'équipe d'administration a changé",
    body: join(
      p(line, "strong"),
      p("Si vous n'êtes pas à l'origine de ce changement et qu'il vous surprend, vérifiez l'équipe tout de suite et changez votre mot de passe."),
      site ? button(`${site}/admin/equipe`, "Voir l'équipe") : null,
    ),
    footer: ["Alerte automatique envoyée à chaque administrateur de la boutique Wá xɔ."],
    logoUrl: site ? `${site}/email/logo-light.png` : null,
  });
  const text = `${line}\n\nSi ce changement vous surprend, vérifiez l'équipe et changez votre mot de passe.${site ? `\n\n${site}/admin/equipe` : ""}`;
  await Promise.all(
    [...new Set(args.to.filter(Boolean))].map((to) =>
      sendViaResend({ to, subject, html, text, idempotencyKey: `team:${args.key}:${to}` }).catch(() => undefined),
    ),
  );
}
