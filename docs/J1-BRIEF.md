# J1 — Boutique et commande : brief des 3 agents

Projet **Waxo (marque « Wá xɔ »)** : e-commerce web bilingue FR/EN, Bénin. Repo : `C:\Users\LUFFY MKD\waxo`
(Next.js 16.4 App Router, Tailwind v4, TypeScript strict, next-intl 4.14.7, Supabase, zod v4, vitest).
Fiche projet : `C:\Users\LUFFY MKD\.claude\skills\kody\PROJETS\Waxo\Waxo.md` (lecture seule).

## Règle n°1 — fidélité PIXEL-PERFECT à la maquette
La source de vérité visuelle est `docs/maquettes/Waxo Boutique.dc.html` (+ `Charte graphique Waxo.dc.html`, `waxo-data.js`).
C'est un prototype au format « DC » : balises `<sc-if value="{{ x }}">`, `{{ expr }}`, `onClick="{{ fn }}"`, styles INLINE.
Tu **portes** chaque écran fidèlement en composants React + Tailwind (utilise les tokens de `src/app/globals.css` :
`bg-cream`, `text-ink`, `text-terracotta`, `bg-sun`, `font-display`, `rounded-card`… ou `style={{}}` avec les mêmes valeurs quand
c'est plus fidèle). Copie à l'identique : espacements, rayons, tailles de police (Unbounded pour titres/prix/logo avec
`letter-spacing` négatif comme dans le fichier ; Onest pour le reste), couleurs, ombres, bordures, états hover/focus, animations
(`wxup`, `wxpulse`, déjà dans globals.css), comportements responsive (la maquette utilise des booléens `wide`/`narrow` calculés en JS :
retrouve les seuils dans le script `<script type="text/x-dc">` ligne ~1294+ et traduis-les en media queries / classes responsives).
Lis la section de la maquette PAR TRANCHES de ~120 lignes (`Read` avec offset/limit), pas le fichier entier d'un coup.
Textes : reprends les textes FR exacts de la maquette (mettre dans les fichiers de messages), traduis l'EN toi-même (naturel, pas mot à mot).
Espaces insécables avant `? ! : ;` en français et avant `F` dans les prix (déjà géré par `fmtXof`).

## Règle n°2 — propriété exclusive des fichiers (3 agents en PARALLÈLE dans le MÊME dossier)
Tu ne crées/modifies QUE les fichiers de ta liste. Tu n'ÉDITES JAMAIS un fichier d'un autre agent ni du socle (sauf les points
« autorisés » ci-dessous). Si tu as besoin d'un changement ailleurs, note-le dans ton rapport final, ne le fais pas.
Socle déjà là (lecture/usage OK, modification interdite) : `src/lib/catalog/*` (getCategories, getProducts, getProductBySlug,
getRelatedProducts, getReviews, getSettings ; repli démo sans Supabase), `src/lib/cart/store.ts` (`cart`, `useCartLines`,
`useCartCount`, `useCartSubtotal`), `src/lib/favorites/store.ts`, `src/lib/ui/cart-drawer.ts` (`cartDrawer.open()`),
`src/lib/money.ts` (`fmtXof`, `discountPercent`), `src/lib/supabase/{public,server,admin,env,proxy}.ts`, `src/i18n/*`, `src/proxy.ts`,
`src/app/globals.css`, `src/lib/fonts.ts`, `src/app/[lang]/layout.tsx`.
Messages : un fichier par domaine et par langue, `src/messages/{fr,en}/<ns>.json` (déjà créés ; format `{ "Namespace": {...} }`).
Chaque agent n'écrit QUE dans ses propres fichiers de messages (voir sa section). Les deux langues doivent avoir EXACTEMENT les mêmes clés.

## Règle n°3 — interdits
- PAS de `next build`, PAS de `next dev`, PAS de `next start` (le dossier `.next` est partagé : collision). Vérifie avec
  `npx tsc --noEmit`, `npx eslint <tes fichiers>`, `npx vitest run`. Le chef (KODY) fait le build et la revue visuelle.
- PAS de `git add/commit/push`. PAS d'installation de dépendance (`npm i`) : si tu crois en avoir besoin, dis-le dans ton rapport.
- PAS de clés/secrets dans le code, PAS de `.env*`. Aucune écriture vers une base réelle : Supabase n'est pas branché
  pendant J1 (les clés arrivent à la fin) ; tout le code doit fonctionner en repli sans Supabase ou échouer proprement (message
  d'erreur localisé, jamais de stack trace, jamais de 500 brute).
- `any` implicite interdit ; `any` voulu = commentaire qui explique. Pas de `console.log` oublié.
- Accessibilité : 44 px min pour les cibles tactiles, focus visible, `aria-label` sur les boutons-icônes, formulaires avec `label`,
  `prefers-reduced-motion` respecté (déjà global). Le contraste suit la charte (terre cuite #E2552B jamais en fond de texte blanc).
- Sécurité : toute entrée serveur validée par Zod ; routes API : honeypot + délai minimal 2,5 s sur les formulaires publics
  (champ caché `website` + horodatage `t`), longueurs bornées, jamais d'erreur interne renvoyée au client. Les montants viennent
  TOUJOURS du serveur/base, jamais du client. Aucune clé service_role côté client.
- Pages publiques statiques : n'appelle JAMAIS `cookies()`/`headers()` dans une page ou un layout public ; dans chaque page serveur
  utilise le motif `export default function Page({ params }: PageProps<"/[lang]/...">) { const { lang } = use(params); setRequestLocale(lang); ... }`
  (voir `src/app/[lang]/(shop)/page.tsx`) avec `useTranslations`, et `generateStaticParams` pour les routes dynamiques.
  Liens internes : `Link` de `@/i18n/navigation` (jamais `next/link`), sauf `/admin` et `/api`.
- Tests : pour toute logique pure (validation, calculs), ajoute des tests vitest dans `tests/` (nom de fichier préfixé par ton domaine).

## Rapport final attendu (court, factuel)
Liste des fichiers créés/modifiés, ce qui est fidèle, les écarts assumés avec la maquette (et pourquoi), ce qui manque,
résultat de `tsc` / `eslint` / `vitest`, et les demandes éventuelles pour les autres agents ou le chef.

---

## AGENT A — « boutique » : coque, accueil, catalogue, newsletter

Maquette : bandeau noir lignes 9-34 ; en-tête 35-145 (recherche avec suggestions, menu profil, nav mobile, compteurs) ;
accueil 146-318 (héro, catalogue par rayons, « Sélection pour vous », « Plus vendus », « Comment ça marche ») ;
page catalogue 319-382 (filtres rayons, tri, recherche) ; newsletter 883-912 ; pied de page 913-989. (Le widget « Assistant IA »
ligne 1253+ est pour le jalon J3 : ne le fais pas.)

Fichiers qui t'appartiennent :
- `src/app/[lang]/(shop)/layout.tsx` (coque : bandeau, en-tête, `{children}`, newsletter, pied de page ; MONTE `<CartDrawer />`
  de `@/components/shop/CartDrawer` — un stub existe, un autre agent le remplace ; ne le modifie pas)
- `src/app/[lang]/(shop)/page.tsx` (accueil) et `src/app/[lang]/(shop)/catalogue/page.tsx` (+ tout sous-dossier `catalogue/`)
- `src/components/shop/*` SAUF `CartDrawer.tsx` (appartient à l'agent B) : en-tête, bandeau, pied de page, newsletter, recherche,
  navigation mobile, `ProductCard.tsx` (tu la portes pixel-perfect en CONSERVANT sa signature `{ product: Product }` : les autres
  agents l'importent), grilles, filtres, etc.
- `src/app/api/newsletter/route.ts` (POST : e-mail ou WhatsApp, Zod, honeypot+délai, insère dans `newsletter_subs` via
  `createAdminClient()` ; si Supabase absent → réponse JSON propre « indisponible » ; doublon = succès silencieux)
- `src/messages/fr/shop.json`, `src/messages/en/shop.json` (namespace(s) `Shell`, `Home`, `Catalog`, `Card`, `Newsletter`, `Footer`… ; garde
  les clés `Card.*` existantes)
- Tests : `tests/shop-*.test.ts`
Points d'intégration autorisés : dans l'en-tête, tu importes `AccountMenu` de `@/components/account/AccountMenu` (stub existant,
remplacé par l'agent C) ; compteur panier via `useCartCount`, compteur favoris via `useFavoritesCount`, clic panier =
`cartDrawer.open()`. Les liens vers `/produit/[slug]`, `/commande`, `/compte`, `/favoris`, `/contact`, `/a-propos`, `/faq`,
`/livraison-retours`, `/cgv`, `/cgu`, `/confidentialite`, `/mentions-legales`, `/suivi` pointent vers des pages d'autres agents
(elles existeront) : n'invente pas d'autres routes.
Le catalogue lit `getProducts(lang, { category, q, sort })` côté serveur ; filtres/tri pilotés par `searchParams` (comme la maquette :
rayon, tri, recherche) — gère la page comme dynamique légère SI nécessaire mais préfère un filtrage client sur la liste complète
(24 produits) pour garder la page statique. Les pastels des rayons viennent de `categories.bg`.

## AGENT B — « fiche, panier, commande »

Maquette : fiche produit 383-515 (galerie/visuel, prix, remise, stock, quantité, avis + formulaire d'avis, « Vous aimerez aussi »,
barre d'achat collante mobile — voir `stickyBuy` ~ligne 1759) ; tiroir panier 990-1050 ; commande 1051-1165 (étapes : coordonnées/livraison/
paiement/confirmation — lis le script ~1294+ pour la logique : zones, frais, franco, moyens de paiement, validation du téléphone `^01\d{8}$`
après normalisation `normPhone`, e-mail, étape de succès).

Fichiers qui t'appartiennent :
- `src/app/[lang]/(shop)/produit/[slug]/page.tsx` (+ sous-dossiers ; `generateStaticParams` sur les slugs du catalogue ; slug inconnu → `notFound()`)
- `src/app/[lang]/(shop)/commande/**` (page de commande + page de confirmation `commande/merci` ou équivalent)
- `src/components/shop/CartDrawer.tsx` (remplace le stub ; ouvert/fermé via `useCartDrawerOpen`/`cartDrawer`), + tes composants dans
  `src/components/product/*` et `src/components/checkout/*`
- `src/app/api/checkout/route.ts` : POST, Zod (items `[{kind,id,qty}]`, client `{name,phone,email?,address,note?}`, zone, pay),
  rate-limit mémoire léger par IP, honeypot+délai. Appelle la fonction SQL `place_order` via `createAdminClient().rpc("place_order", …)`
  (voir `supabase/migrations/0001_core.sql` pour la signature exacte et les codes d'erreur `out_of_stock`, `product_unavailable`,
  `payment_method_disabled`… à traduire en réponses 4xx propres localisées). Si Supabase est absent → 503 JSON propre.
  Pour carte/MoMo/Moov/Celtiis : crée l'abstraction `src/lib/payment/index.ts` (interface `PaymentProvider` : `createCheckout(order)` →
  `{ redirectUrl } | { pending: true }`) avec un provider MOCK pour l'instant (le vrai FedaPay arrive au jalon J3 : ne l'implémente pas).
  Paiement à la livraison = commande confirmée directement.
- `src/app/api/reviews/route.ts` : POST d'un avis (note 1-5, texte ≤ 1500, auteur), Zod + honeypot/délai, insertion `reviews`
  (`verified=false`, `seed=false`, `hidden=false` ; la modération est dans l'admin), repli propre sans Supabase.
- `src/lib/checkout/*` (calculs purs : frais de livraison, franco, validation téléphone/e-mail, normalisation — avec tests vitest
  `tests/checkout-*.test.ts` : couvre franco exact, zones, téléphones valides/invalides)
- `src/messages/fr/product.json`, `src/messages/en/product.json`, `src/messages/fr/checkout.json`, `src/messages/en/checkout.json`
Le CLIENT envoie ses lignes ; le total affiché est une estimation : le total officiel est celui renvoyé par `place_order`.
Utilise `ProductCard` de `@/components/shop/ProductCard` pour « Vous aimerez aussi » (signature `{ product }`, ne la modifie pas :
l'agent A la finalise). Après commande réussie : vide le panier (`cart.clear()`), affiche le numéro `WX-…`.
Le suivi invité (`/suivi`) est fait par l'agent C : sur la page de confirmation, propose le lien vers `/suivi`.

## AGENT C — « compte, auth, suivi, favoris, contact, pages d'infos »

Maquette : « Mon compte » 751-882 (profil, adresse, commandes avec statuts `STATUS` de waxo-data.js, newsletter, déconnexion) ;
connexion/inscription modale 1166-1252 ; contact 548-605 ; à propos 516-547 ; FAQ 606-629 ; pages légales 630-750 (CGV, CGU,
confidentialité, mentions légales, livraison-retours ; textes avec marqueurs « à compléter » visibles où l'entité légale manque —
NE PAS inventer de raison sociale/IFU/adresse/RCCM). Il n'y a pas de maquette pour `/suivi` ni `/favoris` : conçois-les dans le même
langage visuel (tokens, cartes `rounded-card`, boutons pilule 44 px).

Fichiers qui t'appartiennent :
- `src/app/[lang]/(shop)/{compte,connexion,inscription,suivi,favoris,contact,a-propos,faq,livraison-retours,cgv,cgu,confidentialite,mentions-legales}/**`
  (pages d'infos : un composant partagé pour les pages légales ; contenu dans les messages pour l'instant — il passera en base `pages` plus tard)
- `src/components/account/*` (remplace le stub `AccountMenu` : bouton + menu profil « Mon profil » ligne 76 de la maquette ; l'état de
  session vient d'un `GET /api/me` appelé côté client pour que les pages restent statiques ; les modales/formulaires de connexion)
- `src/lib/auth/*` (remplace le stub `user.ts` avec la vraie lecture de session ; helpers de validation Zod ; messages d'erreur génériques
  anti-énumération : même message pour « e-mail inconnu » et « mot de passe faux »)
- `src/app/api/{me,contact,auth,orders/track}/**` :
  - `GET /api/me` → `{ user: {...} | null }`, jamais d'erreur 5xx visible (Supabase absent → `{ user: null }`)
  - `POST /api/contact` → insère dans `messages` via service_role, honeypot+délai, rate-limit mémoire léger
  - authentification : utilise `@supabase/ssr` côté serveur (server actions ou routes `/api/auth/*`) : inscription (prénom, nom, téléphone,
    e-mail, mot de passe ≥ 8), connexion, déconnexion, mise à jour du profil (colonnes autorisées seulement : first_name, last_name,
    phone, address, news — la colonne `role` est protégée en base, ne tente JAMAIS de l'écrire), liste de MES commandes (RLS `orders_read`)
  - `POST /api/orders/track` → suivi invité : numéro `WX-…` + téléphone OU e-mail correspondant ; réponse identique (« introuvable ») si
    l'un des deux ne correspond pas (anti-énumération) ; ne renvoie que statut, lignes, total, date ; service_role côté serveur
- Favoris : la page `/favoris` lit `useFavoriteIds()` + `getProductsByIds` côté serveur via une petite route `GET /api/products?ids=` (à toi
  de la créer dans `src/app/api/products/route.ts`) ; tu NE modifies PAS `src/lib/favorites/store.ts` (usage seul). Synchronisation avec la
  table `favorites` pour les comptes connectés : optionnelle, ajoute-la seulement si c'est propre et sans toucher au store.
- `src/messages/fr/account.json`, `src/messages/en/account.json` (namespaces `Account`, `Auth`, `Track`, `Favorites`, `Contact`, `Info`, `Legal`, `Faq`, `About`…)
- Tests : `tests/account-*.test.ts` (validation Zod, normalisation téléphone, anti-énumération du suivi)
Supabase absent (J1) : toutes les routes répondent proprement (503/`null`), l'UI affiche un message localisé « service indisponible »
sans casser la page.
