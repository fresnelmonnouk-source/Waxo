import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` jette hors d'un bundle Next : neutralisé en test.
      "server-only": fileURLToPath(new URL("./tests/empty.js", import.meta.url)),
    },
  },
  test: { include: ["tests/**/*.test.ts"] },
});
