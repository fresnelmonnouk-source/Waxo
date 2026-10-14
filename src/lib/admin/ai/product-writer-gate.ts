// Garde-fou de publication d'une fiche produit : un produit ACTIF (visible en boutique) ne s'enregistre pas tant qu'un de
// ses textes publics contient encore un texte PROVISOIRE laissé par le rédacteur IA. Un produit masqué (brouillon) peut
// l'être. Module PUR, appelé par le tiroir produit (client) ET par les server actions (serveur : create, update,
// setProductActive). Testé (tests/product-writer-gate.test.ts).
//
// Texte provisoire (audit Raphaël 🟡3 / Zoé Z3-Z4, 2026-10-14), après normalisation NFC (« a » + accent combinant = « à ») :
//  - tout segment entre crochets, ASCII ou pleine largeur (« [à confirmer] », « [TBD] », « [taille à confirmer] »,
//    « [numéro masqué] », « ［à confirmer］ »), y compris un crochet ouvrant non refermé (marqueur coupé par une limite de
//    longueur) : une fiche produit n'a aucune raison légitime de contenir des crochets ;
//  - une parenthèse qui contient « à confirmer », « à vérifier », « à préciser », « to be confirmed », « to be
//    determined », « TBD » ou « TBC ».
import { DETAIL_KEYS, DETAIL_MAX, type DetailKey, type ProductDetails } from "@/lib/catalog/details";
import { DRAFT_FIELD_LABEL, type DraftField } from "./product-draft";

const KEY_SRC = String.raw`(?<!\p{L})[àa]\s+(?:confirmer|v[ée]rifier|pr[ée]ciser)|to\s+be\s+(?:confirmed|determined)|\btb[cd]\b`;
/** Crochet ouvrant (ASCII ou pleine largeur) : le segment commence là. */
const BRACKET_RE = /[[［]/;
/** Parenthèse (ASCII ou pleine largeur) contenant un mot de marqueur sur la même ligne (fermante facultative). */
const PAREN_RE = new RegExp(String.raw`[(（][^()（）\n]{0,200}?(?:${KEY_SRC})`, "iu");

/** Segment provisoire trouvé (pour le message), ou null. */
export function findMarker(s: string | null | undefined): string | null {
  if (typeof s !== "string" || !s) return null;
  const t = s.normalize("NFC");
  const b = BRACKET_RE.exec(t);
  const p = PAREN_RE.exec(t);
  const m = b && (!p || b.index <= p.index) ? b : p;
  if (!m) return null;
  const close = m === b ? /[\]］\n]/ : /[)）\n]/;
  const rest = t.slice(m.index);
  const end = rest.search(close);
  const seg = end >= 0 && rest[end] !== "\n" ? rest.slice(0, end + 1) : rest.split("\n")[0];
  return seg.length > 40 ? `${seg.slice(0, 39)}…` : seg;
}

export const hasTbcMarker = (s: string | null | undefined): boolean => findMarker(s) !== null;

/**
 * Nom débarrassé de ses marqueurs, pour fabriquer le slug (audit Victor W2) : l'URL publique, fixée à la première
 * sauvegarde, ne contient jamais « a-confirmer », « to-be-confirmed », « tbd »…
 */
export function stripMarkers(name: string): string {
  return name
    .normalize("NFC")
    .replace(/[[［][^\]］\n]*(?:[\]］]|$)/gm, " ")
    .replace(new RegExp(String.raw`[(（][^()（）\n]{0,200}?(?:${KEY_SRC})[^()（）\n]*(?:[)）]|$)`, "gimu"), " ")
    .replace(new RegExp(KEY_SRC, "giu"), " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Champs texte contrôlés (mêmes noms que le formulaire produit). */
export type GateValues = {
  active: boolean;
  name: string;
  nameEn: string | null;
  description: string;
  descriptionEn: string;
  keyword: string;
  details: ProductDetails;
  detailsEn: ProductDetails;
};

/** Clé d'erreur d'une rubrique (identique à `detailErrorKey` du formulaire : `d_color`, `en_color`). */
const detailKey = (k: DetailKey, en: boolean) => `${en ? "en" : "d"}_${k}`;

/** Libellé lisible d'une clé d'erreur du formulaire (« d_specs » → « Caractéristiques techniques »). */
export function gateFieldLabel(key: string): string {
  const m = key.match(/^(d|en)_(.+)$/);
  if (m && (DETAIL_KEYS as readonly string[]).includes(m[2])) return DRAFT_FIELD_LABEL(`${m[1] === "en" ? "en" : "fr"}.${m[2]}` as DraftField);
  return DRAFT_FIELD_LABEL(key as DraftField);
}

export const TBC_FIELD_MESSAGE = (segment: string) => `Contient « ${segment} » : remplacez-le par la bonne information.`;

/** Message global : nomme les champs à corriger (la liste des produits n'affiche que ce message). */
export function tbcPublishMessage(keys: readonly string[]): string {
  const labels = keys.map(gateFieldLabel);
  const list = labels.length > 4 ? `${labels.slice(0, 4).join(", ")}… (${labels.length} champs)` : labels.join(", ");
  return `Ce produit est visible en boutique : remplacez le texte provisoire (entre crochets, ou « à confirmer ») dans ${labels.length > 1 ? "ces champs" : "ce champ"} : ${list}. Ou masquez le produit pour le garder en brouillon.`;
}

/**
 * Champs (clés d'erreur du formulaire) qui contiennent un texte provisoire, quel que soit l'état actif/masqué, avec le
 * segment trouvé. Sans nom anglais, la version anglaise n'est pas enregistrée : ses champs ne sont pas contrôlés.
 */
export function tbcFindings(v: Omit<GateValues, "active">): [string, string][] {
  const out: [string, string][] = [];
  const check = (key: string, s: string | null | undefined) => {
    const seg = findMarker(s);
    if (seg) out.push([key, seg]);
  };
  const en = !!v.nameEn?.trim();
  check("name", v.name);
  check("description", v.description);
  if (en) {
    check("nameEn", v.nameEn);
    check("descriptionEn", v.descriptionEn);
  }
  check("keyword", v.keyword);
  for (const k of DETAIL_KEYS) {
    check(detailKey(k, false), v.details?.[k]);
    if (en) check(detailKey(k, true), v.detailsEn?.[k]);
  }
  return out;
}

export const tbcFields = (v: Omit<GateValues, "active">): string[] => tbcFindings(v).map(([k]) => k);

/** null = enregistrement permis ; sinon message + erreurs par champ (produit actif avec au moins un texte provisoire). */
export function publishGate(v: GateValues): { message: string; fields: Record<string, string> } | null {
  if (!v.active) return null;
  const found = tbcFindings(v);
  if (!found.length) return null;
  return { message: tbcPublishMessage(found.map(([k]) => k)), fields: Object.fromEntries(found.map(([k, seg]) => [k, TBC_FIELD_MESSAGE(seg)])) };
}

/** Ligne de traduction lue en base (rubriques absentes avant 0025). */
type TrRow = { locale?: unknown; name?: unknown; description?: unknown } & Partial<Record<DetailKey, unknown>>;

const str = (x: unknown) => (typeof x === "string" ? x : "");
const detailsOf = (r: TrRow | undefined): ProductDetails =>
  Object.fromEntries(DETAIL_KEYS.map((k) => [k, str(r?.[k]).slice(0, DETAIL_MAX[k] * 2)])) as ProductDetails;

/** Remise en ligne depuis la liste (sans formulaire) : contrôle des textes déjà enregistrés. */
export function publishGateFromRows(keyword: unknown, rows: readonly TrRow[] | null | undefined): ReturnType<typeof publishGate> {
  const fr = rows?.find((r) => r.locale === "fr");
  const en = rows?.find((r) => r.locale === "en");
  return publishGate({
    active: true,
    name: str(fr?.name),
    nameEn: en ? str(en.name) : null,
    description: str(fr?.description),
    descriptionEn: str(en?.description),
    keyword: str(keyword),
    details: detailsOf(fr),
    detailsEn: detailsOf(en),
  });
}
