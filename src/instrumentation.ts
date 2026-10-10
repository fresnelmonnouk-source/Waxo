import type { Instrumentation } from "next";

// Hook Next.js (une fois au démarrage du serveur). Sentry est chargé de façon protégée : sans DSN ou sans paquet, rien ne se passe.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { reportRequestError } = await import("@/lib/tracking/sentry");
  await reportRequestError(err, request, context);
};
