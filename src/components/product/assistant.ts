/**
 * Pont vers le widget « Assistant IA » (jalon J3). Le widget écoutera `waxo:assistant` et appellera
 * `event.preventDefault()` pour signaler qu'il prend la main. Tant qu'il n'existe pas, l'appelant
 * se replie sur la page de contact (voir `handled`).
 */
export const ASSISTANT_EVENT = "waxo:assistant";

/** Renvoie true si un écouteur a pris en charge la demande. */
export function askAssistant(text: string): boolean {
  const event = new CustomEvent(ASSISTANT_EVENT, { cancelable: true, detail: { text } });
  return !window.dispatchEvent(event);
}
