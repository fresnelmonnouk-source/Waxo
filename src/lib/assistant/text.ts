/**
 * Outils texte purs de l'assistant (aucun accès serveur ni navigateur) : normalisation, racines de 6 lettres
 * (comme `tokens` de docs/maquettes/waxo-data.js), budget, synonymes.
 */

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// Mots vides de la maquette (sauf « combien ») + formules de politesse et verbes de demande, FR et EN :
// sans eux « Aidez-moi à choisir un produit » ramène n'importe quelle fiche qui contient « produit ».
const STOP = new Set(
  (
    "les des une est sont pour par sur avec dans cet cette ces que qui quoi quel quelle quels quelles vous nous ils elles mon mes votre vos notre nos pas plus " +
    "bonjour merci svp peut peux faire fait avez aussi tres bien " +
    "aidez aider choisir chercher cherche cherchez produit produits article articles voudrais veux besoin quelque chose conseille conseillez recommande recommandez " +
    "propose proposez salut bonsoir moins budget mais donc car ont suis etes cela ceci tout tous toute comme moi toi lui leur " +
    "the and for with you your are can what which how much many have has does please hello thanks thank this that from about want need would like any some our their " +
    "they them there here when where will shall should could hey help find looking look something anything"
  ).split(" "),
);

export const stem = (w: string) => w.slice(0, 6);

export function tokens(s: string): string[] {
  return norm(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map(stem);
}

/** Premières phrases d'un extrait (la maquette en garde 2). */
export function firstSentences(text: string, n = 2): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .slice(0, n)
    .join(" ");
}

const SPACES = /[  ]/g;

/** Budget annoncé par le visiteur (« 10 000 F », « 10k », « 5000 »), borné à une plage plausible en FCFA. */
export function parseBudget(raw: string): number | null {
  const s = raw.replace(SPACES, " ").toLowerCase();
  const re = /(\d{1,3}(?:[ .,]\d{3})+|\d+)(?:\s?(k|mille|thousand)\b)?/g;
  for (const m of s.matchAll(re)) {
    let v = parseInt(m[1].replace(/\D/g, ""), 10);
    if (!Number.isFinite(v)) continue;
    if (m[2]) v *= 1000;
    if (v >= 500 && v <= 1_000_000) return v;
  }
  return null;
}

/** Nombres d'un texte, sans séparateurs (« 15 000 » → « 15000 ») : sert à vérifier qu'une réponse n'invente aucun chiffre. */
export function numbersIn(s: string): string[] {
  const out: string[] = [];
  for (const m of s.replace(SPACES, " ").matchAll(/\d+(?:[ .,]\d{3})*/g)) out.push(m[0].replace(/\D/g, ""));
  return out;
}

// Synonymes d'usage → termes du catalogue (équivalent de `syn` de la maquette, étendu et bilingue).
const SYNONYMS: [RegExp, string][] = [
  [/\b(coupur|courant|delestage|power ?cut|outage|blackout|electricit|load.?shedding)/, "lampe batterie"],
  [/\b(moustiq|mosquito|insect)/, "raquette moustiques"],
  [/\b(chaleur|chaud|hot|heat|fan\b|ventilat)/, "ventilateur"],
  [/\b(telephon|phone|smartphone|portable)/, "chargeur batterie support"],
  [/\b(office|desk|travail|work\b|etude|study|cours\b|school|ecole)/, "bureau"],
  [/\b(travel|trip|voyag|valise|suitcase|luggage)/, "voyage valise"],
  [/\b(kitchen|cook|cuisin)/, "cuisine"],
  [/\b(beauty|makeup|make-up|maquill|skin|peau|visage|face)/, "beaute"],
  [/\b(music|musique|headphone|earbud|ecout|audio|sound)/, "ecouteurs son"],
  [/\b(dormir|sleep|sommeil)/, "masque dodo"],
  [/\b(soif|bottle|bouteille|boire|drink|water\b)/, "gourde"],
  [/\b(smoothie|juice|jus\b)/, "blender agrumes"],
  [/\b(barbe|beard|shave|raser)/, "tondeuse barbe"],
  [/\b(lumiere|light|lamp|eclair)/, "lampe"],
  [/\b(ranger|organi[sz]|storage|rangement)/, "organiseurs boites cables"],
];

export function expandSynonyms(text: string): string {
  const n = norm(text);
  const extra = SYNONYMS.filter(([re]) => re.test(n)).map(([, add]) => add);
  return extra.length ? `${text} ${extra.join(" ")}` : text;
}
