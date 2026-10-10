/** Concatène des classes en ignorant les valeurs fausses. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
