import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Chiffrement des secrets enregistrés depuis l'espace admin (clé FedaPay…) : AES-256-GCM, format `v1.<iv>.<tag>.<texte>` (base64url).
 * La clé de chiffrement n'est JAMAIS en base : variable SETTINGS_ENCRYPTION_KEY (recommandée, ≥ 16 caractères), à défaut dérivée
 * (HKDF) de SUPABASE_SERVICE_ROLE_KEY. Si cette clé change, les secrets enregistrés deviennent illisibles : `decryptSecret` renvoie
 * null (l'admin doit les ressaisir) — jamais d'exception ni de texte déchiffré à moitié.
 */

const INFO = "waxo-settings-secret-v1";

function masterKey(): Buffer | null {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!raw || raw.length < 16) return null;
  return Buffer.from(hkdfSync("sha256", raw, "waxo", INFO, 32));
}

/** Le serveur est-il capable de chiffrer ? (sinon l'admin ne peut pas enregistrer de secret.) */
export const canEncrypt = (): boolean => masterKey() !== null;

const b64 = (b: Buffer) => b.toString("base64url");

export function encryptSecret(plain: string): string | null {
  const key = masterKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1.${b64(iv)}.${b64(cipher.getAuthTag())}.${b64(ct)}`;
}

export function decryptSecret(blob: unknown): string | null {
  const key = masterKey();
  if (!key || typeof blob !== "string") return null;
  const parts = blob.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(parts[1], "base64url"));
    decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
