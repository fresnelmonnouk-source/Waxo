import { json } from "@/lib/auth/http";
import { getCurrentUser } from "@/lib/auth/user";

/** Session courante pour l'interface (les pages restent statiques). Jamais d'erreur 5xx : au pire `{ user: null }`. */
export async function GET() {
  try {
    return json({ user: await getCurrentUser() });
  } catch {
    return json({ user: null });
  }
}
