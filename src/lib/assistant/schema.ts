import { z } from "zod";

export const MAX_TURNS = 10;
export const MAX_MESSAGE_CHARS = 500;

/** Corps de POST /api/assistant : historique borné (≤ 10 tours, ≤ 500 caractères par message), langue de la page. */
export const requestSchema = z.object({
  lang: z.enum(["fr", "en"]),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().min(1).max(MAX_MESSAGE_CHARS),
      }),
    )
    .min(1)
    .max(MAX_TURNS),
  page: z.object({ product: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/) }).optional(),
});

export type AssistantRequest = z.infer<typeof requestSchema>;

// Caractères de contrôle retirés des messages avant tout traitement.
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/** Nettoie les textes, retire les tours vides et garantit que l'historique commence et finit par le visiteur. */
export function normalizeMessages(messages: AssistantRequest["messages"]): { role: "user" | "assistant"; text: string }[] {
  const cleaned = messages
    .map((m) => ({ role: m.role, text: m.text.replace(CONTROL, " ").replace(/\s+/g, " ").trim() }))
    .filter((m) => m.text);
  while (cleaned.length && cleaned[0].role !== "user") cleaned.shift();
  while (cleaned.length && cleaned[cleaned.length - 1].role !== "user") cleaned.pop();
  return cleaned;
}
