// Suivi d'erreurs Sentry : parties PURES (DSN, nettoyage des données). L'initialisation vit dans
// sentry.server.config.ts (serveur) et src/instrumentation-client.ts (navigateur). Sans DSN valide : tout est inerte.

export function sentryDsn(env: Record<string, string | undefined> = process.env): string | null {
  const dsn = (env.SENTRY_DSN ?? env.NEXT_PUBLIC_SENTRY_DSN ?? "").trim();
  return /^https:\/\/[^@\s]+@[^/\s]+\/\d+$/.test(dsn) ? dsn : null;
}

/** Même DSN lu côté navigateur (seule NEXT_PUBLIC_SENTRY_DSN y est disponible). */
export function sentryBrowserDsn(value: string | undefined = process.env.NEXT_PUBLIC_SENTRY_DSN): string | null {
  return sentryDsn({ SENTRY_DSN: value });
}

/** Adresse sans paramètres ni fragment : un jeton de suivi de commande (`?k=…`) ne part jamais chez Sentry. */
export function stripQuery(url: unknown): unknown {
  if (typeof url !== "string") return url;
  return url.split(/[?#]/)[0];
}

/** Retire cookies, en-têtes, corps de requête, paramètres d'adresse et identité : aucune donnée client ne part chez Sentry. */
export function scrubEvent<T extends { request?: object; user?: unknown }>(event: T): T {
  const e = event as { request?: unknown; user?: unknown };
  if (e.request && typeof e.request === "object") {
    const { url, method } = e.request as { url?: unknown; method?: unknown };
    e.request = { url: stripQuery(url), method };
  }
  delete e.user;
  return event;
}

/** Fil d'Ariane : les adresses (fetch, navigation) perdent leurs paramètres ; les saisies et le texte des clics sont retirés. */
export function scrubBreadcrumb<T extends { category?: string; message?: string; data?: { [key: string]: unknown } }>(crumb: T): T | null {
  if (crumb.category === "ui.input") return null;
  if (crumb.category === "ui.click") delete crumb.message;
  const data = crumb.data;
  if (data) {
    for (const k of ["url", "from", "to"]) if (k in data) data[k] = stripQuery(data[k]);
  }
  return crumb;
}

/** Options communes serveur + navigateur : erreurs seulement (pas de tracing ni de replay : site léger), aucune donnée personnelle. */
export function baseOptions(dsn: string) {
  return {
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  };
}
