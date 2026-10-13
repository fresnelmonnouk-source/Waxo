// Pseudonymisation AVANT tout envoi à l'IA (décision de Fresnel : aucune donnée personnelle de client chez DeepSeek).
// Retire des messages : e-mails, numéros de téléphone, liens, adresses postales évidentes, numéros de commande, et le nom
// du client tel qu'il l'a saisi. Module PUR (testé).

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
// 8 chiffres ou plus, séparés ou non par espaces, points, tirets, avec ou sans indicatif (+229, 00229).
const PHONE = /(?:\+|00)?\d(?:[\s.-]?\d){7,}/g;
const ORDER = /\bWX-?\s?\d{3,8}\b/gi;
// « lot 234 », « carré 1020 », « rue 12.345 », « quartier Akpakpa », « von de la pharmacie »… : le mot-clé et la suite.
const ADDRESS = /\b(?:(?:lot|carré|carre|parcelle|maison)\s+(?:n°\s*)?\d[^,;\n]{0,30}|(?:rue|quartier|von|street|avenue)\s+[^,;\n]{1,40})/gi;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Remplace les données personnelles par des marqueurs neutres. `names` : nom complet saisi par le client. */
export function redactPii(text: string, names: string[] = []): string {
  let out = String(text ?? "")
    .replace(EMAIL, "[e-mail]")
    .replace(URL_RE, "[lien]")
    .replace(ORDER, "[commande]")
    .replace(PHONE, "[téléphone]")
    .replace(ADDRESS, "[adresse]");
  const words = names
    .flatMap((n) => String(n ?? "").split(/[\s,.'’-]+/))
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);
  for (const w of [...new Set(words)].sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(w)}(?![\\p{L}\\p{N}])`, "giu"), "[nom]");
  }
  return out;
}
