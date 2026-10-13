import { norm } from "./text";

/**
 * Filtre d'escalade, appliqué AVANT tout appel au modèle : une demande personnelle de remboursement, un litige,
 * une question de santé ou de droit n'est jamais traitée par l'assistant (redirection vers l'équipe).
 * Une question générale sur la politique de retour reste traitée par la base de connaissances.
 */
export type EscalationKind = "refund" | "health" | "legal";

const REFUND: RegExp[] = [
  /\b(litige|arnaque|arnaqu|escroc|escroquerie|plainte|avocat|tribunal|huissier|fraude|frauduleu|contester|chargeback|mise en demeure)/,
  /\b(je veux|je souhaite|j exige|exige|reclame|demande)\b.{0,30}\brembours/,
  /\brembours\w*[- ]?(moi|nous)\b/,
  /\b(mon|ma|mes)\b.{0,12}\brembours/,
  /\b(jamais|pas|toujours pas)\b.{0,25}\b(recu|livre|arrive)/,
  /\b(scam|scammed|fraud|lawyer|sue\b|lawsuit|dispute|complaint|complain|stole|ripped off)/,
  /\b(i want|i need|i demand|give me|send me)\b.{0,25}\brefund/,
  /\b(my|the)\b.{0,12}\brefund/,
  /\brefund me\b/,
  /\b(never|not|still not)\b.{0,25}\b(received|delivered|arrived)/,
];

const HEALTH: RegExp[] = [
  /\b(allerg|brulure|brule|blessur|blesse|medecin|docteur|hopital|urgence|enceinte|medicament|poison|intoxic|saigne|infection|demangeaison|eruption|irritation)/,
  /\b(allergic|allergy|burn\b|burned|burnt|injur|doctor|hospital|emergency|pregnan|medication|medical|bleeding|rash|itching|poisoning)/,
  /\b(sante|maladie|symptom|diagnostic)/,
];

const LEGAL: RegExp[] = [
  /\b(juridique|legalement|legal|illegal|loi\b|lois\b|droit des|mes droits|rgpd|donnees personnelles|supprimer mes donnees|conformite)/,
  /\b(legal advice|my rights|the law\b|gdpr|personal data|delete my data|compliance|liable|liability)/,
];

export function detectEscalation(text: string): EscalationKind | null {
  const n = norm(text).replace(/[’']/g, " ");
  if (HEALTH.some((re) => re.test(n))) return "health";
  if (REFUND.some((re) => re.test(n))) return "refund";
  if (LEGAL.some((re) => re.test(n))) return "legal";
  return null;
}

// ───────────────────────── Passage à l'équipe : ouverture d'une discussion ─────────────────────────
// Le bouton « Contacter l'équipe » d'une réponse d'escalade mène au formulaire de contact pré-rempli : catégorie déduite
// du motif, message = résumé des derniers messages du visiteur (lus dans la mémoire de l'onglet, jamais dans l'URL).
// L'envoi crée une conversation `source = 'assistant'` (POST /api/contact).

export const ESCALATION_KINDS: readonly EscalationKind[] = ["refund", "health", "legal"];
export const isEscalationKind = (v: unknown): v is EscalationKind => typeof v === "string" && (ESCALATION_KINDS as readonly string[]).includes(v);

/** Lien du bouton « Contacter l'équipe » d'une réponse d'escalade (chemin interne, sans donnée personnelle). */
export function escalationContactPath(kind: EscalationKind): string {
  return `/contact?depuis=assistant&motif=${kind}`;
}

const RETURN_WORDS = /\b(rembours\w*|refund\w*|retour\w*|retourn\w*|return\w*|echang\w*|exchang\w*)/;

/** Catégorie de la discussion ouverte depuis l'assistant. */
export function escalationCategory(kind: EscalationKind, text = ""): "plainte" | "retour" | "question" {
  if (kind === "legal") return "question";
  if (kind === "health") return "plainte";
  return RETURN_WORDS.test(norm(text)) ? "retour" : "plainte";
}

/** Résumé de la demande pour pré-remplir le message : les 3 derniers messages du visiteur, 1 500 caractères au plus. */
export function escalationSummary(userTexts: string[], max = 1500): string {
  const lines = userTexts
    .map((t) => String(t ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(-3);
  const text = lines.join("\n");
  return text.length <= max ? text : text.slice(text.length - max);
}
