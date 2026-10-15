// Déroulé d'une rédaction IA dans le tiroir produit, sans React (testé : tests/product-writer-run.test.ts).
//
// Audit Victor W1 (2026-10-14) : la rédaction dure 10 à 48 s et le formulaire reste modifiable pendant ce temps. Les
// conflits se calculent donc sur les valeurs COURANTES, lues APRÈS la réponse (`getCurrent`), jamais sur celles du clic ;
// et `apply` doit appliquer la proposition sur l'état courant (setter fonctionnel côté tiroir), pas sur une copie figée.
import { draftConflicts, type DraftField, type DraftTarget, type ProductDraft } from "@/lib/admin/ai/product-draft";

export type WriterMode = "replace" | "fill-empty";
export type WriterResponse = { ok: true; draft: ProductDraft } | { ok: false; message: string };
export type WriterRunStatus =
  | { kind: "error"; message: string }
  | { kind: "confirm"; draft: ProductDraft; conflicts: DraftField[] }
  | { kind: "done"; filled: number; fromLink: number; warned: number };

/** Rappel permanent (Helena O1a, texte validé) : les faits venant du lien sont à vérifier sur l'article en main. */
export const LINK_REMINDER =
  "Le lien décrit un article semblable, pas forcément le vôtre. Avant d'enregistrer, vérifiez sur VOTRE article chaque information venant du lien : mesures, matières, contenance, puissance, autonomie, entretien (lave-vaisselle, micro-ondes, lavage). Supprimez ce que vous ne pouvez pas vérifier. Ne reprenez ni les photos, ni les avis, ni la marque d'un autre vendeur.";

/** Aide sous « Vos notes » (Helena J4, texte validé). */
export const NOTES_HELP =
  "Ce que vous savez de VOTRE article (vous l'avez en main). N'y mettez ni données de client, ni informations confidentielles (fournisseur, prix d'achat) : le texte est envoyé à un prestataire d'IA.";

export const CONNECTION_LOST = "Connexion interrompue. Réessayez.";

/** Bilan affiché après application : champs remplis, dont « à vérifier », dont avec un avertissement. */
export function doneStatus(draft: ProductDraft, filled: readonly DraftField[]): WriterRunStatus {
  return {
    kind: "done",
    filled: filled.length,
    fromLink: draft.fromLink.filter((f) => filled.includes(f)).length,
    warned: filled.filter((f) => draft.warnings?.[f]?.length).length,
  };
}

export async function runWriter(
  request: () => Promise<WriterResponse>,
  getCurrent: () => DraftTarget,
  apply: (draft: ProductDraft, mode: WriterMode) => DraftField[],
): Promise<WriterRunStatus> {
  let res: WriterResponse;
  try {
    res = await request();
  } catch {
    return { kind: "error", message: CONNECTION_LOST };
  }
  if (!res.ok) return { kind: "error", message: res.message };
  const conflicts = draftConflicts(getCurrent(), res.draft);
  if (conflicts.length) return { kind: "confirm", draft: res.draft, conflicts };
  return doneStatus(res.draft, apply(res.draft, "replace"));
}
