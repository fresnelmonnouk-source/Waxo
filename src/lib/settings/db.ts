import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Client service_role si la base est configurée, sinon null (→ lectures de démo / écritures « unavailable »). */
export function tryAdminClient(): ReturnType<typeof createAdminClient> | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

const TIMEOUT_MS = 6000;
/** Borne une requête Supabase (jamais de page admin qui pend). */
export function withTimeout<T>(p: PromiseLike<T>): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("supabase_timeout")), TIMEOUT_MS)),
  ]);
}
