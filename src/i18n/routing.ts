import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  localePrefix: "always", // /fr et /en
});

export type Locale = (typeof routing.locales)[number];
