import type { Instrumentation } from "next";
import * as Sentry from "@sentry/nextjs";

// Hook Next.js (une fois au démarrage du serveur). Sans SENTRY_DSN valide, Sentry reste inerte.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Erreurs des pages, routes API et server actions. Sans client Sentry initialisé, l'appel ne fait rien.
export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  Sentry.captureRequestError(err, request, context);
};
