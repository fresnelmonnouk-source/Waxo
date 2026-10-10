import "server-only";
import { tryAdminClient, withTimeout } from "@/lib/settings/db";
import { fedapayConfig, fedapayConfigFrom, type FedapayConfig } from "./config";
import { decryptSecret, encryptSecret } from "./secret-box";

/**
 * Identifiants FedaPay : saisis dans l'espace admin (Réglages → Paiement), chiffrés en base (settings.payments, non public),
 * ou — à défaut — lus dans l'environnement (FEDAPAY_SECRET_KEY / FEDAPAY_WEBHOOK_SECRET / FEDAPAY_ENV).
 * Priorité : espace admin > environnement, secret par secret. Lecture mise en cache 30 s par instance (invalidée à
 * l'enregistrement). Toute panne (base absente, clé de chiffrement changée, ligne illisible) retombe sur l'environnement.
 */

const ROW_KEY = "payments";
const CACHE_MS = 30_000;

export type StoredFedapay = { secretKey: string | null; webhookSecret: string | null; updatedAt: string | null };

let cache: { at: number; value: StoredFedapay } | null = null;
export const invalidateCredentialsCache = () => {
  cache = null;
};

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Secrets enregistrés par l'admin (déchiffrés), ou des null. Ne lève jamais. */
export async function readStoredFedapay(): Promise<StoredFedapay> {
  const empty: StoredFedapay = { secretKey: null, webhookSecret: null, updatedAt: null };
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const sb = tryAdminClient();
  if (!sb) return empty;
  try {
    const { data, error } = await withTimeout(sb.from("settings").select("value").eq("key", ROW_KEY).maybeSingle());
    if (error) return empty;
    const f = rec(rec(data?.value).fedapay);
    const value: StoredFedapay = {
      secretKey: decryptSecret(f.secret),
      webhookSecret: decryptSecret(f.webhook),
      updatedAt: typeof f.updatedAt === "string" ? f.updatedAt : null,
    };
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return empty;
  }
}

/** Configuration FedaPay effective (admin > env), ou null si aucune clé API. */
export async function loadFedapayConfig(): Promise<FedapayConfig | null> {
  const stored = await readStoredFedapay();
  const envCfg = fedapayConfig();
  const secretKey = stored.secretKey ?? envCfg?.secretKey ?? null;
  if (!secretKey) return null;
  const webhookSecret = stored.webhookSecret ?? (process.env.FEDAPAY_WEBHOOK_SECRET?.trim() || null);
  // FEDAPAY_ENV ne force le mode que pour une clé venant de l'environnement ; une clé saisie en admin se déclare elle-même.
  const forcedEnv = stored.secretKey ? undefined : process.env.FEDAPAY_ENV;
  return fedapayConfigFrom({ secretKey, webhookSecret, forcedEnv });
}

/** Secret de signature des webhooks (admin > env), ou null. */
export async function loadWebhookSecret(): Promise<string | null> {
  const stored = await readStoredFedapay();
  return stored.webhookSecret ?? (process.env.FEDAPAY_WEBHOOK_SECRET?.trim() || null);
}

/** Clé de signature des liens de retour de paiement : webhook, à défaut clé API (comme avant, mais admin > env). */
export async function loadStatusTokenSource(): Promise<Record<string, string | undefined>> {
  const stored = await readStoredFedapay();
  return {
    FEDAPAY_WEBHOOK_SECRET: stored.webhookSecret ?? process.env.FEDAPAY_WEBHOOK_SECRET,
    FEDAPAY_SECRET_KEY: stored.secretKey ?? process.env.FEDAPAY_SECRET_KEY,
  };
}

// ───────────────────────── Écriture / état (espace admin) ─────────────────────────
export type SecretSource = "admin" | "env" | "none";
export type FedapayStatus = {
  secretSource: SecretSource;
  secretMasked: string | null;
  webhookSource: SecretSource;
  webhookMasked: string | null;
  mode: "sandbox" | "live" | null;
  updatedAt: string | null;
};

/** « sk_sandbox_abcdwxyz » → « sk_sandbox_••••wxyz » : jamais plus que le préfixe de type et les 4 derniers caractères. */
export function maskSecret(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = /^((?:sk|wh|pk)_(?:sandbox|live)_)/.exec(s);
  const prefix = m ? m[1] : "";
  return `${prefix}••••${s.slice(-4)}`;
}

export async function fedapayStatus(): Promise<FedapayStatus> {
  const stored = await readStoredFedapay();
  const envKey = fedapayConfig()?.secretKey ?? null;
  const envHook = process.env.FEDAPAY_WEBHOOK_SECRET?.trim() || null;
  const key = stored.secretKey ?? envKey;
  const hook = stored.webhookSecret ?? envHook;
  const cfg = key ? fedapayConfigFrom({ secretKey: key, webhookSecret: hook, forcedEnv: stored.secretKey ? undefined : process.env.FEDAPAY_ENV }) : null;
  return {
    secretSource: stored.secretKey ? "admin" : envKey ? "env" : "none",
    secretMasked: maskSecret(key),
    webhookSource: stored.webhookSecret ? "admin" : envHook ? "env" : "none",
    webhookMasked: maskSecret(hook),
    mode: cfg?.env ?? null,
    updatedAt: stored.updatedAt,
  };
}

export type SaveFedapayResult = { ok: true } | { ok: false; code: "unavailable" | "no_encryption" | "error" };

/** Enregistre (chiffrés) les secrets fournis ; `undefined` = laisser inchangé, `null` = effacer. */
export async function saveFedapaySecrets(input: { secretKey?: string | null; webhookSecret?: string | null }): Promise<SaveFedapayResult> {
  const sb = tryAdminClient();
  if (!sb) return { ok: false, code: "unavailable" };
  try {
    const { data, error: readError } = await withTimeout(sb.from("settings").select("value").eq("key", ROW_KEY).maybeSingle());
    if (readError) return { ok: false, code: "error" };
    const old = rec(rec(data?.value).fedapay);
    const next: Record<string, unknown> = { ...old };
    for (const [field, col] of [
      ["secretKey", "secret"],
      ["webhookSecret", "webhook"],
    ] as const) {
      const v = input[field];
      if (v === undefined) continue;
      if (v === null) {
        delete next[col];
        continue;
      }
      const blob = encryptSecret(v);
      if (!blob) return { ok: false, code: "no_encryption" };
      next[col] = blob;
    }
    next.updatedAt = new Date().toISOString();
    // is_public = false : jamais servi à la boutique (les politiques RLS publiques ne lisent que is_public).
    const { error } = await withTimeout(sb.from("settings").upsert({ key: ROW_KEY, value: { fedapay: next }, is_public: false }, { onConflict: "key" }));
    if (error) return { ok: false, code: "error" };
    invalidateCredentialsCache();
    return { ok: true };
  } catch {
    return { ok: false, code: "error" };
  }
}
