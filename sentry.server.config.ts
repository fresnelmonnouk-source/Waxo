// Initialisation Sentry côté serveur Node (appelée par src/instrumentation.ts). Inerte sans SENTRY_DSN valide.
import * as Sentry from "@sentry/nextjs";
import { baseOptions, sentryDsn } from "./src/lib/tracking/sentry";

const dsn = sentryDsn();
if (dsn) Sentry.init(baseOptions(dsn));
