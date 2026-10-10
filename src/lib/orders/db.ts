import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminDb = ReturnType<typeof createAdminClient>;

/** Client service_role si Supabase est configuré, sinon null (→ repli démo en lecture, « unavailable » en écriture). */
export function adminDb(): AdminDb | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

const TIMEOUT_MS = 8000;
/** Borne une requête Supabase pour qu'une base lente ne bloque pas toute la page. */
export function withTimeout<T>(p: PromiseLike<T>, ms = TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    Promise.resolve(p),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("db_timeout")), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export const UNAVAILABLE = {
  ok: false as const,
  code: "unavailable",
  message: "Base non connectée (mode démo) : modification impossible.",
};
export const DB_ERROR = {
  ok: false as const,
  code: "db_error",
  message: "Une erreur est survenue côté base de données. Réessayez dans un instant.",
};
