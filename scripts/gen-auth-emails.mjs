// Génère les modèles d'e-mails de compte Supabase Auth (supabase/email-templates/*.html) depuis le gabarit commun du site
// (src/lib/email/layout.ts, chargé tel quel grâce au retrait des types de Node ≥ 22.18).
// Usage : node scripts/gen-auth-emails.mjs   puis   supabase config push (voir docs/emails/supabase-auth.md).
//
// Contraintes Supabase (GoTrue) : pas de variable personnalisée → marque écrite en dur ; une seule version par modèle →
// FR/EN choisis par condition sur `locale` (métadonnée posée à l'inscription), français par défaut ; aucune donnée saisie par
// l'utilisateur n'est insérée (pas d'injection possible). Variables utilisées : .TokenHash, .Token, .SiteURL, .NewEmail.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { button, code, fallbackLink, helpBlock, join as j, notice, p, raw, renderLayout } from "../src/lib/email/layout.ts";

const OUT = "supabase/email-templates";
const LOGO = "{{ .SiteURL }}/email/logo-light.png";
// Lien sur le domaine de la boutique (et non supabase.co), traité par src/app/api/auth/confirm/route.ts. La langue vient de la
// branche FR/EN du modèle.
const confirmLink = (type) => (locale) => `{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=${type}&lang=${locale}`;

const COMMON = {
  fr: {
    hello: "Bonjour,",
    sign: "L'équipe Wá xɔ",
    fallback: "Le bouton ne fonctionne pas ? Copiez ce lien dans votre navigateur :",
    helpTitle: "Une question ?",
    help: raw('Écrivez-nous depuis la page <a href="{{ .SiteURL }}/fr/contact" style="color:#141210;font-weight:600;">Contact</a> du site.'),
    footer: [
      "Wá xɔ · Les petites choses utiles, livrées demain · Cotonou, Bénin",
      "Vous recevez cet e-mail à la suite d'une action sur votre compte Wá xɔ.",
      "Nous ne vous demanderons jamais votre mot de passe ni votre code secret Mobile Money.",
    ],
  },
  en: {
    hello: "Hello,",
    sign: "The Wá xɔ team",
    fallback: "Button not working? Copy this link into your browser:",
    helpTitle: "A question?",
    help: raw('Message us from the <a href="{{ .SiteURL }}/en/contact" style="color:#141210;font-weight:600;">Contact</a> page.'),
    footer: [
      "Wá xɔ · Useful little things, delivered tomorrow · Cotonou, Benin",
      "You are receiving this email following an action on your Wá xɔ account.",
      "We will never ask for your password or your Mobile Money PIN.",
    ],
  },
};

/** Un modèle = textes FR et EN. `body(c, t)` construit le corps avec les textes communs `c` et propres `t`. */
const TEMPLATES = {
  confirmation: {
    subject: "Confirmez votre adresse e-mail · Wá xɔ",
    fr: {
      eyebrow: "Bienvenue chez Wá xɔ",
      heading: "Confirmez votre adresse e-mail",
      preheader: "Un clic pour activer votre compte et suivre vos commandes.",
      lines: ["Merci d'avoir créé votre compte. Confirmez votre adresse pour l'activer : vous pourrez suivre vos commandes, garder vos favoris et commander plus vite."],
      cta: "Confirmer mon adresse",
      after: "Vous n'avez pas créé de compte ? Ignorez simplement ce message, rien ne sera activé.",
    },
    en: {
      eyebrow: "Welcome to Wá xɔ",
      heading: "Confirm your email address",
      preheader: "One click to activate your account and track your orders.",
      lines: ["Thank you for creating your account. Confirm your address to activate it: you will be able to track your orders, keep your favourites and check out faster."],
      cta: "Confirm my address",
      after: "Didn't create an account? Simply ignore this message, nothing will be activated.",
    },
    link: confirmLink("email"),
  },
  recovery: {
    subject: "Réinitialisez votre mot de passe · Wá xɔ",
    fr: {
      eyebrow: "Sécurité du compte",
      heading: "Choisissez un nouveau mot de passe",
      preheader: "Le lien est valable une heure.",
      lines: ["Vous avez demandé à réinitialiser le mot de passe de votre compte Wá xɔ. Cliquez sur le bouton pour en choisir un nouveau. Le lien est valable une heure et ne sert qu'une fois."],
      cta: "Choisir un nouveau mot de passe",
      after: "Vous n'avez rien demandé ? Ignorez ce message : votre mot de passe actuel reste valable.",
    },
    en: {
      eyebrow: "Account security",
      heading: "Choose a new password",
      preheader: "The link is valid for one hour.",
      lines: ["You asked to reset the password of your Wá xɔ account. Click the button to choose a new one. The link is valid for one hour and works only once."],
      cta: "Choose a new password",
      after: "Didn't ask for this? Ignore this message: your current password still works.",
    },
    link: confirmLink("recovery"),
  },
  email_change: {
    subject: "Confirmez votre nouvelle adresse e-mail · Wá xɔ",
    fr: {
      eyebrow: "Sécurité du compte",
      heading: "Confirmez votre nouvelle adresse",
      preheader: "Confirmez le changement d'adresse de votre compte.",
      lines: [raw("Vous avez demandé à utiliser <strong style=\"color:#141210;\">{{ .NewEmail }}</strong> pour votre compte Wá xɔ. Confirmez ce changement avec le bouton ci-dessous.")],
      cta: "Confirmer la nouvelle adresse",
      after: "Ce n'était pas vous ? Ne cliquez pas et contactez-nous : votre adresse actuelle reste active.",
    },
    en: {
      eyebrow: "Account security",
      heading: "Confirm your new address",
      preheader: "Confirm the email change on your account.",
      lines: [raw("You asked to use <strong style=\"color:#141210;\">{{ .NewEmail }}</strong> for your Wá xɔ account. Confirm this change with the button below.")],
      cta: "Confirm the new address",
      after: "Wasn't you? Don't click and contact us: your current address stays active.",
    },
    link: confirmLink("email_change"),
  },
  magic_link: {
    subject: "Votre lien de connexion · Wá xɔ",
    fr: {
      eyebrow: "Connexion",
      heading: "Votre lien de connexion",
      preheader: "Connectez-vous en un clic. Lien valable une heure.",
      lines: ["Cliquez sur le bouton pour vous connecter à votre compte Wá xɔ. Le lien est valable une heure et ne sert qu'une fois."],
      cta: "Me connecter",
      after: "Vous n'avez pas demandé à vous connecter ? Ignorez ce message.",
    },
    en: {
      eyebrow: "Sign in",
      heading: "Your sign-in link",
      preheader: "Sign in with one click. Link valid for one hour.",
      lines: ["Click the button to sign in to your Wá xɔ account. The link is valid for one hour and works only once."],
      cta: "Sign me in",
      after: "Didn't try to sign in? Ignore this message.",
    },
    link: confirmLink("email"),
  },
  invite: {
    subject: "Vous êtes invité(e) sur Wá xɔ",
    fr: {
      eyebrow: "Invitation",
      heading: "Vous êtes invité(e) sur Wá xɔ",
      preheader: "Acceptez l'invitation et choisissez votre mot de passe.",
      lines: ["Un compte Wá xɔ a été créé pour vous. Acceptez l'invitation pour l'activer et choisir votre mot de passe."],
      cta: "Accepter l'invitation",
      after: "Vous ne vous attendiez pas à cette invitation ? Ignorez ce message.",
    },
    en: {
      eyebrow: "Invitation",
      heading: "You're invited to Wá xɔ",
      preheader: "Accept the invitation and choose your password.",
      lines: ["A Wá xɔ account was created for you. Accept the invitation to activate it and choose your password."],
      cta: "Accept the invitation",
      after: "Not expecting this invitation? Ignore this message.",
    },
    link: confirmLink("invite"),
  },
  reauthentication: {
    subject: "Votre code de vérification · Wá xɔ",
    fr: {
      eyebrow: "Sécurité du compte",
      heading: "Votre code de vérification",
      preheader: "Saisissez ce code pour confirmer l'opération.",
      lines: ["Saisissez ce code pour confirmer l'opération en cours sur votre compte. Il est valable une heure."],
      after: "Ne communiquez ce code à personne, pas même à l'équipe Wá xɔ. Vous n'êtes à l'origine de rien ? Changez votre mot de passe.",
    },
    en: {
      eyebrow: "Account security",
      heading: "Your verification code",
      preheader: "Enter this code to confirm the operation.",
      lines: ["Enter this code to confirm the current operation on your account. It is valid for one hour."],
      after: "Never share this code, not even with the Wá xɔ team. Didn't start anything? Change your password.",
    },
    token: "{{ .Token }}",
  },
  password_changed_notification: {
    notification: "password_changed",
    subject: "Votre mot de passe a été modifié · Wá xɔ",
    fr: {
      eyebrow: "Sécurité du compte",
      heading: "Mot de passe modifié",
      preheader: "Le mot de passe de votre compte vient d'être changé.",
      lines: ["Le mot de passe de votre compte Wá xɔ vient d'être modifié. Si c'est bien vous, vous n'avez rien à faire."],
      after: "Ce n'était pas vous ? Réinitialisez tout de suite votre mot de passe depuis la page de connexion, puis contactez-nous.",
    },
    en: {
      eyebrow: "Account security",
      heading: "Password changed",
      preheader: "The password of your account was just changed.",
      lines: ["The password of your Wá xɔ account was just changed. If it was you, there is nothing to do."],
      after: "Wasn't you? Reset your password right away from the sign-in page, then contact us.",
    },
  },
  email_changed_notification: {
    notification: "email_changed",
    subject: "L'adresse e-mail de votre compte a été modifiée · Wá xɔ",
    fr: {
      eyebrow: "Sécurité du compte",
      heading: "Adresse e-mail modifiée",
      preheader: "L'adresse e-mail de votre compte vient d'être changée.",
      lines: ["L'adresse e-mail de votre compte Wá xɔ vient d'être modifiée. Si c'est bien vous, vous n'avez rien à faire."],
      after: "Ce n'était pas vous ? Contactez-nous au plus vite pour sécuriser votre compte.",
    },
    en: {
      eyebrow: "Account security",
      heading: "Email address changed",
      preheader: "The email address of your account was just changed.",
      lines: ["The email address of your Wá xɔ account was just changed. If it was you, there is nothing to do."],
      after: "Wasn't you? Contact us as soon as possible to secure your account.",
    },
  },
};

function render(locale, tpl) {
  const c = COMMON[locale];
  const t = tpl[locale];
  const link = tpl.link?.(locale);
  const body = j(
    p(c.hello, "strong"),
    ...t.lines.map((l) => p(l)),
    link ? button(link, t.cta) : null,
    tpl.token ? code(tpl.token) : null,
    t.after ? notice(t.after) : null,
    link ? fallbackLink(c.fallback, link) : null,
    p(c.sign, "strong"),
  );
  return renderLayout({
    locale,
    title: t.heading,
    preheader: t.preheader,
    eyebrow: t.eyebrow,
    heading: t.heading,
    body,
    help: helpBlock(c.helpTitle, c.help),
    footer: c.footer,
    logoUrl: LOGO,
  });
}

mkdirSync(OUT, { recursive: true });
const toml = [];
for (const [name, tpl] of Object.entries(TEMPLATES)) {
  // Anglais si la langue enregistrée à l'inscription est « en » ; sinon français (comptes anciens compris).
  // Notifications de sécurité : jeu de variables propre selon les versions de Supabase → français seul, sans condition
  // (un modèle qui ne s'exécute pas = e-mail non envoyé).
  const html = tpl.notification
    ? `${render("fr", tpl)}\n`
    : `{{ if and .Data .Data.locale (eq .Data.locale "en") }}${render("en", tpl)}{{ else }}${render("fr", tpl)}{{ end }}\n`;
  writeFileSync(join(OUT, `${name}.html`), html);
  const section = tpl.notification ? `[auth.email.notification.${tpl.notification}]\nenabled = true\n` : `[auth.email.template.${name}]\n`;
  toml.push(`${section}subject = "${tpl.subject.replace(/"/g, '\\"')}"\ncontent_path = "./supabase/email-templates/${name}.html"\n`);
  console.log("écrit", `${OUT}/${name}.html`, `(${Math.round(html.length / 1024)} Ko)`);
}
// supabase/config.toml VOLONTAIREMENT MINIMAL : `supabase config push` ne modifie que ce qui y est déclaré
// (jamais un config.toml complet issu de `supabase init` : il écraserait les réglages de production par des valeurs locales).
const header = `# Généré par scripts/gen-auth-emails.mjs — ne pas éditer à la main (modifier le script puis le relancer).
# Pousser : npx supabase config push --project-ref btarkkjimnkmiaxzonzq   (voir docs/emails/supabase-auth.md)
project_id = "waxo"

[auth]
site_url = "https://www.waxo.boutique"
additional_redirect_urls = ["https://www.waxo.boutique/api/auth/callback/**", "https://waxo.boutique/api/auth/callback/**", "http://localhost:3007/api/auth/callback/**"]

[auth.email]
enable_confirmations = true

# Envois par heure une fois le SMTP Resend branché (sans SMTP personnalisé, Supabase plafonne à quelques e-mails par heure).
[auth.rate_limit]
email_sent = 60

`;
writeFileSync("supabase/config.toml", header + toml.join("\n"));
console.log("écrit supabase/config.toml");
