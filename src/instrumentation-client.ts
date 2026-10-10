// Initialisation Sentry côté navigateur (Next 16 charge ce fichier au démarrage). Inerte sans NEXT_PUBLIC_SENTRY_DSN valide.
// Erreurs seulement : ni tracing ni replay (poids du bundle), et rien de personnel (voir scrubEvent / scrubBreadcrumb).
import * as Sentry from "@sentry/nextjs";
import { baseOptions, sentryBrowserDsn } from "@/lib/tracking/sentry";

const dsn = sentryBrowserDsn();
if (dsn) Sentry.init(baseOptions(dsn));

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
