import en from "@/messages/en/assistant.json";
import fr from "@/messages/fr/assistant.json";
import type { Lang } from "./types";

/**
 * Textes de réponse du serveur (namespace `Assistant.reply`). Lus directement dans les fichiers de messages :
 * mêmes textes que l'interface, sans dépendre du contexte de requête next-intl (route API, tests).
 * Seuls des marqueurs simples `{nom}` sont utilisés dans ces clés.
 */
const REPLY = { fr: fr.Assistant.reply, en: en.Assistant.reply } as const;

export type ReplyKey = keyof typeof fr.Assistant.reply;

export function reply(lang: Lang, key: ReplyKey, vars: Record<string, string | number> = {}): string {
  return REPLY[lang][key].replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
