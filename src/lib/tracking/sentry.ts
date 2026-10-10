// Chargement PROTÉGÉ de @sentry/nextjs (serveur). Le paquet n'est pas une dépendance du projet tant qu'il n'est pas installé :
// le nom est passé par une variable + commentaires d'ignorance, donc ni webpack ni Turbopack ne tentent de le résoudre au build.
// Sans DSN ou sans paquet, tout est inerte (aucune erreur, aucun appel réseau).
//
// Pour activer : `npm i @sentry/nextjs`, définir SENTRY_DSN (serveur) — puis, pour la remontée côté navigateur et le
// tracing de build, lancer l'assistant officiel (`npx @sentry/wizard@latest -i nextjs`) qui remplace ce chargement dynamique
// par `withSentryConfig` + imports statiques (indispensable pour que le paquet soit inclus dans le déploiement Vercel).

export type SentryLike = {
  init: (options: Record<string, unknown>) => void;
  captureRequestError?: (...args: unknown[]) => void;
};

let loaded: SentryLike | null | undefined;

export function sentryDsn(env: Record<string, string | undefined> = process.env): string | null {
  const dsn = (env.SENTRY_DSN ?? env.NEXT_PUBLIC_SENTRY_DSN ?? "").trim();
  return /^https:\/\/[^@\s]+@[^/\s]+\/\d+$/.test(dsn) ? dsn : null;
}

/** Retire cookies, en-têtes et corps de requête avant envoi : aucune donnée client ne part chez Sentry. */
export function scrubEvent<T extends { request?: Record<string, unknown>; user?: unknown }>(event: T): T {
  if (event.request) {
    const { url, method } = event.request as { url?: unknown; method?: unknown };
    event.request = { url, method };
  }
  delete event.user;
  return event;
}

export async function loadSentry(): Promise<SentryLike | null> {
  if (loaded !== undefined) return loaded;
  loaded = null;
  const dsn = sentryDsn();
  if (!dsn) return null;
  try {
    const name = "@sentry/nextjs";
    const mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ name)) as SentryLike;
    if (typeof mod.init !== "function") return null;
    mod.init({
      dsn,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      sendDefaultPii: false,
      tracesSampleRate: 0.1,
      beforeSend: scrubEvent,
    });
    loaded = mod;
  } catch {
    /* paquet non installé : on continue sans Sentry */
  }
  return loaded;
}

/** Remonte une erreur serveur à Sentry si disponible ; ne lève jamais. */
export async function reportRequestError(...args: unknown[]): Promise<void> {
  try {
    const s = await loadSentry();
    s?.captureRequestError?.(...args);
  } catch {
    /* le suivi d'erreurs ne doit jamais provoquer d'erreur */
  }
}
