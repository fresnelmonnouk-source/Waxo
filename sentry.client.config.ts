// Navigateur : NON branché. Le paquet doit être résolu par le bundler (import statique) ; tant que @sentry/nextjs n'est pas
// installé, brancher ce fichier casserait le build. Après `npm i @sentry/nextjs`, remplacer par :
//
//   import * as Sentry from "@sentry/nextjs";
//   Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, sendDefaultPii: false, tracesSampleRate: 0.1 });
//
// et l'importer depuis un `instrumentation-client.ts`. La CSP (connect-src) autorise déjà *.sentry.io.
export {};
