import "server-only";
import fr from "@/messages/fr/security.json";
import en from "@/messages/en/security.json";

/**
 * Page intermédiaire des liens d'e-mail de compte (audit Raphaël F1) : le GET n'ouvre plus de session. Il affiche un
 * bouton qui POSTe le token_hash à /api/auth/confirm. Effets :
 *  - un lien de réinitialisation envoyé par un tiers (« confirmez votre commande ») n'ouvre plus SA session d'un clic ;
 *    l'avertissement est affiché avant ;
 *  - les antivirus de messagerie qui préchargent les liens ne consomment plus le jeton.
 * HTML autonome (pas de JS, styles en ligne autorisés par la CSP), textes dans messages/{fr,en}/security.json.
 */

export type ConfirmType = "email" | "signup" | "recovery" | "invite" | "magiclink" | "email_change";
type Copy = { title: string; text: string; button: string };

const MESSAGES = { fr: fr.Security.confirm, en: en.Security.confirm } as const;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function confirmCopy(lang: "fr" | "en", type: ConfirmType): Copy {
  const m = MESSAGES[lang];
  return type === "signup" || type === "email" ? m.email : m[type];
}

export function renderConfirmPage(input: { lang: "fr" | "en"; type: ConfirmType; tokenHash: string }): string {
  const m = MESSAGES[input.lang];
  const c = confirmCopy(input.lang, input.type);
  return `<!doctype html>
<html lang="${input.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(c.title)} | Waxo</title>
</head>
<body style="margin:0;background:#f4f1ea;color:#141210;font:400 16px/1.55 'Onest','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<main style="max-width:480px;margin:0 auto;padding:48px 20px;">
<p style="margin:0 0 28px;font:700 22px/1 'Unbounded','Segoe UI',sans-serif;letter-spacing:-0.02em;">${esc(m.brand)}</p>
<div style="background:#ffffff;border-radius:20px;padding:28px 22px;">
<h1 style="margin:0 0 10px;font:600 26px/1.15 'Unbounded','Segoe UI',sans-serif;letter-spacing:-0.03em;">${esc(c.title)}</h1>
<p style="margin:0 0 22px;color:#4a443c;">${esc(c.text)}</p>
<form method="post" action="/api/auth/confirm" style="margin:0;">
<input type="hidden" name="token_hash" value="${esc(input.tokenHash)}">
<input type="hidden" name="type" value="${esc(input.type)}">
<input type="hidden" name="lang" value="${input.lang}">
<button type="submit" autofocus style="width:100%;min-height:52px;border:0;border-radius:999px;background:#141210;color:#f4f1ea;font:600 16px/1 'Onest','Segoe UI',sans-serif;cursor:pointer;">${esc(c.button)}</button>
</form>
<p style="margin:20px 0 0;font-size:14px;color:#6b645a;">${esc(m.warning)}</p>
</div>
</main>
</body>
</html>`;
}
