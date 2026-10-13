// Types et règles pures de la base de connaissances côté admin (client + serveur).

export type KbStatus = "draft" | "published";
export type KbSource = "manual" | "ai";
/** État affiché : une fiche publiée mais inactive est « Désactivée ». */
export type KbState = "published" | "draft" | "disabled";

export type AdminKbRow = {
  id: string;
  tag: string;
  title: string;
  text: string;
  keywords: string;
  active: boolean;
  status: KbStatus;
  source: KbSource;
  updatedAt: string | null;
};

export type KbListData = {
  rows: AdminKbRow[];
  /** false = base non branchée (démo) : lecture d'exemples, écritures refusées. */
  connected: boolean;
  /** false = migration 0022 pas encore appliquée (pas de colonne `status`) : brouillons impossibles. */
  draftsReady: boolean;
  /** true = base branchée mais lecture en échec (liste vide affichée, à recharger). */
  failed?: boolean;
};

export const KB_STATE_LABEL: Record<KbState, string> = { published: "Publiée", draft: "Brouillon", disabled: "Désactivée" };

export function kbStateOf(r: Pick<AdminKbRow, "status" | "active">): KbState {
  if (r.status === "draft") return "draft";
  return r.active ? "published" : "disabled";
}

/** Champs écrits pour passer une fiche dans un état donné (un brouillon n'est JAMAIS actif). */
export function fieldsForState(state: KbState): { status: KbStatus; active: boolean } {
  if (state === "published") return { status: "published", active: true };
  if (state === "draft") return { status: "draft", active: false };
  return { status: "published", active: false };
}

/** Marqueur laissé par l'IA quand une information manque : interdit à la publication. */
export const TBC = "[à confirmer]";
export const hasTbc = (s: string) => /\[\s*à\s+confirmer\s*\]/i.test(s);

/** Délai de prise en compte par l'assistant du site (cache mémoire de `src/lib/assistant/kb.ts`). */
export const ASSISTANT_KB_TTL_MIN = 5;
