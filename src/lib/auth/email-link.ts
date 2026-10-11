import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { RECOVERY_COOKIE, RECOVERY_TTL_SECONDS, signRecovery } from "@/lib/auth/recovery";

/**
 * Fin commune des liens reçus par e-mail (/api/auth/callback et /api/auth/confirm), une fois la session ouverte :
 * réinitialisation → cookie de récupération signé + onglet sécurité ; sinon → espace client.
 */
export async function finishEmailLink(userId: string, recovery: boolean, lang: string, origin: string): Promise<NextResponse> {
  const go = (path: string) => NextResponse.redirect(new URL(path, origin), 303);
  if (recovery) {
    // Marque « session ouverte via un lien de réinitialisation » : l'ancien mot de passe n'est alors pas exigé (il est oublié).
    // Valeur SIGNÉE (id.exp.hmac) : l'id seul serait forgeable (il est lisible via /api/me). Sans secret serveur : pas de cookie.
    const signed = signRecovery(userId);
    if (signed) {
      const store = await cookies();
      store.set(RECOVERY_COOKIE, signed, { httpOnly: true, sameSite: "lax", secure: origin.startsWith("https"), path: "/api", maxAge: RECOVERY_TTL_SECONDS });
    }
    return go(`/${lang}/compte?tab=security&recovery=1`);
  }
  return go(`/${lang}/compte`);
}
