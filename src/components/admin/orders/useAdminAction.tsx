"use client";

import { useTransition } from "react";
import { toastFor, useToast, type ActionOutcome } from "./ui";

/**
 * Exécute une server action avec état « en cours » et notification (succès, erreur ou avertissement).
 * Les actions revalident leurs pages : la liste se met à jour toute seule.
 */
export function useAdminAction() {
  const { show, node } = useToast();
  const [pending, start] = useTransition();
  function run(work: () => Promise<ActionOutcome>, success: string, onOk?: () => void) {
    start(async () => {
      try {
        const res = await work();
        toastFor(res, success, show);
        if (res.ok) onOk?.();
      } catch {
        show("Une erreur est survenue. Réessayez.", true);
      }
    });
  }
  return { run, pending, show, toast: node };
}
