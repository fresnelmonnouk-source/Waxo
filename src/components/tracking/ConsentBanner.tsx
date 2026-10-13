// Composant SERVEUR : le bandeau est dans le HTML statique (plus d'attente de l'hydratation pour le peindre).
// Le script inline le précède dans le flux : il s'exécute avant que le navigateur n'analyse le bandeau et le
// masque si un choix valable est déjà enregistré. Aucune lecture de cookies côté serveur : les pages restent statiques.
// CSP : script-src autorise déjà 'unsafe-inline' (src/lib/seo/security-headers.ts), aucun nonce ni hash requis.
import { consentPresetScript } from "@/lib/tracking/consent-preset";
import { ConsentBannerClient } from "./ConsentBannerClient";

export { CookieSettingsLink } from "./ConsentBannerClient";

export function ConsentBanner() {
  return (
    <>
      <script id="waxo-consent-preset-js" dangerouslySetInnerHTML={{ __html: consentPresetScript() }} />
      <ConsentBannerClient />
    </>
  );
}
