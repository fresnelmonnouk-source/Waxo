import "server-only";
import { after } from "next/server";

/**
 * Exécute une tâche APRÈS la réponse (audit Tariq M7) : `after()` de Next garde la fonction vivante (waitUntil) le temps
 * de finir, sans faire attendre le client ni le prestataire de paiement. Hors d'une requête (tests, script), `after`
 * lève : la tâche est alors simplement attendue, sauf `optional` (tâche opportuniste : ignorée hors requête). Ne jette jamais.
 */
export async function runAfterResponse(task: () => Promise<unknown>, opts: { optional?: boolean } = {}): Promise<void> {
  const safe = async () => {
    try {
      await task();
    } catch {
      /* un e-mail raté ne remet jamais en cause la commande ou le paiement */
    }
  };
  try {
    after(safe);
  } catch {
    if (!opts.optional) await safe();
  }
}
