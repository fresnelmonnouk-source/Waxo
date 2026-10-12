# Brief commun : chantier SEO + corrections d'audit (2026-10-12)

Branche : `audit-seo-2026-10-12` (sauvegarde : tag `backup/pre-audit-seo-2026-10-12`). Rien n'est poussé sur `main` sans Fresnel.
Plan et décisions : `docs/reviews/SYNTHESE-audit-seo-2026-10-12.md`. Rapports : `docs/reviews/*-2026-10-12.md`.

## Décisions de Fresnel (validées)
- Les titres Google utilisent **« Waxo »**, et le logo et le texte gardent « Wá xɔ ». Gabarit : `{titre de page} | Waxo`. Le titre de l'accueil est absolu (`SeoPages.home.title`).
- Horaires réels : **7 j/7, 8 h à 20 h** (service client WhatsApp et livraisons). L'assistant IA répond 24 h/24. Livraison Express : le jour même pour toute commande passée avant 20 h, sinon le lendemain.
- Changement de langue sur une fiche dont le slug diffère : 308 vers le bon slug.
- Fiche sans texte EN : pas d'alternate EN, canonique FR.
- Base Supabase en panne : erreur (l'ISR garde la page en cache), jamais de fausses coordonnées ni de rayons de démo.
- CAPTCHA : Cloudflare Turnstile, **inerte sans clés** (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`).

## Règles pour tous
- Tu ne modifies **que les fichiers dont tu es propriétaire** (tableau ci-dessous). Si un correctif exige un fichier d'une autre équipe, **ne le modifie pas** : note dans ton rapport l'édition exacte à faire, Kody l'appliquera.
- Textes : chaque équipe ajoute ses **nouvelles** clés dans SON fichier de messages, sous un **nouveau** namespace racine. Les fichiers sont fusionnés à plat par `Object.assign` : réutiliser `"Shop"`, `"Common"`… écraserait le namespace existant. Il faut écrire les deux langues, FR et EN.
  - Équipe SEO : `src/messages/{fr,en}/states.json` (ex. `{"NotFound": {...}, "EmptyStates": {...}}`).
  - Équipe Sécurité : `src/messages/{fr,en}/security.json`.
  - Équipe A11y : `src/messages/{fr,en}/a11y.json`.
  - Marcus : valeurs de `seo.json` (`SeoPages`), et modification des **valeurs** existantes (jamais les clés) dans `common.json`, `shop.json`, `legal.json` et `checkout.json`, pour les horaires et le H1.
- Ne lance **jamais** `next build` ni `next dev`, car `.next` est partagé. Ces commandes sont autorisées : `npx tsc --noEmit`, `npx eslint <tes fichiers>`, `npx vitest run <tes tests>`.
- Aucun commit, aucun push, aucune écriture en base. Nouvelle migration : seulement le numéro attribué ci-dessous, et Fresnel l'appliquera.
- Chaque correctif a un test (vitest) quand c'est testable. Écris dans le style du code voisin (commentaires FR, même densité).
- Le texte visible ne contient pas de tiret cadratin « — », et respecte les espaces insécables avant `: ; ? !` comme dans le reste du site.

## Propriété des fichiers
| Équipe | Fichiers (exclusifs) |
|---|---|
| **SEO** | `src/lib/seo/**`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/manifest.ts`, `src/app/[lang]/layout.tsx`, `src/app/[lang]/not-found.tsx` + `error.tsx` + `global-not-found`/`global-error` (nouveaux), **toutes** les `page.tsx` publiques de `src/app/[lang]/(shop)/**` SAUF `commande/**`, `src/lib/catalog/**`, `src/lib/settings/**` (getSettings et repli), `src/components/account/FaqList.tsx`, `src/components/shop/{HomeSections,Selection,CatalogView,CatalogStatic,ProductCard,data,logic}.tsx/.ts` (états vides, accueil, catalogue), migration **0019** (`products.updated_at`), `messages/*/states.json` |
| **Perf** | `src/components/tracking/**` (ConsentBanner, TrackingProvider, consent-client, Pixel), `src/lib/fonts.ts`, `vercel.json`, `src/components/shop/{Newsletter.tsx,newsletter-schema.ts,HeaderSearch.tsx}` (pour sortir zod du bundle client) ; `src/components/assistant/**` SAUF `entries.tsx` |
| **Sécurité** | `src/lib/payment/**`, `src/app/api/**` (sauf `api/site-reviews` en lecture), `src/app/[lang]/(shop)/commande/**`, `src/components/checkout/**` (dont CheckoutFlow), formulaires connexion/inscription/mot de passe (côté API + widget CAPTCHA), `src/lib/ratelimit.ts`, `src/lib/auth/**`, `next.config.ts` (CSP + `remotePatterns`), `src/app/admin/(panel)/reglages/**`, `src/lib/email/**`, migration **0020** si nécessaire, `messages/*/security.json` |
| **A11y** | `src/app/globals.css`, `src/app/[lang]/(shop)/layout.tsx`, `src/components/ui*` (case CGU), `Footer.tsx`, `LangSwitch.tsx`, `HomeHero.tsx`, `src/components/assistant/entries.tsx`, `src/components/shop/{MegaMenu,MobileNav,Header,TopBar,CartDrawer}.tsx`, `src/components/admin/**` + `src/app/admin/(panel)/**` (sauf `reglages/**`), `src/lib/favorites/**` + page favoris (`src/app/[lang]/(shop)/favoris/**`, exception à la règle des pages SEO : noindex), `src/components/product/**` (note « 0,0 », bouton Ajouter au panier), `messages/*/a11y.json` |
| **Marcus** | `src/messages/{fr,en}/seo.json` + valeurs existantes (voir plus haut) ; `docs/copy/seo-2026-10-12.md` |

## Contrat JSON-LD Product ↔ suivi
L'équipe SEO pose sur la fiche un JSON-LD `Product` avec `productID` = **UUID** du produit, `sku` = UUID, `name`, `image`,
`offers: { "@type": "Offer", price: <entier FCFA>, priceCurrency: "XOF", availability, url }`. L'équipe Perf fait lire à
`TrackingProvider` **ces** champs (`productID`, `offers.price`) pour `view_item`, afin qu'il envoie le même identifiant que `add_to_cart` et `purchase`.

## Contrat des titres
`src/messages/*/seo.json` → namespace `SeoPages` (clés déjà posées, Marcus remplit les valeurs). L'équipe SEO branche chaque
`generateMetadata` dessus via `pageMetadata` (Open Graph + `og:url` compris) et le gabarit `%s | {SeoPages.brand}`.
