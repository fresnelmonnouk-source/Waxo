// Initialisation Sentry côté serveur Node (appelée par src/instrumentation.ts). Inerte sans SENTRY_DSN ou sans @sentry/nextjs.
import { loadSentry } from "./src/lib/tracking/sentry";

await loadSentry();
