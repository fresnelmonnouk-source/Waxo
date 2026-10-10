# Audit QA J1 — Nadia

Périmètre : boutique, fiche produit, panier, commande, compte/auth, suivi invité, favoris, contact, newsletter, pages d'infos (J1).
Exclus : admin, assistant, e-mails, tracking, webhooks, cron (autres agents).
Runner : vitest 5 (`npx vitest run`) · types : `npx tsc --noEmit`. Pas de navigateur lancé (`.next` partagé) : les 4 états UI ont été relus dans le code, pas rendus.

## 1. Preuves fraîches (09/10/2026)

- Après (dernière exécution) : `npx vitest run` → 58 fichiers, 779 passés, 11 « expected fail », 0 échec (un échec transitoire de `tests/assistant-engine.test.ts`, hors périmètre, vu en cours de route).
- Après : `npx vitest run` → 588 passés, 11 « expected fail », 2 échecs, tous dans `tests/assistant-engine.test.ts` (hors périmètre, agent assistant).
- Mes 5 fichiers `tests/qa-*.test.ts` : 248 tests, 0 échec, 11 `it.fails` (bugs confirmés, voir §3).
- `tsc --noEmit` : aucune erreur dans `tests/`. Erreurs restantes dans `src/app/admin/**` et `src/components/checkout/OrderConfirmation.tsx` (imports `phone-pay` / `return-params` pas encore créés par l'agent paiement) : hors périmètre, à revérifier à la fin des chantiers parallèles. `eslint tests/qa-*.test.ts` propre.

Convention `it.fails` : le test passe tant que le bug existe, ÉCHOUE le jour où il est corrigé. Kody retire alors `.fails` : c'est le test de non-régression. Chaque bug a un identifiant QA-n cité dans le commentaire du test.

## 2. Carte de couverture (chemins du code J1)

Légende : ★★★ comportement + limites + erreurs · ★★ nominal seulement · ★ fumée · [GAP] non testé · [→E2E] il faut l'app réelle avec base.

```
LOGIQUE PURE
  shipping.ts (frais, franco, %, clamp)      ★★★  parité SQL prouvée sur 5 configs x 9 sous-totaux (qa-checkout-limits)
  phone.ts / validation.ts / newsletter      ★★★  + parité des 3 copies de normPhone
  checkout/schema.ts (commande, avis)        ★★★  qty 0/1/99/100/1.5/"2", 50/51 lignes, UUID, bornes texte
  checkout/errors.ts, rate-limit.ts          ★★★
  anti-robot (looksLikeBot, checkBot)        ★★★  bornes exactes 2499/2500 ms ; trou d'horloge → QA-1
  cart/store.ts                              ★★★  (était [GAP]) fusion, plafond 99, données corrompues, stockage bloqué
  favorites/store.ts                         ★★★  (était [GAP])
ROUTES API
  POST /api/checkout                         ★★★  (était ★★) invité/connecté, paiement en ligne, redirections, SQL inattendu, CGNAT
  POST /api/reviews                          ★★★  (était [GAP]) 401, doublon, usurpation d'auteur, drapeaux verified/seed/hidden
  POST /api/orders/track                     ★★★  anti-énumération, brute-force par numéro et par IP, erreurs base
  POST /api/contact                          ★★★  (était [GAP])
  POST /api/auth/signup | login | forgot     ★★★  (étaient [GAP]) anti-énumération prouvée par comparaison de réponses
  GET  /api/auth/callback/[lang]/[kind]      ★★★  (était [GAP]) open-redirect, lien expiré, cookie récupération
  GET  /api/me, /me/orders                   ★★   401 et repli testés ; mapping des commandes [GAP] mineur
  PATCH /api/me/profile, POST /me/password   ★★★  (étaient [GAP]) colonnes protégées, cookie de récupération
  GET  /api/products, /checkout/config       ★★★  (étaient [GAP])
  POST /api/newsletter                       ★★★  + doublon 23505, normalisation
SCHÉMA SQL (statique)                        ★★   RLS partout, SECURITY DEFINER révoquées, contraintes ; comportement réel → [→E2E]
COMPOSANTS (états UI)                        [GAP] aucun test de rendu client interactif (pas de jsdom/Playwright dans le dépôt)
  CheckoutFlow, CartDrawer, TrackForm, FavoritesView, ReviewsSection, AuthForm        [→E2E]
  pages légales / coque boutique (rendu serveur)                                      ★★ (tests existants shop-render, account-legal-render)
COUVERTURE : 15/18 familles de chemins ≥ ★★ ; les 3 manquantes sont l'interactif client [→E2E].
```

## 3. Bugs confirmés (classés)

MISE À JOUR en cours d'audit : pendant mon passage, le correctif Zoé est arrivé sur `POST /api/checkout` (`src/app/api/checkout/guard.ts` : délai tolérant à l'horloge, plafonds 10/article et 20/commande, clé d'idempotence `idem` + migration 0007). Mes tests ont été adaptés : QA-1 (côté commande) et QA-12 passent de « bug » à « non-régression » (sections « horloge du téléphone », « idempotence », 3 tests de plafonds dans `qa-api-checkout-reviews`). Restent ouverts : QA-1 pour les AVIS (`reviews/route.ts` utilise encore `looksLikeBot`), QA-1b (formulaires du compte), QA-1c (newsletter), et tout le reste du tableau. Statut « corrigé » sur QA-12 ; QA-1 « partiel ».

Chaque bug a un test `it.fails` dans les fichiers `tests/qa-*.test.ts` (déjà écrit, rien à ajouter). Recoupe les rapports Raphaël (sécurité) et Zoé (red-team) : QA-1 = Zoé n°2, QA-9 = Raphaël Y4, QA-11 = Raphaël O3, QA-12 = Zoé n°3, QA-8 = Zoé n°5.

| Id | Gravité | Bug | Où | Confiance | Test (`it.fails`) |
|----|---------|-----|----|-----------|-------------------|
| QA-1 | ÉLEVÉE | Un client dont l'horloge avance de plus de ~1 s sur le serveur ne peut ni commander ni noter : `t > now + 1000` = robot. Le message est le générique « informations invalides » : le client est bloqué sans explication. | `lib/checkout/schema.ts:70` | 10/10 | `qa-checkout-limits` « QA-1 » |
| QA-1b | ÉLEVÉE | Même cause, logique INVERSÉE dans `lib/auth/bot-guard.ts:18` : une horloge en avance de 3 s à 10 min renvoie `tooFast` (contact, inscription, mot de passe oublié, suivi) ; seules les horloges en avance de PLUS de 10 min passent. Le test existant ne couvre que « +1 h ». | `lib/auth/bot-guard.ts:18` | 10/10 | `qa-checkout-limits` « QA-1b » |
| QA-1c | MOYENNE | Newsletter : tout horodatage futur est refusé en 429 `too_fast`. | `components/shop/newsletter-schema.ts:44-45` | 9/10 | `qa-api-account` « QA-1c » |
| QA-2 | MOYENNE | Sans Supabase (ou catalogue en repli démo), les ids sont « lampe », « air »… (non UUID) : `POST /api/checkout` répond 422 « article invalide » au lieu de 503 « indisponible » promis par le brief. | `api/checkout/route.ts:72-79` avant `:85` | 9/10 | `qa-api-checkout-reviews` « QA-2 » |
| QA-8 | MOYENNE (latent) | Le panier garde les ids de démo après branchement de Supabase : commande refusée en 422 à chaque essai, sans dire quel article retirer. | `lib/cart/store.ts:28-38` | 8/10 | `qa-cart-favorites-store` « QA-8 » |
| QA-9 | MOYENNE | « 1 avis par client et par produit » = SELECT puis INSERT, sans index unique : doublon par double-tap (le test de caractérisation montre 2 insertions pour 2 envois simultanés). | `api/reviews/route.ts:84-107`, `0001_core.sql:192` | 9/10 | `qa-schema-static` « QA-9 » |
| QA-11 | MOYENNE | `profiles.phone` non unique alors que c'est un identifiant de connexion (la connexion par téléphone renvoie null dès 2 correspondances : verrouillage de la victime). | `0001_core.sql:12` | 9/10 | `qa-schema-static` « QA-11 » |
| QA-12 | MOYENNE | Aucune idempotence de commande : sur 3G, expiration réseau puis nouvel essai = 2 commandes, 2 réservations de stock. `CheckoutFlow` ne vide le panier que sur réponse reçue. | `api/checkout/route.ts`, `place_order` | 8/10 | `qa-schema-static` « QA-12 » |
| QA-10 | FAIBLE | Verrou de connexion par identifiant : clé = texte brut, donc « 0197000000 » / « 01 97 00 00 00 » / « +229 0197000000 » sont 3 compteurs. Contournement du verrou (reste 20 essais/IP/10 min). | `api/auth/login/route.ts:25` | 9/10 | `qa-api-account` « QA-10 » |
| QA-3 | FAIBLE | `00229 01 97…` accepté à l'inscription/suivi, refusé à la commande et à la newsletter (3 copies de `normPhone`). | `lib/checkout/phone.ts:9` vs `lib/auth/validation.ts:15` | 10/10 | `qa-checkout-limits` « QA-3 » |
| QA-6 | FAIBLE | Franco désactivé (`freeFrom` ≤ 0) : le tiroir panier affiche quand même « Livraison offerte à Cotonou et Calavi » (`remaining === 0`). | `components/shop/CartDrawer.tsx:171` | 8/10 | `qa-checkout-limits` « QA-6 » |
| QA-7 | FAIBLE | `cart.add` d'une quantité négative sur une ligne existante stocke une quantité < 1 (ligne perdue au rechargement). Aucun appelant actuel. | `lib/cart/store.ts:76` | 9/10 | `qa-cart-favorites-store` « QA-7 » |

Risque de conception sans `it.fails` (comportement actuel verrouillé par un test de caractérisation) :
- QA-4 (MOYEN) : le seau du checkout (8 requêtes / 10 min / IP) est consommé aussi par les refus de validation. Opérateurs mobiles en CGNAT : quelques clients derrière la même IP, ou 2-3 fautes de frappe + un « stock insuffisant », et la commande est bloquée 10 min (`qa-api-checkout-reviews` « caractérisation »). Fix : ne compter que les requêtes valides, ou monter la limite et clé IP + empreinte.
- QA-5 (MOYEN, UX) : stock insuffisant (409 `out_of_stock`) ne dit pas QUEL article ; le panier n'est pas resynchronisé. Le tiroir ne corrige pas non plus une ligne dont la quantité dépasse le nouveau stock (il bloque seulement le « + »).
- `lastName` / `firstName` : 2 caractères minimum (`validation.ts:39`) : un nom d'une lettre est refusé à l'inscription et à la mise à jour du profil (rare, à décider).
- Aucun e-mail n'est collecté par `CheckoutFlow` (le schéma l'accepte). Conséquences : suivi invité par e-mail impossible, et aucune adresse pour les futurs e-mails de confirmation (agent e-mails) ; même un client connecté n'a pas son e-mail rattaché à la commande. À trancher avant J2.
- Moyens de paiement tous désactivés : `CheckoutFlow` retombe sur `"cod"` même désactivé → 422 `payment_method_disabled` au clic ; aucun état « paiement indisponible » à l'écran (`CheckoutFlow.tsx:86,141`).
- Fantômes de favoris : un id de favori dont le produit a disparu est compté dans le badge de l'en-tête mais jamais affiché (`FavoritesView.tsx:43`).
- `getProducts`/`fetchDbProducts` : si Supabase répond mais que la table `products` est vide (ou tous inactifs), le site affiche le catalogue de DÉMO (`catalog/index.ts:131`). À retirer avant la prod (cf. Raphaël Y8).

## 4. Les 4 états UI (relecture du code, pas de rendu)

| Écran | Chargement | Vide | Erreur | Succès | Remarque |
|-------|:---:|:---:|:---:|:---:|---|
| Commande `/commande` | ✅ (shell tant que non hydraté) | ✅ « panier vide » | ✅ `errGeneric` / `errNetwork` / erreurs par champ | ✅ → `/commande/merci` | double-clic : protégé par `paying` (état) mais pas d'idempotence serveur (QA-12) |
| Tiroir panier | repli réglages par défaut | ✅ | stock/config en échec : silencieux (repli) | ✅ | pas de nouvelle vérification du stock pour les lignes déjà au panier |
| Favoris | ✅ `role=status` | ✅ | ✅ + « réessayer » | ✅ | seul écran avec retry explicite côté liste |
| Suivi invité | bouton `searching` | n/a | ✅ `notFound`, 429, 503 | ✅ | erreur réseau (status 0) → code `network` |
| Mes commandes | ✅ | ✅ | ✅ + réessayer | ✅ | |
| Compte (session) | ✅ | n/a | invité → connexion ; panne `/api/me` = traité comme invité (voir §6) | ✅ | |
| Catalogue / recherche | n/a (page statique) | ✅ `emptyTitle` | n/a | ✅ | |
| Avis | bouton `busy` | liste d'avis vide : à vérifier visuellement | ✅ message serveur localisé | ✅ + `already_reviewed` géré | |
| Contact / inscription / connexion | bouton `busy` | n/a | ✅ par champ + formulaire | ✅ | |

À jouer dans un vrai navigateur (je ne l'ai pas fait) : réseau coupé (mode avion) sur chaque formulaire, 3G throttlée, lecteur d'écran sur les erreurs, localStorage désactivé.

## 5. Cas sans Supabase (repli démo)

Vérifié par tests : toutes les routes répondent proprement sans clés : checkout 503, reviews 503, contact 503, signup/login/forgot 503, track 503, newsletter 503, `/api/me` → `{ user: null }`, `/api/products` et `/api/checkout/config` servent la démo ou `{ ok: false }` en 200. Exception : QA-2 (422 au lieu de 503 pour un panier de démo).
Pas de 500 brute ni de stack observée dans aucun test d'erreur : les messages internes (`secret`, codes SQL) ne fuient dans aucune réponse testée.
Reste [→E2E] : le build statique (ISR) quand Supabase est lent (timeouts 4 s) et le retour au catalogue de démo en cas de panne passagère (cache de 2 min sur la fiche produit : produit fantôme possible, cf. Zoé n°5).

## 6. Flakiness et hygiène des tests

- Mes tests : aucune horloge réelle dépendante (bornes passées en paramètre `now`) sauf `Date.now() - 10_000` côté route, marge de 7,5 s ; aucun `sleep`, aucun réseau. Isolation : `vi.resetModules()` + IP différente par test pour les limiteurs globaux.
- Tests existants à surveiller : `tests/shop-newsletter.test.ts` (IP « 9.9.9.9 » partagée entre tests, limiteur global du module → dépend de l'ordre ; ils font `resetModules`, donc OK aujourd'hui) ; `checkout-api.test.ts` repose sur le vrai `getPaymentProvider()` : il change avec les clés FedaPay de l'environnement du développeur (mock → pending, FedaPay → appel réseau). À isoler par `vi.mock("@/lib/payment")` comme dans `qa-api-checkout-reviews`.
- `money.test.ts` / `fmtXof` : dépend des données ICU de Node (`toLocaleString("fr-FR")` donne un espace fine insécable U+202F) : à surveiller si la version de Node change en CI.
- Test existant à corriger quand QA-1 sera corrigé : `checkout-validation.test.ts` « bloque … horodatage futur » et `account-guards.test.ts` « ne bloque pas une horloge … très en avance » verrouillent le comportement actuel.
- `looksLikeBot` : le test existant n'a pas de borne pour `t` flottant ; le schéma l'exige entier (testé).
- Pas de jsdom/Playwright dans le dépôt : toute vérification d'interaction doit passer par la recette ci-dessous ou l'ajout de Playwright (déjà utilisé par Kody pour la revue visuelle).

## 7. Scénarios de recette avec Supabase branché (à jouer sur l'app réelle)

Pré-requis : migrations 0001 (+0002 seed) appliquées, `SUPABASE_SERVICE_ROLE_KEY` posée, auth Supabase : « Confirm email » activé, URL de redirection `https://<site>/api/auth/callback/**` autorisée, SMTP configuré. Jouer chaque scénario en FR et en EN, sur mobile (Chrome Android, réseau 3G throttlé) et ordinateur.

**A. Inscription et e-mail de confirmation**
1. Inscription avec téléphone `+229 01 97 …` (format libre) : réponse « consultez vos e-mails », e-mail reçu dans la bonne langue, lien → `/<lang>/compte` connecté. Vérifier `profiles` : prénom, nom, téléphone normalisé 10 chiffres, `role = client`, `news` selon la case.
2. Même e-mail une 2e fois : réponse identique à la 1re (pas de fuite) ; aucun 2e compte ; vérifier qu'un e-mail d'information (ou rien) part, selon la config Supabase.
3. Lien de confirmation déjà utilisé / expiré / ouvert sur un autre navigateur : redirection `/connexion?error=link` avec message localisé.
4. Connexion avant confirmation : message « e-mail non confirmé » (403), pas un « mot de passe faux ».
5. Connexion par e-mail, par téléphone (3 formats), mot de passe faux, compte inconnu : même message pour les deux derniers. 9 tentatives sur le même identifiant → blocage temporaire, puis déblocage.
6. Deux comptes avec le même téléphone : connexion par téléphone échoue pour les deux (QA-11) : noter le comportement.
7. Mot de passe oublié : e-mail reçu, lien → `/compte?tab=security&recovery=1`, changement sans ancien mot de passe, cookie effacé, ancienne session des autres appareils ? (Raphaël Y5). Réponse identique pour un compte inconnu. 4e demande dans l'heure : silencieusement ignorée.
8. Déconnexion, puis retour arrière du navigateur : plus de données de compte visibles.
9. Mise à jour du profil avec `role: "admin"` injecté dans la requête (outil dev) : colonne inchangée en base ; mise à jour avec `phone` d'un autre compte (QA-11).

**B. Commande paiement à la livraison (COD)**
1. Invité, 1 produit, Cotonou, sous 15 000 F : frais 1 000 F ; total serveur = total affiché. Numéro `WX-…` (suite à partir de 10263), `orders` : `status = nouvelle`, `paid = false`, `user_id` nul, `phone` normalisé, `order_items.unit_price` = prix base, stock décrémenté, `sold` incrémenté. Panier vidé, page merci, rechargement de la page merci (sessionStorage).
2. Franco : sous-total exactement 15 000 F à Cotonou → 0 F ; 14 999 F → 1 000 F ; même montant hors Cotonou → 2 500 F ; modifier `settings.shipping.freeFrom` en base à 0 (désactivé) → plus de franco et vérifier le bandeau du tiroir (QA-6).
3. Connecté : commande rattachée (`user_id`), visible dans « Mes commandes » ; téléphone/adresse préremplis et non écrasés si déjà saisis.
4. Rupture : deux navigateurs, dernier exemplaire dans les deux paniers, commander en parallèle → un seul succès, l'autre 409 localisé ; stock jamais négatif.
5. Produit désactivé par l'admin alors qu'il est au panier → 409 `product_unavailable`. Produit supprimé → idem, sans 500.
6. Quantité : 99 acceptée, 100 refusée côté serveur ; 60 + 60 sur deux lignes du même produit → refus (somme > 99).
7. Prix modifié par l'admin entre l'ajout au panier et la commande : le total de la page merci est le total serveur ; noter si l'écran avertit du changement (Zoé n°4).
8. Double-clic rapide sur « Commander », puis coupure réseau juste après le clic puis nouvel essai : compter les commandes créées (QA-12).
9. Panier avec ids de démo (créé avant branchement de Supabase) : message et possibilité d'en sortir (QA-8).
10. 9 commandes consécutives depuis la même IP (dont des refus de validation) : blocage 429 puis déblocage (QA-4).
11. Téléphone invalide / nom de 2 lettres / adresse de 4 lettres : messages sous les bons champs, sans perte de la saisie.

**C. Commande en ligne (carte / Mobile Money)** — dépend de l'agent paiement
1. Chaque moyen (MTN, Moov, Celtiis, carte) : redirection https vers FedaPay (sandbox), retour sur la page merci avec statut « en attente » puis « payée » après webhook ; `payments` et `orders.paid` cohérents, montant = total serveur.
2. Abandon du paiement : commande en attente `paid = false` ; après `expire_stale_orders(60)` : statut `annulee`, stock restitué une seule fois.
3. Paiement échoué / fournisseur indisponible : message `payment_unavailable` et commande enregistrée annoncée ; pas de seconde commande si le client réessaie.
4. Webhook rejoué (même événement) : idempotent (`duplicate`) ; montant différent : `amount_mismatch` ; commande déjà annulée puis payée : `needs_refund`.
5. Mobile Money avec un numéro de paiement différent du numéro de livraison.
6. En production : sans clé FedaPay, la commande en ligne doit être refusée proprement (le provider mock jette en `NODE_ENV=production` → 502) : vérifier que l'écran dit quoi faire.

**D. Suivi invité**
1. Numéro + téléphone de livraison (3 formats) → statut, lignes, total, date ; aucune autre donnée visible dans la réponse réseau (onglet Network).
2. Numéro + e-mail : ne fonctionne que si la commande a un e-mail (aujourd'hui le formulaire de commande n'en collecte pas).
3. Numéro inexistant et numéro existant avec mauvais contact : écrans, codes HTTP, corps et temps de réponse indiscernables.
4. Numéros voisins (`WX-10264`, `WX-10265`…) avec un mauvais téléphone : limite par numéro (8) et par IP (15) puis déblocage.
5. Changer le statut en admin (preparation → livraison → livree, puis annulee) : le suivi et « Mes commandes » reflètent l'état ; statut inconnu en base = « nouvelle ».

**E. Avis**
1. Invité : clic « donner mon avis » → invitation à se connecter, puis retour au formulaire ouvert.
2. Connecté : avis valide → apparaît dans la fiche, `reviews` : `verified = false`, `seed = false`, `hidden = false`, auteur = « Prénom N. » du profil (jamais le champ envoyé). La note moyenne de la fiche et du catalogue se met à jour après le délai ISR (2 min).
3. Second avis sur le même produit : message `already_reviewed` ; deux envois simultanés (deux onglets) : compter les lignes (QA-9). Après rechargement, le drapeau « déjà noté » vient de localStorage : sur un autre appareil, le bouton réapparaît mais le serveur refuse.
4. Produit supprimé pendant la rédaction : erreur propre.
5. Avis masqué par l'admin (`hidden = true`) : disparaît de la fiche et de la moyenne.
6. Texte de 14 / 15 / 1500 / 1501 caractères ; emojis et caractères Unicode (accents, ɔ, ɛ) bien stockés et affichés.

**F. Compte, favoris, contact, newsletter, divers**
1. Favoris : ajout invité, rechargement, produit retiré du catalogue (id fantôme), connexion (pas de perte), `/favoris` en panne d'API.
2. Contact : message valide → ligne dans `messages` (sujet en français, numéro de commande normalisé) visible dans l'admin ; 6e envoi en 10 min bloqué.
3. Newsletter : e-mail, WhatsApp (formats), doublon (même réponse que l'inscription neuve), valeur stockée normalisée ; case « newsletter » du compte alignée avec `newsletter_subs`.
4. Pages légales : marqueurs « à compléter » visibles (pas d'entité inventée), franco/frais cohérents avec `settings` après modification en base.
5. Bascule FR/EN à chaque étape du tunnel : panier conservé, messages d'erreur API dans la langue de la page.
6. Horloge du téléphone avancée de 5 minutes (réglages Android) : commande, avis, contact, suivi, newsletter doivent fonctionner (aujourd'hui NON : QA-1/1b/1c). À rejouer après correction.
7. Page produit d'un produit à stock 0 / 5 / 6 : libellés, bouton désactivé, barre collante mobile.
8. Sécurité observable : `GET /api/me` sans session = `{ user: null }` ; `GET /api/me/orders` sans session = 401 ; en-tête `Cache-Control: no-store` sur les réponses de session.
9. RLS réelle (clé anon depuis la console navigateur) : lire `orders`, `profiles`, `messages`, `newsletter_subs` d'un autre utilisateur → vide ou refusé ; insérer dans `reviews`/`orders` → refusé ; appeler `rpc('place_order')` avec la clé anon → refusé.

## 8. Plan de non-régression

À chaque correction, dans le même commit :
1. QA-1/1b/1c : retirer `.fails` des trois tests ; corriger `looksLikeBot`, `checkBot`, `isTooFast` ; adapter les deux tests existants cités au §6 ; ajouter un test « horloge en retard de 1 h ». (Mieux : horodatage émis par le serveur, signé, au lieu de l'heure du téléphone.)
2. QA-2 : tester `createAdminClient()` avant la validation d'ids ; retirer `.fails` ; conserver « (contrôle) panier valide sans Supabase → 503 ».
3. QA-8 : filtrer les ids non-UUID dans `read()` du panier (ou à l'ouverture de `/commande`) ; retirer `.fails`.
4. QA-9 / QA-11 / QA-12 : nouvelle migration `0003` (index uniques, clé d'idempotence) ; retirer `.fails` des 3 tests de `qa-schema-static` ; traiter l'erreur 23505 → `already_reviewed` dans la route ; ajouter le test de route correspondant.
5. QA-10 : clé du verrou = identifiant normalisé (e-mail minuscule ou `normPhone`) ; retirer `.fails`.
6. QA-3 : une seule implémentation de `normPhone` (`lib/checkout/phone.ts` ré-exportée par auth et newsletter) ; retirer `.fails`.
7. QA-4 / QA-5 : décider la politique de limitation du checkout ; adapter le test de caractérisation (il devra changer) ; ajouter le nom de l'article en rupture dans la réponse 409 et un test.
8. Règle d'équipe : toute nouvelle route API doit venir avec un test dans le style de `qa-api-account` (hors Supabase : anonyme → 401/503, entrée hostile → 4xx, jamais de détail interne) ; toute nouvelle migration passe `qa-schema-static` (RLS activée, fonctions SECURITY DEFINER révoquées).
9. Avant chaque livraison de jalon : `npx vitest run` (zéro échec hors `it.fails`), `npx tsc --noEmit`, puis la recette §7 sections B, D et E sur preview + base de test, puis un passage Playwright mobile (375 px) sur commande → merci → suivi.
10. Gate J2/J3 (paiement) : ajouter des tests de webhook (signature invalide, rejeu, montant différent) dans le style de ces fichiers ; ils n'existent pas encore côté J1.

## 9. Fichiers produits

- `tests/qa-checkout-limits.test.ts` (logique pure : franco, quantités, téléphones, schéma, anti-robot, rate-limit, codes d'erreur)
- `tests/qa-cart-favorites-store.test.ts` (panier et favoris)
- `tests/qa-api-checkout-reviews.test.ts` (checkout, avis)
- `tests/qa-api-account.test.ts` (contact, inscription, connexion, oubli, callback, profil, mot de passe, suivi, catalogue, newsletter)
- `tests/qa-schema-static.test.ts` (SQL statique)
