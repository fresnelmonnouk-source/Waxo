// Gabarit commun de TOUS les e-mails Wá xɔ (commandes, alertes boutique, e-mails de compte Supabase générés par
// scripts/gen-auth-emails.mjs). Design repris du site : fond crème, bandeau encre comme le héro de l'accueil (titre Unbounded,
// sur-titre terre cuite), carte blanche arrondie, bouton soleil en pilule, suivi de commande en étapes.
// Compatible clients mail : tables, styles en ligne, bouton « bulletproof », largeur max 600 px, aucune image indispensable
// (le logo a un texte alternatif stylé). Module PUR et sans import : il est aussi chargé tel quel par Node (script de génération).
// Toute chaîne passée aux composants est ÉCHAPPÉE ; seul `raw()` insère du HTML tel quel (réservé aux gabarits de confiance).

export type EmailLocale = "fr" | "en";

export const C = {
  ink: "#141210",
  cream: "#F4F1EA",
  terracotta: "#E2552B",
  terracottaDeep: "#9A3412",
  sun: "#FFC93C",
  text: "#4A443C",
  muted: "#6B645A",
  border: "#E2DCCF",
  card: "#FFFFFF",
  soft: "#FAF8F3",
  leaf: "#1F6B4A",
  leafBg: "#E3EFE8",
};
export const FONT_TITLE = "'Unbounded','Segoe UI',Helvetica,Arial,sans-serif";
export const FONT_BODY = "'Onest','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Fragment HTML déjà construit (composants ci-dessous) : jamais de donnée utilisateur brute. */
export type Html = { __html: string };
export const raw = (html: string): Html => ({ __html: html });
const esc = (v: string | Html): string => (typeof v === "string" ? escapeHtml(v).replace(/\n/g, "<br>") : v.__html);

// ───────────────────────── Composants ─────────────────────────

/** Paragraphe. `tone: "strong"` = encre et gras (salutation, signature). */
export function p(text: string | Html, tone: "normal" | "strong" | "small" = "normal"): Html {
  const style =
    tone === "strong"
      ? `font:600 16px/1.6 ${FONT_BODY};color:${C.ink};`
      : tone === "small"
        ? `font:400 13px/1.6 ${FONT_BODY};color:${C.muted};`
        : `font:400 16px/1.6 ${FONT_BODY};color:${C.text};`;
  return raw(`<tr><td style="padding:0 0 16px;${style}">${esc(text)}</td></tr>`);
}

/** Bouton pilule soleil (rendu correct même sans CSS avancé : cellule colorée + lien). `href` doit être une URL sûre. */
export function button(href: string, label: string): Html {
  const h = escapeHtml(href);
  return raw(
    `<tr><td style="padding:8px 0 22px;"><table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;"><tr>` +
      `<td align="center" bgcolor="${C.sun}" style="background:${C.sun};border-radius:999px;">` +
      `<a href="${h}" style="display:inline-block;padding:16px 28px;font:600 16px/1 ${FONT_BODY};color:${C.ink};text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>` +
      `</td></tr></table></td></tr>`,
  );
}

/** Lien de secours sous un bouton (« si le bouton ne marche pas, copiez ce lien »). */
export function fallbackLink(intro: string, href: string): Html {
  const h = escapeHtml(href);
  return raw(
    `<tr><td style="padding:0 0 18px;font:400 13px/1.6 ${FONT_BODY};color:${C.muted};">${escapeHtml(intro)}<br>` +
      `<a href="${h}" style="color:${C.terracottaDeep};word-break:break-all;">${h}</a></td></tr>`,
  );
}

/** Encadré crème « libellé / valeur » (numéro de commande, total, livraison…). */
export function infoBox(rows: { label: string; value: string; strong?: boolean }[]): Html {
  const trs = rows
    .map(
      (r, i) =>
        `<tr><td style="padding:${i ? "10px" : "0"} 0 0;font:400 14px/1.4 ${FONT_BODY};color:${C.muted};">${escapeHtml(r.label)}</td>` +
        `<td align="right" style="padding:${i ? "10px" : "0"} 0 0;font:${r.strong ? 700 : 600} ${r.strong ? 17 : 15}px/1.4 ${FONT_BODY};color:${C.ink};">${escapeHtml(r.value)}</td></tr>`,
    )
    .join("");
  return raw(
    `<tr><td style="padding:0 0 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};border-radius:16px;">` +
      `<tr><td style="padding:16px 18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${trs}</table></td></tr></table></td></tr>`,
  );
}

/** Liste d'articles « 2 × Gourde … 13 000 F ». */
export function items(rows: { label: string; amount: string }[], title?: string): Html {
  const head = title ? `<tr><td colspan="2" style="padding:0 0 6px;font:600 13px/1.4 ${FONT_BODY};color:${C.muted};text-transform:uppercase;letter-spacing:.08em;">${escapeHtml(title)}</td></tr>` : "";
  const trs = rows
    .map(
      (r) =>
        `<tr><td style="padding:11px 12px 11px 0;border-bottom:1px solid ${C.border};font:400 15px/1.45 ${FONT_BODY};color:${C.ink};">${escapeHtml(r.label)}</td>` +
        `<td align="right" style="padding:11px 0;border-bottom:1px solid ${C.border};font:600 15px/1.45 ${FONT_BODY};color:${C.ink};white-space:nowrap;vertical-align:top;">${escapeHtml(r.amount)}</td></tr>`,
    )
    .join("");
  return raw(`<tr><td style="padding:0 0 18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${head}${trs}</table></td></tr>`);
}

/**
 * Suivi en étapes (comme la page « Suivre ma commande ») : étapes passées et courante en encre, courante soulignée de
 * terre cuite, suivantes en gris. `current` = index (0..n-1).
 */
export function steps(labels: string[], current: number): Html {
  const w = Math.floor(100 / labels.length);
  const cells = labels
    .map((label, i) => {
      const done = i <= current;
      const dot = done ? C.ink : C.border;
      const bar = i === current ? C.terracotta : done ? C.ink : C.border;
      return (
        `<td width="${w}%" valign="top" style="padding:0 3px;">` +
        `<div style="height:4px;line-height:4px;font-size:0;background:${bar};border-radius:4px;">&nbsp;</div>` +
        `<div style="padding-top:8px;font:${i === current ? 700 : 500} 12px/1.3 ${FONT_BODY};color:${done ? C.ink : C.muted};">` +
        `<span style="color:${dot};">●</span> ${escapeHtml(label)}</div></td>`
      );
    })
    .join("");
  return raw(`<tr><td style="padding:0 0 22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table></td></tr>`);
}

/** Gros code (vérification à 6 chiffres). */
export function code(value: string): Html {
  return raw(
    `<tr><td style="padding:4px 0 20px;"><div style="display:inline-block;background:${C.cream};border-radius:16px;padding:14px 22px;` +
      `font:700 30px/1 ${FONT_TITLE};letter-spacing:6px;color:${C.ink};">${escapeHtml(value)}</div></td></tr>`,
  );
}

/** Bandeau d'avertissement sobre (sécurité, « ce n'était pas vous ? »). */
export function notice(text: string | Html): Html {
  return raw(
    `<tr><td style="padding:0 0 18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.soft};border-left:3px solid ${C.terracotta};border-radius:0 12px 12px 0;">` +
      `<tr><td style="padding:12px 14px;font:400 14px/1.55 ${FONT_BODY};color:${C.text};">${esc(text)}</td></tr></table></td></tr>`,
  );
}

export const join = (...parts: (Html | null | undefined | false)[]): Html => raw(parts.filter(Boolean).map((x) => (x as Html).__html).join("\n"));

// ───────────────────────── Page ─────────────────────────

export type LayoutInput = {
  locale: EmailLocale;
  /** <title> et texte d'aperçu (affiché par les messageries sous l'objet). */
  title: string;
  preheader: string;
  /** Petit sur-titre terre cuite au-dessus du titre (ex. « COMMANDE WX-10263 »). */
  eyebrow?: string;
  /** Grand titre dans le bandeau encre. */
  heading: string;
  body: Html;
  /** Bloc « Besoin d'aide ? » (déjà construit), affiché sous la carte. */
  help?: Html | null;
  /** Lignes du pied de page (texte, échappé ; `Html` accepté pour un lien). */
  footer: (string | Html)[];
  /** URL absolue du logo clair (sur fond encre) ; null → logo en texte. */
  logoUrl: string | null;
};

export function renderLayout(i: LayoutInput): string {
  const logo = i.logoUrl
    ? `<img src="${escapeHtml(i.logoUrl)}" width="142" height="32" alt="Wá xɔ" style="display:block;border:0;outline:none;width:142px;height:32px;font:700 24px/32px ${FONT_TITLE};color:${C.cream};">`
    : `<span style="font:700 26px/1 ${FONT_TITLE};color:${C.cream};letter-spacing:-0.5px;">Wá x<span style="color:${C.terracotta};">ɔ</span></span>`;
  const eyebrow = i.eyebrow
    ? `<div style="padding:0 0 10px;font:600 12px/1.3 ${FONT_BODY};letter-spacing:.1em;text-transform:uppercase;color:${C.terracotta};">${escapeHtml(i.eyebrow)}</div>`
    : "";
  const footer = i.footer.map((l) => esc(l)).join("<br>");

  return `<!doctype html>
<html lang="${i.locale}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(i.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;600;700&amp;family=Unbounded:wght@700&amp;display=swap" rel="stylesheet">
<style>
  body{margin:0;padding:0;-webkit-text-size-adjust:100%;}
  a{color:${C.terracottaDeep};}
  @media (max-width:480px){ .wx-pad{padding-left:20px!important;padding-right:20px!important;} .wx-h1{font-size:24px!important;} }
</style>
</head>
<body style="margin:0;padding:0;background:${C.cream};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(i.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};">
<tr><td align="center" style="padding:28px 12px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td class="wx-pad" bgcolor="${C.ink}" style="background:${C.ink};border-radius:24px 24px 0 0;padding:26px 32px 28px;">
${logo}
<div style="height:26px;line-height:26px;font-size:0;">&nbsp;</div>
${eyebrow}
<h1 class="wx-h1" style="margin:0;font:700 28px/1.15 ${FONT_TITLE};letter-spacing:-0.6px;color:${C.cream};">${escapeHtml(i.heading)}</h1>
</td></tr>
<tr><td class="wx-pad" bgcolor="${C.card}" style="background:${C.card};border-radius:0 0 24px 24px;padding:28px 32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${i.body.__html}
</table>
</td></tr>
${i.help ? `<tr><td style="padding:14px 0 0;">${i.help.__html}</td></tr>` : ""}
<tr><td style="padding:22px 8px 0;font:400 12px/1.7 ${FONT_BODY};color:${C.muted};">${footer}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** Bloc « Besoin d'aide ? » sous la carte : fond blanc discret, lien WhatsApp. */
export function helpBlock(title: string, text: string | Html): Html {
  return raw(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border-radius:18px;">` +
      `<tr><td class="wx-pad" style="padding:16px 32px;font:400 14px/1.55 ${FONT_BODY};color:${C.text};">` +
      `<strong style="color:${C.ink};">${escapeHtml(title)}</strong><br>${esc(text)}</td></tr></table>`,
  );
}
