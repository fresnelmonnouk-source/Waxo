// Bandeau de cookies peint dès le HTML statique (LCP mobile) : script inline exécuté AVANT que le navigateur
// n'analyse le bandeau. S'il trouve un choix encore valable (localStorage puis cookie, mêmes règles que
// `parseConsent`), il ajoute dans <head> une règle qui masque la version « en attente » du bandeau.
// Module PUR (aucun accès navigateur à l'import), utilisable côté serveur ; testé dans tests/tracking-consent-preset.test.ts.
import { CONSENT_COOKIE, CONSENT_MAX_AGE_S, CONSENT_STORAGE_KEY } from "./consent";

/** id du bandeau (cible de la règle CSS) ; l'attribut `data-pending` n'existe que jusqu'à la lecture du navigateur. */
export const CONSENT_BANNER_ID = "waxo-consent";
export const CONSENT_PRESET_STYLE_ID = "waxo-consent-preset";
/** Règle posée quand un choix existe : seule la version serveur (« en attente ») est masquée, jamais le bandeau rouvert. */
export const CONSENT_PRESET_CSS = `#${CONSENT_BANNER_ID}[data-pending]{display:none}`;

/**
 * Corps du script inline. La règle va dans <head> (React 19 ignore les balises inattendues du <head> à l'hydratation) :
 * aucun attribut ajouté sur un élément rendu par React, donc aucun écart d'hydratation.
 */
export function consentPresetScript(): string {
  const key = JSON.stringify(CONSENT_STORAGE_KEY);
  const maxMs = CONSENT_MAX_AGE_S * 1000;
  const css = JSON.stringify(CONSENT_PRESET_CSS);
  const styleId = JSON.stringify(CONSENT_PRESET_STYLE_ID);
  return (
    `(function(){try{var n=Date.now(),s=0,` +
    `ok=function(a,m,t){return typeof a==="boolean"&&typeof m==="boolean"&&typeof t==="number"&&isFinite(t)&&t<=n+6e4&&n-t<=${maxMs}};` +
    `try{var o=JSON.parse(localStorage.getItem(${key})||"null");if(o&&o.v===1&&ok(o.analytics,o.marketing,o.ts))s=1}catch(e){}` +
    `if(!s){var c=/(?:^|;\\s*)${CONSENT_COOKIE}=1\\.a[01]\\.m[01]\\.(\\d{10,14})(?:;|$)/.exec(document.cookie);if(c&&ok(true,true,+c[1]))s=1}` +
    `if(s&&!document.getElementById(${styleId})){var st=document.createElement("style");st.id=${styleId};st.textContent=${css};document.head.appendChild(st)}` +
    `}catch(e){}})()`
  );
}
