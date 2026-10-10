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
