# Audit performance, fiabilité et Core Web Vitals — Tariq — 2026-10-12

Projet Waxo (« Wá xɔ »), https://www.waxo.boutique. Next 16.4 App Router, next-intl 4.14.7, Supabase, Vercel (Hobby d'après la mémoire projet), FedaPay, Resend, DeepSeek, Sentry, Meta Pixel (dès l'arrivée), GA4 (opt-in).
Lecture seule : aucun `next build` ni `next dev`. Base actuelle VIDE (démo purgée) : les chiffres « 200 produits / 2 000 commandes par mois » sont des **projections** et sont signalés comme telles.

## Méthode et mesures (baseline 2026-10-12, 13 h)

- **Poste de mesure** : RTT TCP ≈ 180-190 ms vers Vercel `cdg1` et Cloudflare `MRS` (Marseille), donc représentatif d'un accès depuis le Bénin par les câbles sous-marins.
- `curl` (TTFB, octets compressés br, en-têtes), décodage du flux RSC (`self.__next_f`) de `/fr` et `/fr/catalogue`, téléchargement et attribution des 14 chunks JS, de la CSS et des 13 polices.
- **Lighthouse 12.8.2** mobile en production (Chrome local, `--headless=new`) : profil par défaut (Slow 4G : 150 ms, 1,6 Mbit/s, CPU ×4) sur `/fr` et `/fr/catalogue`, et profil « Bénin » (300 ms, 700 kbit/s, CPU ×6) sur `/fr`. Un seul passage par profil : ce sont des ordres de grandeur, pas des valeurs à 10 ms près.
- Région Supabase : `db.btarkkjimnkmiaxzonzq.supabase.co` → `2a05:d018:48a:…`, compris dans `2a05:d018::/35` = **AWS eu-west-1 (Irlande)** d'après `ip-ranges.amazonaws.com`. Région des fonctions Vercel : **`iad1` (Washington)**, lue dans `X-Vercel-Id: cdg1::iad1::…`.
- JWT Supabase : `/.well-known/jwks.json` publie une clé **ES256** : `getClaims()` du proxy vérifie donc le jeton localement (bon point, voir le suivi de T9).

| Mesure (prod) | Valeur | Commentaire |
|---|---|---|
| HTML `/fr` | 120 Ko bruts / **30,2 Ko br** | catalogue vide |
| dont flux RSC | **89 Ko** (80 Ko décodés) | 74 % du HTML |
| dont messages i18n | **≈ 53 Ko** minifiés (≈ 15 Ko br) | les 9 fichiers, tous les namespaces (Account, Checkout, Legal, Assistant…) |
| JS premier chargement (14 chunks) | **347 Ko br / 1 081 Ko bruts** | J1 : 236 Ko gzip / 772 Ko bruts → **+40 % en octets bruts** (méthodes différentes : build local à J1, prod ici) |
| dont chunk zod | 31 Ko br / 105 Ko bruts | uniquement pour des formulaires |
| Meta Pixel (`fbevents.js` + config) | **156 Ko br / 600 Ko bruts** | chargé à l'hydratation, dès l'arrivée |
| GA4 `gtag.js` (après accord) | 184 Ko br / 555 Ko bruts | opt-in seulement |
| CSS | 13 Ko br / 77 Ko bruts | 1 fichier, bloquant, acceptable |
| Polices préchargées (4) | **231 Ko** dont Unbounded latin-ext **117,6 Ko** | priorité « High », en concurrence avec le JS et l'image LCP |
| TTFB page en cache (HIT), hors réseau | médiane 228 ms (`/fr`) vs 203 ms (`/robots.txt`) | coût du proxy ≈ **25 ms** : négligeable |
| TTFB `/api/checkout/config` (MISS) | **1,2 à 1,5 s** (≈ 0,8 s côté Vercel) | catalogue vide |
| `waxo.boutique/` → `/fr` | 2 redirections, **2,04 s** vs 1,21 s en direct | +0,83 s |
| Lighthouse `/fr` (Slow 4G) | **76** · LCP **4,4 s** · TBT 360 ms · CLS 0 · TTI 6,8 s | |
| Lighthouse `/fr/catalogue` (Slow 4G) | **81** · LCP 3,9 s · TBT 300 ms · CLS 0,024 | |
| Lighthouse `/fr` (profil Bénin) | **52** · LCP **9,1 s** · TBT 660 ms · TTI **14,4 s** | |
| Élément LCP (les 3 passages) | `<p id="waxo-consent-text">` (bandeau cookies) | phase « render delay » 3,1 à 3,5 s |

**Verdict : ⚠️.** Rien ne casse aujourd'hui, mais **les Core Web Vitals mobiles sont déjà « mauvais » avec une boutique vide** (LCP 4,4 s en Slow 4G, 9,1 s au profil Bénin). Ils vont se dégrader avec les vraies photos et 200 produits. Côté fiabilité : 3 points à traiter avant le volume (cron du jour, statistiques tronquées en silence, quotas e-mail).

---

## Suivi de l'audit J1 (`tariq-perf-fiabilite-J1.md`)

| # | Sujet | État au 2026-10-12 | Preuve |
|---|---|---|---|
| T1 | `cancel_order` sur commande payée | ✅ corrigé | `0008` §4 appliqué |
| T2 | Stock bloqué 24 h, COD jamais libérés | ⚠️ **partiel** | SQL corrigé (COD 48 h, `SKIP LOCKED`, lot de 500) mais `vercel.json` reste `0 3 * * *` et aucun `cron.schedule` dans le dépôt. pg_cron activé à la main ? **À confirmer par Fresnel.** Voir E4. |
| T3 | Deadlock et fuite de stock des packs | ✅ corrigé, conservé par 0015 | `0015_campaigns.sql:158-165` (verrou unique ordonné) |
| T4 | Plafonds en base + mapping des erreurs | ✅ | `errors.ts:78-87` |
| T5 | Pages figées au build | ✅ | `(shop)/layout.tsx:20` ; prod : `X-Nextjs-Prerender: 1`, `Age` < 120 |
| T6 | Requêtes catalogue dupliquées, avis non bornés | ❌ **ouvert, aggravé** | voir E1 |
| T7 | Limiteurs en mémoire | ✅ | `src/lib/ratelimit.ts` (`rate_hit` partagé, repli mémoire, 800 ms) |
| T8 | Nombre de fonctions Vercel | ✅ techniquement | 29 routes et 39 pages déployées sans erreur : Vercel regroupe. Reste la question du plan (F6). |
| T9 | Appels réseau sans borne | ✅ en grande partie | `getUser` 2 s (`checkout/route.ts:150`), `getClaims` + ES256 dans le proxy, FedaPay 8 s, Resend 8 s. Reste : e-mails COD attendus avant la réponse (M7). |
| Min. | `searchIndex` dans chaque page | ❌ ouvert | voir E2 |
| Min. | Purge `webhook_events` | ❌ ouvert | aucune purge dans le code ni le SQL (F3) |
| Min. | RLS en initplan | ✅ (0008) | les nouvelles politiques 0015/0018 l'oublient (F4, sans impact à ce volume) |

---

## 🔴 CRITIQUE

### C1. LCP mobile = le bandeau cookies, rendu seulement après l'hydratation (LCP 4,4 s Slow 4G, 9,1 s profil Bénin)
- `src/components/tracking/ConsentBanner.tsx:67` (`open = consent === null`) et `src/lib/tracking/consent-client.ts:112` (`useSyncExternalStore(…, () => undefined)` : rien au serveur, le bandeau n'apparaît qu'après le chargement et l'exécution de ~1 Mo de JS).
- **Mesure** : sur les 3 passages Lighthouse, l'élément LCP est `<p id="waxo-consent-text">`. Les phases relevées : TTFB 0,8 s, **render delay 3,5 s** (Slow 4G). Avec le profil Bénin, LCP = 9,1 s. Seuil Google « bon » : 2,5 s.
- **Impact** : chaque premier visiteur (donc les données de terrain CrUX, celles qui comptent pour le classement) a un LCP égal au temps d'hydratation. La page est déjà peinte à 1,5 s (FCP), mais le LCP attend le bandeau. Confiance 9/10.
- **Correctif** (Kody) : rendre le bandeau **dans le HTML statique** avec un état neutre, puis le masquer avant la première peinture si un choix existe déjà. Même schéma que l'anti-flash de thème (mémoire `tech-theme-auto-clair-nuit-antiflash`) : un script inline de 2 lignes dans `<head>` lit `localStorage` et pose `data-consent="set"` sur `<html>`, et une règle CSS `html[data-consent=set] #waxo-consent{display:none}`. L'hydratation reprend ensuite la main. Les boutons restent inactifs jusqu'à l'hydratation : acceptable, ou bien de simples `<form>` sans JS. La CSP autorise déjà `'unsafe-inline'` pour les scripts (Next App Router).
  Autre option moins propre : donner au bandeau une surface plus petite que le `h1` du héro pour qu'il ne soit plus candidat LCP. Le premier visiteur paierait quand même le décalage visuel.
- Gain attendu : LCP ≈ FCP, soit **≈ 1,5-2 s en Slow 4G** et ≈ 2,5-3 s au profil Bénin. À re-mesurer avec Lighthouse après correction.

---

## 🟠 ÉLEVÉ

### E1. (T6 ouvert) Lecture du catalogue complet 3 à 6 fois par rendu, avis sans `limit`, campagne relue à chaque appel avec une URL toujours différente
- `src/lib/catalog/index.ts:199-225` : `allProducts()` n'est pas mis en cache. Chaque `getProducts`, `getProductBySlug`, `getProductsByIds` et `getRelatedProducts` relance **3 requêtes** : `products+translations`, **tous** les `reviews(product_id,rating)` sans `limit` (`:166`), et `getLiveCampaigns()`.
- `src/lib/campaigns/data.ts:53` : `.gt("ends_at", new Date().toISOString())` met l'heure à la milliseconde dans l'URL. Chaque appel a donc une URL unique, et la mémoïsation automatique de `fetch` par Next (même URL, même options) **ne peut jamais** s'appliquer. Ce point est certain.
- **Décompte pour une régénération de fiche produit** (`produit/[slug]/page.tsx:42,75,78-85` + layout) : `generateMetadata` (3) + `getProductBySlug` (3) + `getProducts` (3) + `getRelatedProducts` (3) + `getReviews` + `getSettings` + `getCategories` + layout `getShopData` (6) + layout `getLiveCampaigns` (1) = **jusqu'à 22 allers-retours Supabase**. La mémoïsation `fetch` peut fusionner les lectures `products`/`reviews` identiques, mais rien ne le garantit avec supabase-js. Les 6 lectures `campaigns` restent dans tous les cas.
- **Projection, 200 produits et 2 000 commandes par mois** : ~120 Ko par lecture de `products` et ~2 000 avis × ~50 o. Au-delà de **1 000 avis**, PostgREST tronque **en silence** : moyennes fausses (déjà relevé par Zoé à J1). Ordre de grandeur : 0,5 à 1 Mo lu sur Supabase par régénération de fiche. Si Googlebot explore 400 fiches par jour, cela fait **10 à 30 Go par mois**, au-delà des 5 Go d'egress du plan Free de Supabase (plan à confirmer).
- Ajouts depuis J1 : `/api/checkout` (`checkout/route.ts:43-53,176`) relit **tout** le catalogue, les avis et les campagnes pour tarifer 1 à 5 articles (`currentPrices`). `/api/checkout/config` (`config/route.ts:29`) fait de même : **1,2 à 1,5 s de TTFB mesurées avec un catalogue vide**.
- `withTimeout` (`index.ts:39-44`) ne fait toujours pas `clearTimeout`, alors que `lib/auth/timeout.ts` le fait.
- **Correctifs** :
  1. `allProducts` et `getLiveCampaigns` enveloppés dans `cache()` de React (déduplication par rendu, certaine), plus `unstable_cache(…, { revalidate: 60, tags: ["catalog"] })` ou `"use cache"` entre rendus. Arrondir `ends_at` à la minute dans la requête des campagnes.
  2. Remplacer la lecture des avis par un agrégat SQL : vue `product_ratings(product_id, n, sum)` ou colonnes `rating_count`/`rating_sum` tenues par la route d'avis et l'admin.
  3. `currentPrices` : lire seulement `.in("id", ids)` (et `campaign_for`), jamais le catalogue entier.
  4. `/api/checkout/config` : ne renvoyer que les stocks et prix des `ids` demandés, sur une requête ciblée.
  5. `withTimeout` : reprendre `lib/auth/timeout.ts`.
- Gain attendu : de ~22 à ~5 requêtes par régénération de fiche, payload Supabase divisé par environ 10.

### E2. Le catalogue entier est envoyé au navigateur sur l'accueil et sur chaque page (Selection + `searchIndex`)
- `src/app/[lang]/(shop)/page.tsx:32` → `Selection` (`"use client"`, `components/shop/Selection.tsx:19`) reçoit **tous** les produits, description comprise, pour en afficher 4 à 8.
- `src/components/shop/data.ts:30` + `(shop)/layout.tsx:55` : `searchIndex` (nom, prix, image et `hay` = description normalisée) est sérialisé dans **chaque** page de la boutique, via `Header` (client).
- **Mesure** : 469 o par produit + 339 o par entrée d'index (calculés sur la démo, descriptions de ~100 caractères). **Projection** : +19 Ko bruts à 24 produits, **+158 Ko bruts à 200**, +790 Ko à 1 000 dans le flux RSC de l'accueil. Le catalogue (`catalogue/page.tsx:30-31`) sérialise aussi les 200 produits complets pour `CatalogView`. Avec de vraies descriptions de 300 à 600 caractères, multiplier par 2 à 3.
- **Correctif** :
  - Selection : préparer côté serveur une liste de candidats réduite (≤ 40, sans `description`), puis trier côté client selon l'historique.
  - Index de recherche : chargé à la demande (premier focus sur la recherche) depuis une route mise en cache CDN (`/api/search-index?lang=fr`, `s-maxage=300`), ou tronqué à nom + mots-clés.
  - Projection `ProductCard` sans description dans toutes les listes.

### E3. Polices : 231 Ko préchargés en priorité haute, dont 146 Ko de latin-ext servant au seul « ɔ »
- `src/lib/fonts.ts:4-17` : `subsets: ["latin","latin-ext"]` pour les deux familles, donc `next/font` précharge les 4 fichiers.
- **Mesure** : préchargés `dd14639…woff2` (Unbounded latin-ext) **117,6 Ko**, `b59689…` (Unbounded latin) 50,9 Ko, `8800df…` (Onest latin) 33,8 Ko, `ef7940…` (Onest latin-ext) 28,4 Ko. Lighthouse : les 4 partent à 880 ms en priorité **High**, en même temps que le chunk principal (150 Ko, priorité Low).
- **Impact** : au profil Bénin (700 kbit/s ≈ 87 Ko/s), les 146 Ko de latin-ext préchargés coûtent environ **1,7 s de bande passante** avant le JS et avant toute image LCP.
- **Correctif** : précharger seulement le latin. Option A : le logo « Wá xɔ » en SVG inline, et `subsets: ["latin"]`. Le « ɔ » des textes courants retombe alors sur la police de repli ; à valider avec Vincent. Option B : deux appels `next/font` par famille, `latin` (`preload: true`) et `latin-ext` (`preload: false`), chaînés dans `font-family`. Le navigateur ne charge alors le latin-ext qu'à la première rencontre du « ɔ » (`unicode-range`), sans le préchargement prioritaire. À vérifier au rendu réel : le « ɔ » doit rester en Unbounded.

### E4. Cron quotidien : la tâche « argent » peut être tuée avant l'expiration, et tout le reste passe avant
- `src/app/api/cron/expire-orders/route.ts:45-52` : `refreshFxRates` (jusqu'à 5 s) passe **avant** la partie argent.
- `:76-95` : rattrapage FedaPay **séquentiel** sur 100 candidats au plus, 8 s maximum chacun (`fedapay.ts:15`), **sans garde de temps**.
- `:101-108` : e-mails d'annulation séquentiels (Resend 8 s maximum chacun).
- `maxDuration = 30` (`:22`). Une seule exécution par jour (`vercel.json`, Hobby).
- **Calcul** : à ~0,3-0,5 s par appel FedaPay, 60 à 100 candidats prennent 30 à 50 s. La fonction est tuée **avant** `expire_stale_orders` (`:98`) : aucun stock libéré pendant 24 h de plus, et le lendemain le lot est encore plus gros (spirale). À 2 000 commandes par mois avec environ 40 % en ligne et 30 % d'abandon, on compte ≈ 8 candidats par jour : ça passe. **À ×10, ça casse.** Les annulations au-delà des 100 candidats (le SQL en traite 500) et les COD annulés par le SQL ne reçoivent pas d'e-mail.
- **Correctif** (voir la mémoire `tech-money-path-time-budget-guard`) :
  1. Ordre : expiration SQL (avec rattrapage borné) **d'abord**, taux de change et avis **ensuite**.
  2. Garde de temps sur le rattrapage (`if (Date.now() > startedAt + 12_000) break`), parallélisme borné à 5 par `Promise.allSettled` en tranches.
  3. E-mails d'annulation via `after()` ou dans un lot parallèle borné, et basés sur la liste réellement annulée (`returning id` du RPC) plutôt que sur les candidats.
  4. Confirmer ou poser le `pg_cron` toutes les 10 min proposé à J1 (`select public.expire_stale_orders(60, 48)`). Sans lui, une commande Mobile Money abandonnée bloque le stock jusqu'à 24 h, ce qui pèse lourd pendant une campagne avec peu d'unités.

### E5. Statistiques et tableau de bord : tronqués en silence à 2 000 commandes
- `src/lib/admin/data/stats.ts:19-21,31-41` : `PAGE = 200`, `MAX_PAGES = 10`, `HISTORY_DAYS = 400`. `fetchAll` s'arrête à 2 000 lignes **sans drapeau `truncated`**. Utilisé par `getStats` et par `getDashboard` (`dashboard.ts:29`), donc à **chaque** ouverture de `/admin`.
- **Impact** : à 2 000 commandes par mois, « CA 90 jours / 12 mois » ne couvre en réalité que le dernier mois, **sans avertissement**. Le carnet (`ledger.ts:23`) utilise le même plafond. Coût : 10 allers-retours séquentiels `iad1 → eu-west-1` avec `order_items` imbriqués, environ 1 à 3 s par ouverture de l'admin. Confiance 9/10.
- **Correctif** : agréger en SQL, avec une fonction `admin_stats(p_since)` (SECURITY DEFINER, `service_role`) qui renvoie les séries jour × statut, le top produits et les totaux (`group by`). Le JS ne reçoit que quelques centaines de lignes. Ajouter l'index `orders(created_at desc)` : `orders_status_idx(status, created_at)` ne sert pas un filtre sur la seule date. En attendant : exposer `truncated` et l'afficher (bandeau « statistiques partielles »).

### E6. Quotas Resend probablement dépassés au volume visé (à vérifier)
- Par commande avec e-mail : C1, C2 (en ligne), C3, C4, C5, S1 (alerte boutique) et la demande d'avis, soit 5 à 7 envois (`docs/emails/inventaire.md`). Plus l'Auth Supabase via le SMTP Resend.
- **Projection** : 2 000 commandes par mois, dont 50 % avec e-mail, donne ≈ 7 000 à 9 000 e-mails par mois. Le plan gratuit Resend est plafonné à **3 000 par mois et 100 par jour** (à confirmer selon le plan souscrit). Au-delà, `sendViaResend` reçoit un 429 et l'e-mail est perdu sans alerte. La demande d'avis remet `review_requested_at` à null et réessaie, mais pas les e-mails de commande.
- **Correctif** : vérifier le plan Resend (Pro dès ~20 commandes par jour), journaliser `console.error` sur les 429 et 5xx Resend, et compter les échecs dans l'admin.

### E7. Région des fonctions Vercel (`iad1`, États-Unis) éloignée de la base (`eu-west-1`, Irlande)
- `vercel.json` ne fixe pas de région. Mesuré : `X-Vercel-Id: cdg1::iad1::…` et `db.…supabase.co` dans `2a05:d018::/35` = eu-west-1.
- **Impact** : chaque requête Supabase depuis une fonction traverse l'Atlantique (RTT AWS us-east-1 ↔ eu-west-1 ≈ 70-80 ms). `/api/checkout` enchaîne 8 à 10 étapes **séquentielles** (`rate_hit`, packs, `getUser`, `findByIdem`, `currentPrices`, `place_order`, mise à jour `idem_key`, e-mails ou FedaPay) : ≈ **0,6-0,8 s de latence pure** par commande. Même logique pour l'admin, les régénérations ISR et le cron. Mesuré : `/api/checkout/config` à 0,8 s côté Vercel avec un catalogue vide. Les pages en cache (HIT) ne sont pas touchées (proxy mesuré à +25 ms).
- **Correctif** : `"regions": ["dub1"]` dans `vercel.json` (une région possible sur Hobby). C'est sans risque : la base ne bouge pas, seul le calcul se rapproche. Le trajet du visiteur passe déjà par `cdg1` (Paris), et `cdg1 → dub1` est plus court que `cdg1 → iad1`. Re-mesurer `/api/checkout/config` après déploiement : cible < 0,5 s de TTFB.

---

## 🟡 MOYEN

### M1. Meta Pixel chargé dès l'hydratation : 156 Ko br / 600 Ko bruts, 200 ms de blocage
- `src/components/tracking/TrackingProvider.tsx:172-175` → `loadPixel()` (`lib/tracking/providers.ts:93-119`) dans un `useEffect`, dès l'arrivée (décision de Fresnel, opt-out).
- **Mesure Lighthouse** : Facebook 216 Ko transférés, **299 ms de thread principal, 199 ms de blocage** (Moto G Power simulé). Sur un Tecno ou Itel d'entrée de gamme, compter environ ×2. 43 + 42 Ko inutilisés.
- **Correctif** (sans changer la décision de consentement) : différer le chargement après `load` + `requestIdleCallback`, avec un plafond de 4 s, ou à la première interaction (scroll, toucher). La file `fbq` capte les événements en attendant : aucun événement perdu. Gain : TBT et INP au premier chargement, le JS de Meta ne concurrence plus l'image LCP.

### M2. Toutes les traductions (9 namespaces, ≈ 53 Ko) dans chaque page
- `src/app/[lang]/layout.tsx:49` : `<NextIntlClientProvider>` sans `messages`, donc next-intl transmet **tous** les messages chargés par `src/i18n/request.ts:13-23`.
- **Mesure** : présents dans le flux de `/fr` : Account (23,8 Ko), Checkout, Legal, Assistant, Packs, Consent, Product… ≈ 53 Ko minifiés, **≈ 66 % du flux RSC**, ≈ 15 Ko br, plus le parse et la conservation en mémoire sur un téléphone modeste.
- **Correctif** : `messages={pick(messages, ["Brand","Lang","Express","Card","Shell","Consent","Cart","Assistant"…])}` dans le layout boutique. Les namespaces de page (Checkout, Account, Legal, Packs, Product) sont fournis par des `NextIntlClientProvider` imbriqués dans les pages qui en ont besoin. Gain : ≈ 30 à 40 Ko bruts par page.

### M3. zod envoyé au navigateur sur toutes les pages (31 Ko br / 105 Ko bruts)
- Chaîne : `Header` → `AccountMenu` → `AuthModal` → `AuthForm.tsx:7` → `lib/auth/validation.ts` (zod). Et `Newsletter.tsx:6` → `components/shop/newsletter-schema.ts:1,15` (module qui crée un schéma zod au chargement alors que le client n'utilise que `validEmail`/`validPhone`).
- **Mesure** : chunk `37h8mc5kboabv.js` (377 occurrences de « zod », `superRefine`, `ZodError`), dont 24 Ko inutilisés selon Lighthouse.
- **Correctif** : `AuthModal` via `next/dynamic(…, { ssr: false })`, chargé à l'ouverture. Séparer `newsletter-schema.ts` en `newsletter-validate.ts` (fonctions pures, sans zod) pour le client et `newsletter-schema.ts` (zod) pour la route. Même traitement pour `AssistantWidget` (chargé sur chaque page, utilisé rarement).

### M4. Images produits : 1 200 px servies partout, en `background` CSS (pas de `srcset`, pas de priorité, pas de lazy)
- `src/lib/media/crop.ts:6` (`MAX_OUTPUT_SIDE = 1200`, WebP 0,82) ; `ProductCard.tsx:72`, `HomeHero.tsx:13`, `Selection.tsx:69`, `produit/[slug]/page.tsx:92` (`cssImage`) : toutes les images passent par `style={{ background: url(…) }}`.
- **Impact (projection, aucune image réelle à mesurer aujourd'hui)** : un WebP de 1 200 px à 0,82 pèse typiquement 80 à 180 Ko, alors qu'une carte mobile fait ~170 px de large (≈ 340 px utiles en 2×). L'accueil (héro 3, aperçu 8, sélection 4-8, meilleures ventes 4) charge ~20 images, soit **2 à 3 Mo**. Le scanner de préchargement ne voit pas les `background` en ligne, et l'image LCP du héro ou de la fiche n'est découverte qu'après la CSS et les polices.
- **Correctif à coût nul** (pas d'optimiseur Vercel, pas de transformation Supabase payante) : à l'envoi, le recadreur produit **deux** fichiers, 1 200 px et 400 px (même canvas, une passe de plus). Rendu avec `<img src=400 srcset="400w,1200w" sizes=… loading="lazy" decoding="async">`, et `fetchpriority="high"` sans lazy pour l'image principale de la fiche et la première du héro. Budget : carte ≤ 30 Ko, héro et fiche ≤ 90 Ko. À mesurer dès le premier vrai produit.

### M5. Catalogue sans pagination : 200 cartes en HTML **et** 200 produits dans le flux, re-rendus à chaque ajout au panier
- `components/shop/CatalogStatic.tsx:27` et `CatalogView.tsx:157` : `products.map`, sans limite.
- Chaque `ProductCard` s'abonne au panier complet (`ProductCard.tsx:38`, `useCartLines()` renvoie un nouveau tableau à chaque changement). Un ajout au panier re-rend donc **toutes** les cartes.
- **Projection, 200 produits** : HTML ≈ 200 × ~1,5 Ko de balisage, soit ~300 Ko bruts, plus ~100 Ko de flux. DOM ≈ 5 000 nœuds (Lighthouse alerte au-delà de 1 400). INP de l'ajout au panier : 200 rendus de carte, estimés à 50-150 ms sur un Android d'entrée de gamme.
- **Correctif** : 24 cartes puis « Voir plus » (ou `?page=` côté serveur pour le SEO). Hook sélecteur `useCartQty(id)` qui renvoie un nombre (re-rend uniquement la carte concernée). Même principe pour `useIsFavorite` (déjà ciblé).

### M6. Écrasement du stock par l'admin (mise à jour perdue)
- `src/app/admin/(panel)/produits/actions.ts:172-183` : `updateProduct` réécrit `stock: input.stock`, la valeur du formulaire chargée à l'ouverture du tiroir. `adjustStock` (`:260-283`) est bien conditionnel, mais pas l'enregistrement de la fiche.
- **Scénario** : l'admin ouvre un produit (stock 10), deux clients achètent (stock 8), l'admin corrige le prix et enregistre : stock remis à 10, soit **2 ventes possibles sans marchandise**. Probable à 2 000 commandes par mois, surtout pendant une campagne. Confiance 8/10.
- **Correctif** : n'écrire `stock` que s'il a été modifié dans le formulaire, et alors en conditionnel `.eq("stock", stockInitial)` avec message « le stock a changé ». Ou retirer `stock` de `updateProduct` et passer uniquement par `adjustStock`/`setProductStock`. Bonus : `products` et `product_translations` sont écrits en 2 appels non transactionnels. Une fonction SQL `save_product` comme `save_campaign` éviterait un état à moitié enregistré.

### M7. E-mails et notifications attendus avant la réponse (COD, webhook)
- `checkout/route.ts:235` : la confirmation et l'alerte boutique sont attendues jusqu'à 3 s avant de répondre au client COD. Au-delà de 3 s, la réponse part, mais rien ne garantit que la fonction reste vivante pour finir l'envoi.
- `lib/payment/settle.ts:52` : le webhook FedaPay attend les e-mails, en plus de `fetchTransaction` (8 s), avant de répondre 200. Pire cas ≈ 16 s : relance FedaPay possible (idempotent, donc sans gravité).
- **Correctif** : `after()` de `next/server` pour les e-mails (exécution garantie après la réponse via `waitUntil`), et réponse immédiate.

### M8. Demandes d'avis : débit plafonné à 15 par jour
- `src/lib/email/review-request.ts:14` (`MAX_PER_RUN = 15`), fenêtre de 3 à 14 jours, 4 allers-retours séquentiels par commande (dont `product_translations` relu par commande, `:51-53`).
- **Projection** : 2 000 commandes par mois ≈ 60 livraisons par jour, dont ~30 avec e-mail. Avec 15 envois par jour, le stock en attente grossit de 15 par jour et sort de la fenêtre des 14 jours : **≈ 50 % des clients ne sont jamais sollicités**.
- **Correctif** : traductions lues une fois pour tout le lot, envois parallèles bornés (3 à 5), `MAX_PER_RUN` à 60, ou API batch de Resend. Index partiel `orders(delivered_at) where status='livree' and review_requested_at is null and email is not null`.

### M9. Promesse de livraison et devise : le texte change après l'hydratation (risque de CLS à mesurer)
- `components/shop/DeliveryPromise.tsx:26-31` : état `neutral` au serveur, puis l'état réel. En FR, la barre du haut passe de 60 à **69-78 caractères** le soir (`topbarShort.tomorrow` / `tomorrowSunday`) et le héro de 79 à 63-72. Prix en € ou $ : bascule après lecture de `localStorage` (`lib/currency/client.tsx`).
- **Mesure** : CLS 0 sur `/fr` à 13 h (état `today`, longueur proche du neutre). Le cas du soir n'est pas mesuré.
- **Correctif** : mesurer avec Playwright en 360 px, horloge simulée à 21 h, et réserver la hauteur (`min-h` de 2 lignes sur mobile pour la barre du haut) ou égaliser la longueur des variantes.

### M10. Redirections à l'arrivée : +0,83 s depuis `waxo.boutique`
- Mesuré : `waxo.boutique/` → 308 `www.waxo.boutique/` → 307 `/fr` = 2,04 s, contre 1,21 s en accès direct à `/fr`.
- **Correctif** : utiliser `https://www.waxo.boutique/fr` dans les publicités Meta, la bio, WhatsApp et les QR codes. Optionnel : redirection `has: host=waxo.boutique` → `https://www.waxo.boutique/fr` en un seul saut.

### M11. Observabilité : les échecs du parcours argent sont avalés
- Sentry ne voit que les exceptions non attrapées (`instrumentation.ts`, `onRequestError`). Or `checkout/route.ts:259` (`catch { return fail(…"server_error") }`) ne journalise rien, le cron renvoie `500 failed` (`:99,121`) sans `console.error` ni `captureException`, et les échecs Resend ne sont pas comptés. Aucun `captureException` dans tout `src/`.
- **Correctif** : `Sentry.captureException(e, { tags: { path: "checkout" } })` dans les `catch` du parcours argent (checkout, webhook, settle, cron), `console.error` structuré avec le n° de commande, et un compteur admin des `payments.status='needs_refund'` (déjà recommandé à J1, non fait). Alerte Sentry sur `cron failed`.

---

## 🟢 FAIBLE

- **F1. Avis boutique : 200 lignes lues pour en afficher 6** (`(shop)/page.tsx:25`). Moyenne et compte via un agrégat SQL, et `limit(6)` pour l'affichage (la moyenne « réelle » ne l'est plus au-delà de 200 avis).
- **F2. Bandeau de campagne** : minuterie à 1 s (`CampaignBanner.tsx:15`) qui re-rend le compte à rebours. Négligeable. Passer à 60 s quand il reste plus d'une heure.
- **F3. `webhook_events` et `payments.raw`** croissent sans purge (J1). `rate_limits` est purgé par le cron.
- **F4. Nouvelles politiques RLS sans initplan** : `0015_campaigns.sql:36,40` et `0018_site_reviews.sql:30` utilisent `public.is_admin()` par ligne. Tables petites, sans impact mesurable, mais `(select public.is_admin())` par cohérence avec 0008.
- **F5. Cookie `NEXT_LOCALE` posé sur chaque page** (`Set-Cookie` sur les réponses en cache). Inutile avec le préfixe de langue dans l'URL : `localeCookie: false` dans `routing.ts` si aucune fonction n'en dépend.
- **F6. Plan Vercel** : Hobby interdit l'usage commercial (conditions Vercel) et limite les crons à 1 par jour. Pro pour une boutique en production (aussi pour E4 si pg_cron n'est pas retenu).
- **F7. Sentry côté client sans `withSentryConfig`** : `tracesSampleRate: 0` mais le code de tracing reste dans le bundle (`browserTracingIntegration` présent dans le chunk principal de 469 Ko). À mesurer avec l'analyseur de bundle (Kody, `next experimental-analyze` ou `@next/bundle-analyzer`). Piste : `bundleSizeOptimizations.excludeTracing`, ou Sentry chargé paresseusement.
- **F8. Index** : `orders(created_at desc)` (stats, accountant), et `orders(phone)` général pour l'éligibilité des avis boutique (`api/site-reviews/route.ts:71`, `or(user_id, phone)`). Sans effet sous 50 000 commandes.

---

## Migrations de données : ✅ (0015 → 0018)

| Migration | Nature | Verrous / risque | Réversibilité (1-5) |
|---|---|---|---|
| 0015 campagnes | additive (2 tables, 2 colonnes nullables, fonctions, `place_order` réécrit à l'identique de 0008 + prix de campagne) | `add column` nullable sans défaut : instantané ; `create index` sur `order_items` : petite table | **5** (`0015_down.sql` présent) |
| 0016 confidentialité | données (`pages`), conditionnelle | aucun | 4 (inverse manuel) |
| 0017 livraison express | données : `cutoff` 18 → 20 si inchangé, pages réécrites seulement si d'origine | aucun | 4 (`jsonb_set` inverse ; texte d'origine dans le fichier) |
| 0018 avis boutique (non appliquée) | additive (1 table, 2 index, 1 politique) | aucun, table neuve | **5** (`drop table public.site_reviews`) : ajouter un `0018_down.sql` d'une ligne par cohérence |
| `purge_demo.sql` | suppression ciblée par ID, transaction, garde-fou | exécutée le 2026-10-12 | 1 (par conception, restaurable seulement depuis une sauvegarde) |

Ordre de déploiement de 0018 (expand-contract) : appliquer le SQL **avant** de pousser le code qui lit `site_reviews`. Le code tolère déjà l'absence de la table (`getPublishedSiteReviews` → `[]`), donc l'ordre inverse est aussi sans casse. `/fr/avis-boutique` répond **404 en prod** aujourd'hui : la page n'est pas encore déployée, ce n'est pas une erreur.

## Concurrence

- `place_order` : verrou unique ordonné + verrou consultatif par téléphone, conservés par 0015 (`0015_campaigns.sql:153-165`). Le prix de campagne est calculé sous le verrou, et le contrôle `price_changed` côté route protège de la hausse. ✅
- Idempotence du checkout (`idem_key` unique + annulation du doublon) ✅. Webhook et `mark_paid` idempotents ✅. Demande d'avis : réservation par `update … is null` avant l'envoi ✅.
- ❌ Stock écrasé par la fiche admin (M6).
- Point chaud à ×10 : un produit vedette en campagne sérialise ses commandes sur un seul verrou de ligne (~10-30 ms par transaction, donc ≈ 30-100 commandes/s maximum sur ce produit). Suffisant jusqu'à ×100.

## Scalabilité

| Volume | Ce qui casse en premier |
|---|---|
| ×1 (200 produits, 2 000 commandes/mois) | E5 statistiques fausses en silence ; E6 quota Resend ; E1 avis > 1 000 (moyennes fausses) ; E2/M5 poids des pages ; M8 avis non sollicités ; Supabase egress si plan Free |
| ×10 (20 000 commandes/mois) | E4 cron tué avant l'expiration (stock bloqué) ; admin `clients` (`clients.ts:55`, 5 × 1 000 lignes) et exports lents ; `fetchAll` stats à 8 s par page ; quotas Supabase (Free) dépassés |
| ×100 | ISR + catalogue en mémoire (`allProducts` 1 000+ produits par rendu) : à remplacer par des requêtes ciblées et paginées en SQL ; la recherche doit passer en SQL (`pg_trgm`) ; `searchIndex` impossible à embarquer (≈ 800 Ko par page) |

## Ordre de correction conseillé (gain / effort)

1. **C1** bandeau cookies dans le HTML (LCP −2 à −6 s, ~30 lignes).
2. **E7** `regions: ["dub1"]` (1 ligne ; −0,5 s environ sur chaque appel dynamique).
3. **E3** polices latin seulement en préchargement (−146 Ko prioritaires).
4. **M1** Pixel différé, **M3** zod et AuthModal en dynamique, **M2** messages filtrés (−~200 Ko de JS au premier chargement, TBT en baisse).
5. **E1** `cache()` + agrégat des avis + requêtes ciblées au checkout (fiabilité des moyennes, egress, TTFB checkout).
6. **E4** ordre et garde de temps du cron + confirmation pg_cron.
7. **E5** stats agrégées en SQL ; **M6** stock admin conditionnel.
8. Avant les vraies photos : **M4** (2 tailles à l'envoi, `<img srcset>`), puis **E2/M5** (pagination, projections réduites).

Après chaque lot : re-mesurer avec le même protocole (Lighthouse mobile ×3 en prenant la médiane, `curl` TTFB et octets br, décodage du flux RSC) et comparer à la baseline de ce document. Une régression se juge sur l'écart, pas sur une valeur isolée.

## Questions pour Fresnel (via Kody)

1. pg_cron a-t-il été activé et la tâche `waxo-expire-orders` planifiée dans Supabase ? (E4 / T2)
2. Plans Supabase, Resend et Vercel actuels ? (E1 egress, E6, F6)
3. Les publicités et liens utilisent-ils `waxo.boutique` ou `www.waxo.boutique/fr` ? (M10)
