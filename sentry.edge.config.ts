// Runtime Edge : le chargement dynamique par nom de paquet n'y est pas disponible. Aucune initialisation tant que
// @sentry/nextjs n'est pas installé et configuré par l'assistant officiel (`npx @sentry/wizard@latest -i nextjs`).
// Le proxy (src/proxy.ts) s'exécute en Node : les erreurs applicatives sont déjà couvertes par sentry.server.config.ts.
export {};
