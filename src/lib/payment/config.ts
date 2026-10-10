// Configuration FedaPay lue dans l'environnement (jamais de clé dans le code). Pur : testable sans réseau.

export type FedapayEnv = "sandbox" | "live";

export type FedapayConfig = { secretKey: string; webhookSecret: string | null; env: FedapayEnv; apiBase: string };

export const FEDAPAY_API = { live: "https://api.fedapay.com/v1", sandbox: "https://sandbox-api.fedapay.com/v1" } as const;

/** Construit la configuration à partir de valeurs déjà lues (env OU espace admin). Clé sk_live_… → production ; sinon sandbox. */
export function fedapayConfigFrom(input: { secretKey: string; webhookSecret: string | null; forcedEnv?: string }): FedapayConfig {
  const forced = input.forcedEnv?.trim().toLowerCase();
  const env: FedapayEnv = forced === "live" || forced === "sandbox" ? forced : input.secretKey.startsWith("sk_live_") ? "live" : "sandbox";
  return { secretKey: input.secretKey, webhookSecret: input.webhookSecret, env, apiBase: FEDAPAY_API[env] };
}

/** Clé « sk_live_… » → production ; tout le reste (sk_sandbox_…) → sandbox. FEDAPAY_ENV force le choix. */
export function fedapayConfig(source: Record<string, string | undefined> = process.env): FedapayConfig | null {
  const secretKey = source.FEDAPAY_SECRET_KEY?.trim();
  if (!secretKey) return null;
  return fedapayConfigFrom({ secretKey, webhookSecret: source.FEDAPAY_WEBHOOK_SECRET?.trim() || null, forcedEnv: source.FEDAPAY_ENV });
}

/** Origine publique du site (retour de paiement). Variable explicite d'abord, puis domaine de production Vercel. */
export function siteUrl(source: Record<string, string | undefined> = process.env): string | null {
  const explicit = source.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (explicit && /^https?:\/\//i.test(explicit)) return explicit;
  const vercel = source.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//i, "").replace(/\/+$/, "")}`;
  return null;
}
