// Espace « Discussion » : constantes et types partagés client + serveur (module PUR, aucune dépendance serveur).

export const CATEGORIES = ["question", "plainte", "retour", "commande", "autre"] as const;
export type Category = (typeof CATEGORIES)[number];

export const STATUSES = ["nouveau", "en_cours", "resolu"] as const;
export type Status = (typeof STATUSES)[number];

export const AUTHORS = ["client", "equipe", "note_interne"] as const;
export type Author = (typeof AUTHORS)[number];
/** Auteurs visibles du client : la note interne n'en fait JAMAIS partie. */
export type PublicAuthor = Exclude<Author, "note_interne">;

export const SOURCES = ["contact", "assistant", "suivi", "compte"] as const;
export type Source = (typeof SOURCES)[number];

export type Lang = "fr" | "en";

/** Libellés de l'admin (interface en français seulement). */
export const CATEGORY_LABELS: Record<Category, string> = {
  question: "Question",
  plainte: "Plainte",
  retour: "Retour ou remboursement",
  commande: "Commande",
  autre: "Autre",
};
export const STATUS_LABELS: Record<Status, string> = { nouveau: "Nouveau", en_cours: "En cours", resolu: "Résolu" };
export const SOURCE_LABELS: Record<Source, string> = {
  contact: "Formulaire de contact",
  assistant: "Assistant du site",
  suivi: "Suivi de commande",
  compte: "Mon compte",
};

export const isCategory = (v: unknown): v is Category => typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);
export const isStatus = (v: unknown): v is Status => typeof v === "string" && (STATUSES as readonly string[]).includes(v);
export const isSource = (v: unknown): v is Source => typeof v === "string" && (SOURCES as readonly string[]).includes(v);

export const BODY_MIN = 2;
export const BODY_MAX = 3000;

/** Message du fil tel qu'il est montré au CLIENT (jamais de note interne, jamais l'identifiant de l'admin). */
export type PublicMessage = { id: string; author: PublicAuthor; body: string; createdAt: string };

/** Fil vu par le client (page par lien privé ou « Mes demandes »). Aucune coordonnée n'y figure. */
export type PublicThread = {
  id: string;
  subject: string;
  category: Category;
  status: Status;
  orderNumber: string | null;
  createdAt: string;
  locale: Lang;
  messages: PublicMessage[];
};

/** Ligne de « Mes demandes ». */
export type MineRow = {
  id: string;
  subject: string;
  category: Category;
  status: Status;
  orderNumber: string | null;
  lastMessageAt: string;
  unread: boolean;
};

/** Ne garde que les messages visibles du client (filet de sécurité en plus de la RLS et des requêtes filtrées). */
export function publicMessages(rows: { id: unknown; author: unknown; body: unknown; created_at: unknown }[]): PublicMessage[] {
  return rows
    .filter((r) => r.author === "client" || r.author === "equipe")
    .map((r) => ({ id: String(r.id), author: r.author as PublicAuthor, body: String(r.body ?? ""), createdAt: String(r.created_at) }));
}

/** Objet affiché : premier passage du message, coupé proprement (jamais une phrase tronquée au milieu d'un mot). */
export function subjectFrom(body: string, max = 80): string {
  const flat = body.replace(/\s+/g, " ").trim();
  const firstSentence = flat.split(/(?<=[.!?])\s/)[0] ?? flat;
  const base = firstSentence.length <= max ? firstSentence : flat;
  if (base.length <= max) return base;
  const cut = base.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

/** Extrait court d'un texte (e-mails à l'équipe : jamais le contenu complet d'une plainte). */
export function excerpt(text: string, max = 200): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}
