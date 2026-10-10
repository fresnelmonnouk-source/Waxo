// Configuration FedaPay lue dans l'environnement (jamais de clé dans le code). Pur : testable sans réseau.

export type FedapayEnv = "sandbox" | "live";

export type FedapayConfig = { secretKey: string; env: FedapayEnv; apiBase: string };

/** Clé « sk_live_… » → production ; tout le reste (sk_sandbox_…) → sandbox. FEDAPAY_ENV force le choix. */
export function fedapayConfig(source: Record<string, string | undefined> = process.env): FedapayConfig | null {
  const secretKey = source.FEDAPAY_SECRET_KEY?.trim();
  if (!secretKey) return null;
  const forced = source.FEDAPAY_ENV?.trim().toLowerCase();
  const env: FedapayEnv = forced === "live" || forced === "sandbox" ? forced : secretKey.startsWith("sk_live_") ? "live" : "sandbox";
  return { secretKey, env, apiBase: env === "live" ? "https://api.fedapay.com/v1" : "https://sandbox-api.fedapay.com/v1" };
}

/** Origine publique du site (retour de paiement). Variable explicite d'abord, puis domaine de production Vercel. */
export function siteUrl(source: Record<string, string | undefined> = process.env): string | null {
  const explicit = source.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (explicit && /^https?:\/\//i.test(explicit)) return explicit;
  const vercel = source.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//i, "").replace(/\/+$/, "")}`;
  return null;
}
