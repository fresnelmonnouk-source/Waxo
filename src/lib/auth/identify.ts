import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { withTimeout } from "./timeout";
import { isValidEmail, isValidPhone, normPhone } from "./validation";

/**
 * « E-mail ou téléphone » → e-mail du compte (ou null). Une correspondance par téléphone n'est retenue que si elle est
 * UNIQUE. Les appelants répondent de la même façon que le compte existe ou non (anti-énumération).
 */
export async function resolveEmail(identifier: string): Promise<string | null> {
  if (isValidEmail(identifier)) return identifier.trim().toLowerCase();
  if (!isValidPhone(identifier)) return null;
  try {
    const admin = createAdminClient();
    const { data } = await withTimeout(admin.from("profiles").select("id").eq("phone", normPhone(identifier)).limit(2));
    if (!data || data.length !== 1) return null;
    const { data: found } = await withTimeout(admin.auth.admin.getUserById(data[0].id as string));
    return found.user?.email?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}
