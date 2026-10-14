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

function scrubSecretsAndEmails(input: string): string {
  let s = String(input ?? "");
  for (const v of envSecrets()) if (s.includes(v)) s = s.split(v).join(MASK.secret);
  for (const re of SECRET_RES) s = s.replace(re, MASK.secret);
  return s.replace(EMAIL_RE, MASK.email);
}

/** Masquage du corpus de l'IA admin (commandes, clients) : tout nombre de 8 chiffres ou plus est masqué. */
export function scrubText(input: string): string {
  return scrubSecretsAndEmails(input).replace(LONG_NUMBER_RE, MASK.number);
}

/**
 * Numéros de forme TÉLÉPHONE seulement (pas « 8 chiffres séparés ») :
 *  - Bénin avec indicatif : +229 / 00229 / 229 suivi de 8 à 10 chiffres (« +229 01 97 12 34 56 », « 22997123456 ») ;
 *  - Bénin, numéro à 10 chiffres commençant par 01, en un bloc ou par paires (« 0197123456 », « 01 97 12 34 56 ») ;
 *  - international évident : « + » ou « 00 » suivi de 7 à 15 chiffres (« +33 6 12 34 56 78 », « +1 (555) 123-4567 »).
 * Ne touche PAS aux listes de tailles ou de compatibilité (« 36 37 38 39 40 41 », « iPhone 12 13 14 15 », « USB 2.0 3.0 »).
 */
export const PHONE_RES: readonly RegExp[] = [
  /(?:\+|\b00|\b)229(?:[\s.\-]?\d){8,10}\b/g,
  /\b01(?:[\s.\-]?\d){8}\b/g,
  /(?:\+|\b00)[1-9](?:[\s.()\-]{0,2}\d){6,14}\b/g,
];

/**
 * Masquage pour le rédacteur IA des fiches produit (audit Zoé Z3) : e-mails, secrets (clés, jetons, variables
 * d'environnement sensibles) et numéros de forme téléphone. Les autres suites de chiffres (tailles, modèles compatibles,
 * normes) sont la matière même d'une fiche : elles restent intactes.
 */
export function scrubWriterText(input: string): string {
  let s = scrubSecretsAndEmails(input);
  for (const re of PHONE_RES) s = s.replace(re, MASK.number);
  return s;
}
