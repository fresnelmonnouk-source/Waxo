// Masquage défensif de tout ce qui ressemble à une donnée personnelle ou à un secret, AVANT l'envoi à DeepSeek.
// Module pur (client + serveur). Le corpus est déjà construit sur liste blanche (corpus.ts) : ceci est la seconde barrière.

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** 8 chiffres ou plus, éventuellement séparés (espaces, points, tirets) : numéro de téléphone, de carte, IFU, RCCM… */
const LONG_NUMBER_RE = /\+?\d(?:[\s.\-  ]?\d){7,}/g;
const SECRET_RES: RegExp[] = [
  /\b(?:sk|pk|wh)_(?:sandbox|live|test)_[A-Za-z0-9_-]{4,}/g, // FedaPay et apparentés
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]+)?/g, // JWT (clés Supabase)
  /\bsk-[A-Za-z0-9_-]{16,}/g, // clés d'API style OpenAI / DeepSeek
  /\bre_[A-Za-z0-9_]{16,}/g, // Resend
  /\bBearer\s+[A-Za-z0-9._~+/-]{12,}=*/gi,
  /\b[A-Fa-f0-9]{32,}\b/g, // jetons hexadécimaux
  /\b[A-Za-z0-9+/_-]{40,}={0,2}/g, // longs jetons base64
];

export const MASK = { email: "[e-mail masqué]", number: "[numéro masqué]", secret: "[secret masqué]" } as const;

/** Variables d'environnement sensibles : leur valeur ne doit jamais apparaître dans un texte envoyé au modèle. */
function envSecrets(): string[] {
  const out: string[] = [];
  for (const [name, value] of Object.entries(process.env)) {
    if (!value || value.length < 8) continue;
    if (/KEY|SECRET|TOKEN|PASSWORD|DSN|SERVICE_ROLE/i.test(name) && !name.startsWith("NEXT_PUBLIC_")) out.push(value);
  }
  return out.sort((a, b) => b.length - a.length);
}

export function scrubText(input: string): string {
  let s = String(input ?? "");
  for (const v of envSecrets()) if (s.includes(v)) s = s.split(v).join(MASK.secret);
  for (const re of SECRET_RES) s = s.replace(re, MASK.secret);
  s = s.replace(EMAIL_RE, MASK.email);
  s = s.replace(LONG_NUMBER_RE, MASK.number);
  return s;
}
