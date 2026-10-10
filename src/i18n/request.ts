import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

// Un fichier de messages par domaine (src/messages/<locale>/<ns>.json) : les chantiers parallèles
// ne se marchent pas dessus. Chaque fichier est un objet { "<Namespace>": { ... } } fusionné ici.
export const NAMESPACES = ["common", "shop", "product", "checkout", "account", "assistant", "consent", "packs", "legal"] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const parts = await Promise.all(
    NAMESPACES.map(async (ns) => {
      try {
        return (await import(`../messages/${locale}/${ns}.json`)).default as Record<string, unknown>;
      } catch {
        return {};
      }
    }),
  );
  return { locale, timeZone: "Africa/Porto-Novo", messages: Object.assign({}, ...parts) };
});
