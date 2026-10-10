# Zoé — Red-team solo, jalon J1 (Waxo)

Date : 2026-10-09 · Mode : solo (froid) · Stack : Next.js 16 App Router, Supabase (RLS + fonctions SQL), Vercel, next-intl, zod v4.
Périmètre : boutique, panier localStorage, `/api/checkout`, `/api/reviews`, `/api/newsletter`, `/api/contact`, `/api/orders/track`, `/api/auth/*`, `/api/me/*`, `/api/products`, `/api/checkout/config`, `supabase/migrations/0001_core.sql`.
Hors périmètre (volontairement ignoré) : admin, assistant, e-mails, tracking, webhooks, cron.
Méthode : lecture de code uniquement (pas de build, pas d'exécution). Chaque finding cite `fichier:ligne`. Les points non reproduits sont marqués « supposé ».

Verdict adversarial : ❌ casse sous attaque (3 🔴), corrigeable en quelques heures. Le cœur monétaire (prix, stock atomique, anti-rôle, révocation EXECUTE) tient très bien, voir « Ce qui a tenu » en fin de rapport.

---

## 🔴 CRITIQUES

### 🔴 1. Une seule requête anonyme « COD » réserve tout le stock de la boutique (et il ne se libère jamais seul)

- Preuve :
  - `supabase/migrations/0001_core.sql:385-418` : `place_order` décrémente le stock pour chaque ligne, aucun plafond d'unités par commande, par client, par téléphone ou par IP.
  - `0001_core.sql:477-479` : `expire_stale_orders` ne libère que `pay <> 'cod'` : `where status = 'nouvelle' and paid = false and pay <> 'cod'`. Une commande COD réserve donc le stock indéfiniment.
  - `src/lib/checkout/schema.ts:13-20` : jusqu'à 50 lignes × 99 unités par requête.
  - `src/lib/checkout/schema.ts:67-72` : le « bot-guard » ne vérifie que `website` vide et `t` (timestamp fourni par le client).
  - `src/lib/checkout/phone.ts:13` : `0100000000` est un téléphone « valide ».
  - `src/app/api/checkout/route.ts:127-129` : COD = « confirmée directement », sans vérification (le champ `cod_verified` existe mais rien ne l'exige).
- Scénario pas à pas :
  1. L'attaquant ouvre une page produit (statique) et récupère les `id` UUID passés à `ProductBuy` (ou lit `/api/checkout/config`).
  2. Il envoie un `POST /api/checkout` avec `items` = les 24 produits à `qty` = leur stock (stock démo 5-12), `pay:"cod"`, `phone:"0100000000"`, `name:"Aaa Bbb"`, `address:"xxxxx"`, `website:""`, `t: Date.now()-5000`.
  3. `place_order` passe, tout le catalogue passe à stock 0. Le site affiche « Épuisé » partout. Les vrais clients reçoivent `out_of_stock` (409).
  4. Rien ne l'annule : l'admin doit le voir et annuler à la main. L'attaquant recommence dès que le stock est remis (8 requêtes/10 min/IP, mais une suffit).
  - Effet de bord : `sold += qty` fausse le tri « Plus vendus ».
- Impact : déni de vente total, gratuit, anonyme, indétectable avant que quelqu'un regarde l'admin. C'est aussi ce que fera un concurrent ou un client facétieux sans le vouloir.
- Pourquoi non vu : sécurité (prix OK), SQL (atomicité OK), métier (COD OK) ; personne ne possède « combien de stock un inconnu non payé peut-il bloquer ».
- Correctif :
  - Plafonner dans `place_order` : unités totales par commande (ex. ≤ 10), et commandes COD ouvertes non confirmées par téléphone/IP (ex. ≤ 2).
  - Étendre `expire_stale_orders` aux COD `cod_verified = false` après N heures (ex. 24 h), avec appel de confirmation/WhatsApp avant « préparation ».
  - Ne pas décrémenter `sold` à la création mais à la livraison.
  - Remplacer `t` client par un jeton signé serveur (voir 🔴 2).

### 🔴 2. Les clients dont l'horloge du téléphone avance de plus d'une seconde ne peuvent JAMAIS commander ni noter

- Preuve : `src/lib/checkout/schema.ts:70` : `if (input.t > now + 1000) return true;` → `looksLikeBot` renvoie vrai → `src/app/api/checkout/route.ts:63-70` répond `invalid_request` 400 sans `fields`. Même logique dans `/api/reviews` (`route.ts:47-54`).
  - `t` = `Date.now()` du téléphone (`CheckoutFlow.tsx:102` `shownAt.current = Date.now()`, envoyé ligne 163).
  - Incohérent avec les autres gardes du même projet : `src/lib/auth/bot-guard.ts:18` tolère 10 min d'avance ; `newsletter-schema.ts:44` tolère 5 s.
- Scénario : un client Android avec l'heure réglée à la main, ou un téléphone sans réseau récent (dérive), a une horloge +3 s, +2 min ou +1 h. Il remplit le formulaire, clique « Confirmer » : message générique « Certaines informations sont invalides. Vérifiez le formulaire », aucun champ marqué (`fields` absent) → il corrige en vain, abandonne. Aucune trace côté serveur (400 « normal »).
- Impact : perte de ventes silencieuse sur le marché cible (appareils modestes, heure souvent fausse). Pour les avis : mêmes clients exclus.
- Correctif : tolérance d'avance identique à `bot-guard` (≥ 10 min) ou, mieux, jeton `t` émis et signé par le serveur (HMAC de `Date.now()` renvoyé par `/api/checkout/config`), comparé à l'horloge serveur uniquement. Message d'erreur dédié (`too_fast`) pour que le front puisse réessayer automatiquement après 3 s.

### 🔴 3. Commandes en double : aucune idempotence, et le cas réseau 3G est le plus probable

- Preuve :
  - `src/components/checkout/CheckoutFlow.tsx:152-165` : `fetch` sans timeout ni `AbortController`, sans clé d'idempotence.
  - `CheckoutFlow.tsx:212-214` : `catch { setSubmitError(t("errNetwork")); setPaying(false); }` — réactive le bouton alors que la commande peut déjà exister côté serveur ; le panier n'est vidé que sur succès (`:188`).
  - `src/app/api/checkout/route.ts:103-115` : chaque appel crée une commande + réserve le stock.
  - `route.ts:145-148` : en cas d'échec du paiement en ligne (`payment_unavailable`) la commande est créée ; si le client réessaie, deuxième commande + double réservation.
- Scénario : sur 3G, le client clique « Confirmer ». Le serveur répond (commande WX-10270 créée), la réponse se perd (tunnel, coupure) → message « erreur réseau », bouton actif, panier encore plein. Il reclique : WX-10271 créée. Même effet avec rechargement de page, bouton « retour », ou deux onglets. Pour COD : deux livraisons planifiées, stock réservé en double, coursier envoyé deux fois, client mécontent ; pour MoMo : deux demandes de débit.
- Impact : doublons de commandes (coût logistique), stock fantôme, litiges. Le double-clic 100 ms est correctement bloqué par `paying` (le clic suivant lit l'état re-rendu), mais pas le retry après coupure.
- Correctif : générer une clé `idempotency_key` (UUID) au chargement du checkout, stockée en `sessionStorage`, envoyée à l'API ; `place_order` la reçoit (colonne `orders.idem_key unique`) et renvoie la commande existante au second appel. Ajouter un timeout (20-30 s) avec message « vérifiez dans Suivi avant de réessayer ».

---

## 🟠 IMPORTANTES

### 🟠 4. Prix affiché périmé, commande passée au nouveau prix sans confirmation ; franco affiché à tort

- Preuve : `src/lib/cart/store.ts:16,76` : le prix est un instantané figé dans localStorage, jamais rafraîchi (seul le stock l'est, via `CartDrawer.tsx:75-81`). `CheckoutFlow.tsx:81,412` : le bouton affiche `Confirmer la commande — {total}` calculé sur ce prix. `route.ts:125` / `0001_core.sql:393`: le serveur applique le prix actuel et ne renvoie le total qu'APRÈS création.
- Scénario : un client ajoute une lampe à 8 900 F, revient 3 jours plus tard (le panier n'a pas de TTL), le prix est passé à 9 900 F ou la remise a disparu. Le bouton dit 8 900 F ; la commande est créée à 9 900 F ; le livreur demande 9 900 F à la porte. Idem pour le franco : subtotal local 15 100 F → « Livraison offerte », serveur recalcule à 14 800 F → frais 1 000 F.
- Impact : litige COD à la livraison (refus de payer la différence), problème de conformité (prix affiché ≠ prix facturé).
- Correctif : au passage à l'étape paiement, appeler une route « devis » (ou rejouer `place_order` en dry-run) et comparer ; ou envoyer `expectedTotal` et faire échouer `place_order` avec `price_changed` + renvoyer les vrais montants pour reconfirmation. Rafraîchir `price` du panier depuis `/api/checkout/config`.

### 🟠 5. Repli « démo » en production : produits fantômes, ids non-UUID, 404 mis en cache

- Preuve :
  - `src/lib/catalog/index.ts:181` : `(await fetchDbProducts(locale)) ?? demo.products...` ; `fetchDbProducts` renvoie `null` sur timeout 4 s, erreur ou liste vide (`:149`, `:175-177`).
  - `src/lib/demo/catalog.json` : ids `"lampe"`, `"ventilo"` (pas des UUID) ; `schema.ts:7,15` exige un UUID → `cart_invalid`.
  - `src/app/[lang]/(shop)/produit/[slug]/page.tsx:25,73` : `revalidate = 120` + `if (!product) notFound()`.
  - `src/lib/cart/store.ts:21,28-38` : panier persistant sans date d'expiration ni validation de forme des ids.
- Scénario A (go-live) : les visiteurs ou testeurs avec un panier J1 (ids démo « lampe ») se retrouvent, une fois Supabase branché, avec un panier que le checkout refuse systématiquement (`cart_invalid`, message « un article invalide », sans dire lequel). Le panier ne s'auto-nettoie pas.
- Scénario B (panne Supabase > 4 s pendant une régénération ISR, supposé, comportement de cache Next 16 non vérifié) : la page régénérée sert le catalogue démo pendant ≤ 120 s ; une fiche réelle devient 404 ; les produits démo ajoutés au panier ont des ids invalides.
- Scénario C : un seul article désactivé/épuisé dans le panier bloque TOUTE la commande (`product_unavailable` / `out_of_stock` sans id fautif, `errors.ts:36-37`).
- Impact : ventes bloquées sans diagnostic pour le client.
- Correctif : (1) repli démo uniquement si `NODE_ENV !== "production"` ; en prod, erreur propre ou dernière donnée connue. (2) Purger au chargement les lignes dont l'id n'est pas un UUID, ajouter `v` + date au panier (TTL 7-14 j). (3) `place_order` / l'API doivent renvoyer la liste des `ids` fautifs, et le front retirer ou corriger ces lignes automatiquement.

### 🟠 6. Zone de livraison auto-déclarée : tarif et franco contournables

- Preuve : `src/lib/checkout/schema.ts:33` (`zone` choisi par le client), `0001_core.sql:371,422-424` (le tarif dépend uniquement de `p_zone`), aucune vérification contre `address`.
- Scénario : un client de Parakou choisit « Cotonou & Calavi », saisit son adresse réelle. Il paie 1 000 F au lieu de 2 500 F, et profite du franco ≥ 15 000 F. Le coursier ou l'admin s'en aperçoit à la livraison (COD : la différence est perdue, ou le client refuse).
- Impact : marge érodée à chaque commande concernée ; avec COD la correction se fait au pas de la porte.
- Correctif : liste fermée de villes/quartiers (select) mappée à une zone côté serveur, ou validation manuelle admin + recalcul des frais avant « préparation » ; au minimum afficher la mention « la livraison hors Cotonou sera refacturée » dans le message de confirmation et le champ `address`.

### 🟠 7. Cookie de récupération `wx_recovery` forgeable : changement de mot de passe sans l'ancien

- Preuve : `src/app/api/auth/callback/[lang]/[kind]/route.ts:31` (valeur = id utilisateur, non secret), `src/app/api/me/password/route.ts:29-30` : `viaRecovery = recovery === true && store.get(RECOVERY_COOKIE)?.value === ctx.userId`.
- Scénario : quelqu'un qui obtient une session ouverte (ordinateur partagé de cybercafé non déconnecté, session volée) : `GET /api/me` donne `user.id` ; il pose à la main dans DevTools le cookie `wx_recovery=<id>; path=/api` puis `POST /api/me/password {"next":"NouveauMdp123","recovery":true}` : l'ancien mot de passe n'est jamais demandé. Prise de contrôle durable du compte.
- Impact : l'exigence du mot de passe actuel est contournée ; une session temporaire devient un vol de compte permanent.
- Correctif : valeur du cookie = jeton aléatoire stocké côté serveur (table ou signature HMAC liant `userId` + horodatage + secret), invalide après usage ; `Max-Age` 15 min conservé.

### 🟠 8. Avis : publication immédiate, sans achat requis, comptés dans la note, usurpation possible

- Preuve :
  - `src/app/api/reviews/route.ts:93-104` : insertion `hidden:false` ; aucun contrôle d'achat (`orders`/`order_items`).
  - `src/lib/catalog/index.ts:146` : toutes les notes `seed=false, hidden=false` alimentent la moyenne ; `:153` les marque `verified: true` (variable interne seulement, mais la note est comptée comme vérifiée).
  - `reviews/route.ts:79-82` : l'auteur vient du profil, or `profiles.first_name` est modifiable directement via PostgREST avec la clé anon (`0001_core.sql:61` autorise `update (first_name, …)`, sans CHECK de longueur ni de contenu).
  - `reviews/route.ts:84-97` : vérification « déjà noté » puis insertion non atomique, et aucune contrainte `unique (product_id, user_id)` dans `0001_core.sql:192-204`.
  - `catalog/index.ts:146` : lecture de tous les avis sans limite → plafond PostgREST de 1 000 lignes, moyennes silencieusement fausses au-delà.
- Scénarios :
  1. Un concurrent crée des comptes (e-mails jetables, 6 inscriptions/10 min/IP, et rotation d'IP) et publie des notes 1★ avec du texte injurieux ou diffamatoire sur les produits phares : visible dans les 2 min (ISR) et pèse sur la moyenne.
  2. Même chose en 5★ pour gonfler ses propres produits ; ou un utilisateur règle `first_name = "Équipe Wá xɔ"` : l'avis apparaît signé par la marque.
  3. Deux requêtes parallèles du même compte passent le contrôle puis insèrent deux avis.
- Impact : confiance (le levier n°1 pour du e-commerce à froid) et risque juridique (propos publiés sans modération préalable).
- Correctif : `hidden=true` par défaut tant qu'un admin n'a pas validé, ou exiger une commande livrée du produit (`verified=true` automatique) ; `unique (product_id, user_id)` ; ne compter dans la note que les avis `verified` ou modérés ; bloquer ou normaliser `first_name`/`last_name` (CHECK longueur + interdire les mots réservés) ; agréger les notes en SQL (vue/RPC) plutôt que de tout rapatrier.

### 🟠 9. Amplification de charge DB non authentifiée via `/api/checkout/config` et `/api/products`

- Preuve : `src/app/api/checkout/config/route.ts:11,16-22,25` (accepte jusqu'à 50 ids libres `[A-Za-z0-9_-]{1,64}` ; chaque combinaison est une clé de cache CDN différente, `:35`) ; `src/app/api/products/route.ts:4,14-18,23` idem. Chaque appel relit TOUT le catalogue + TOUS les avis (`catalog/index.ts:134-148`). Aucun rate-limit.
- Scénario : `for i in 1..N: GET /api/checkout/config?ids=x$i` : chaque requête est un cache miss, donc 2 requêtes Supabase (produits + avis). Épuise le quota Supabase gratuit et ralentit tout le site (les mêmes lectures servent aux pages dynamiques). Le tiroir panier déclenche aussi cet appel à chaque changement du panier (`CartDrawer.tsx:73-88`), ce qui est lourd sur 3G.
- Impact : coûts et lenteur ; combiné à 🟠 5, un pic de lenteur Supabase fait basculer le site en repli démo.
- Correctif : ne pas inclure `ids` dans la clé de cache (renvoyer le stock de TOUS les produits, petit), mettre le catalogue en `unstable_cache`/`revalidate` 30-60 s, rate-limiter ces deux routes, normaliser/valider les ids en UUID.

### 🟠 10. Suivi invité : numéros séquentiels + téléphone seul = lecture des commandes d'un tiers

- Preuve : `0001_core.sql:138` (séquence à partir de 10263, `ORDER_NUMBER_RE` = `^WX-\d{3,8}$`, `src/lib/auth/validation.ts:29`) ; `src/lib/auth/track.ts:26-27` (le téléphone suffit) ; `src/app/api/orders/track/route.ts:9-10,28` (limites 15/IP et 8/numéro, en mémoire, par instance Vercel).
- Scénario : l'attaquant connaît le téléphone d'une personne (collègue, ex, voisin — les numéros circulent sur WhatsApp). Il boucle sur `WX-10263 … WX-<dernier>` (≈ quelques milliers au démarrage) avec ce téléphone ; à 15/IP/10 min et plusieurs IP/instances, quelques heures suffisent. Dès qu'un numéro correspond, il lit articles, total, statut, date. Il peut aussi estimer le volume de ventes en passant une commande (« WX-10xxx »).
- Impact : fuite de données personnelles d'achat (produits sensibles). Pas d'adresse ni de téléphone renvoyés, ce qui limite la gravité.
- Variante déni de service ciblé : `numberLimiter.hit(number)` (ligne 28) est consommé AVANT de vérifier le contact : 8 requêtes avec un faux téléphone sur `WX-10270` verrouillent le suivi légitime de ce numéro pendant 10 min (par instance).
- Correctif : ajouter un secret non devinable au numéro public (suffixe aléatoire `WX-10270-K7QF` ou jeton envoyé par SMS/WhatsApp/e-mail) ; compter la limite par couple (IP, numéro) plutôt que par numéro seul ; limiteur partagé (Upstash/Redis ou table Supabase) quand le trafic le justifie.

### 🟠 11. Verrouillage de compte par un tiers et « squat » de téléphone

- Preuve :
  - `src/app/api/auth/login/route.ts:25` : `idLimiter.hit(id.toLowerCase())` max 8/10 min par identifiant, compté avant toute vérification du mot de passe.
  - `src/app/api/auth/forgot/route.ts:26` : `if (!idLimiter.hit(...)) return json({ ok: true })` — 3/h par identifiant, silencieux.
  - `src/lib/auth/identify.ts:15-16` : la connexion par téléphone exige un profil UNIQUE (`data.length !== 1`) ; or le téléphone n'est vérifié nulle part (`signupSchema`, `profileSchema`, trigger `0001_core.sql:28-34`) et n'est pas unique en base.
- Scénarios :
  1. Un attaquant envoie 8 tentatives avec l'e-mail de la victime toutes les 10 min : la victime ne peut plus se connecter (sur l'instance concernée). Même chose avec 3 demandes « mot de passe oublié »/h : elle ne reçoit plus jamais de lien, sans message d'erreur (silencieux).
  2. Un attaquant s'inscrit (ou modifie son profil) avec le téléphone de la victime : `resolveEmail(tel)` voit 2 profils et renvoie `null` → la victime ne peut plus se connecter ni réinitialiser par téléphone (ses commandes restent accessibles par e-mail). Supposé : effet limité par l'instance serverless pour le point 1.
- Impact : déni d'accès ciblé à des clients, support submergé.
- Correctif : limiter par (IP, identifiant) plutôt que par identifiant seul ; ne pas consommer le quota « forgot » silencieusement (le comptabiliser par IP) ; rendre le téléphone unique et le vérifier (OTP) avant de l'utiliser comme identifiant, sinon retirer la connexion par téléphone.

### 🟠 12. Mode paiement : fournisseur MOCK actif + moyens activés en base + annulation d'une commande payée sans remboursement

- Preuve :
  - `src/lib/payment/index.ts:35-49` : le fournisseur est toujours `MockPaymentProvider` (`{ pending: true }`) ; `0001_core.sql:513` active `momo/moov/celtiis/carte` par défaut (`"pay"`).
  - `route.ts:131-144` répond `payment: { kind: "pending" }` ; le front affiche « paiement en attente » sans instruction de paiement.
  - `0001_core.sql:461-470` : `cancel_order` n'examine pas `paid`. Elle ne crée aucune ligne `needs_refund` ; seul `mark_paid` gère le cas inverse (paiement après annulation, `:450-453`).
- Scénarios :
  1. Si le site est mis en ligne avant J3 : un client choisit MoMo, voit « commande reçue », attend un débit qui ne viendra jamais ; la commande est annulée silencieusement à 60 min (`expire_stale_orders`).
  2. Un admin annule une commande déjà payée : stock restitué, `orders.paid` reste `true`, aucune trace de remboursement à faire → argent client conservé par erreur, ou litige.
- Impact : confiance et obligation de remboursement.
- Correctif : tant que FedaPay n'est pas branché, `pay` = `{ cod: true, autres: false }` dans `settings` (ne pas fermer le front sur ce seul réglage) ; dans `cancel_order`, si `paid` alors insérer `payments(status='needs_refund')` et exiger un indicateur explicite.

### 🟠 13. Newsletter : inscription d'un tiers sans double opt-in, consentement forgé

- Preuve : `src/app/api/newsletter/route.ts:56-58` insère `consent: true` pour n'importe quelle valeur sans confirmation ; `src/app/api/auth/signup/route.ts:58` et `me/profile/route.ts:41` font de même pour les comptes ; `newsletter-schema.ts:44` accepte `t` forgé.
- Scénario : un script inscrit les e-mails ou numéros WhatsApp de n'importe qui (limite 8/IP/10 min, en mémoire, contournable). Quand la marque enverra sa première campagne : plaintes spam, réputation d'expéditeur détruite, base RGPD non conforme (consentement non prouvé). Le message « succès silencieux » en cas de doublon est bon, mais n'atténue rien.
- Correctif : double opt-in (e-mail de confirmation / message WhatsApp avec lien), `consent=false` jusqu'à confirmation, stocker `consented_at`, `ip`/preuve.

### 🟠 14. FR/EN : les slugs diffèrent par langue → 404 au changement de langue et dans le panier

- Preuve : `src/components/shop/LangSwitch.tsx:20-26` : `href={pathname}` avec `locale={l}` : le slug est conservé tel quel ; `catalog/index.ts:188-190` cherche le slug dans la langue demandée ; `product/[slug]/page.tsx:73` → `notFound()`. `CartDrawer.tsx:184-189` : `href=/produit/${l.slug}` avec le slug de la langue d'ajout. DB : `unique (locale, slug)` et slugs EN distincts (`0001_core.sql:98-102`).
- Scénario : un client ouvre `/fr/produit/lampe-led-rechargeable`, passe en EN : `/en/produit/lampe-led-rechargeable` → 404 si le slug EN est `rechargeable-led-lamp`. De même, un panier alimenté en FR puis consulté en EN mène à des liens 404. Invisible aujourd'hui (le catalogue démo n'a pas d'EN) mais attendu dès les premières traductions.
- Correctif : page de repli qui retrouve le produit par n'importe quel slug (toutes langues) puis redirige vers le slug de la langue courante ; ou stocker l'`id` dans le lien (`/produit/<slug>?p=<id>`) ; mettre le sélecteur de langue en `hreflang` alternates avec les slugs réels.

---

## 🟡 MINEURES / DURCISSEMENT

15. 🟡 **Deadlock possible malgré le commentaire « pas de deadlock »** : `0001_core.sql:384` trie les lignes (`kind`,`id`), mais les packs verrouillent ensuite les produits dans l'ordre des `pack_items` (`:407`). Commande A : produit P9 puis pack contenant P1 ; commande B : produit P1 puis pack contenant P9 → blocage mutuel, Postgres abandonne l'une (40P01) → `mapPlaceOrderError` renvoie `server_error` (500 générique). Rare, nouvelle tentative suffit. Même risque entre `_restock_order` et `place_order`. Correctif : verrouiller tous les produits impliqués (packs dépliés) dans l'ordre d'id avant de décrémenter ; mapper 40P01/40001 → retry côté API.
16. 🟡 **Pack vide ou à prix 0 commandable** : `0001_core.sql:407` n'échoue pas si `pack_items` est vide (pas de stock consommé), `packs.price >= 0` autorise 0 (`:107`). Une erreur d'admin crée des packs gratuits/sans stock ; ajouter un contrôle `pack_unavailable` si 0 ligne ou prix = 0.
17. 🟡 **Réglages `settings` non validés** : `0001_core.sql:420-424` caste `(v_ship ->> 'freeFrom')::int` ; une valeur `"15000.5"` ou `"gratuit"` saisie plus tard dans l'admin fait échouer TOUTES les commandes (22P02 → 500 générique). Ajouter une validation à l'écriture (CHECK jsonb ou Zod admin) et un `exception when others` explicite.
18. 🟡 **Contenus saisis par des tiers stockés bruts, à échapper en aval** : `orders.name/address/note`, `messages.body/name`, `reviews.author/body`, `profiles.*` ne subissent aucune restriction de caractères (`schema.ts:22-31`, `validation.ts:39,95-112`) ; `profiles` est même modifiable directement via PostgREST sans CHECK de longueur (`0001_core.sql:7-16,61`). React échappe tout dans le site public (aucun `dangerouslySetInnerHTML` trouvé dans le périmètre), mais : e-mails HTML, export CSV/Excel (formules `=HYPERLINK(...)`, `+cmd`), gabarits WhatsApp, impression/PDF, et l'admin à venir doivent échapper/neutraliser. Charge de test : `name = "<img src=x onerror=alert(1)>"`, `address = "=HYPERLINK(\"http://x\",\"clic\")"`. Ajouter CHECK de longueur sur `profiles`, retirer les caractères de contrôle/retours à la ligne des noms.
19. 🟡 **Trois copies divergentes de `normPhone`** : `src/lib/checkout/phone.ts:7-11` (n'enlève pas `00229`), `src/lib/auth/validation.ts:13-18` (enlève `00229`), `newsletter-schema.ts:13-17`. Un client qui saisit `00229 01 97...` est refusé au checkout mais accepté au suivi ; un numéro enregistré dans une forme peut ne pas retrouver l'autre. Centraliser. Les numéros hors Bénin (`+33…` diaspora) sont refusés : à assumer ou à ouvrir.
20. 🟡 **Gardes anti-bot trop faibles / incohérentes** : le « délai » et le « honeypot » sont satisfaits par un script (`t = Date.now()-3000`, `website:""`). Les trois implémentations diffèrent (`schema.ts:67-72`, `bot-guard.ts:12-20`, `newsletter-schema.ts:42-46`). Limites de débit en mémoire par instance Vercel : contournables par simple parallélisme (`rate-limit.ts:4`). Utiliser un limiteur partagé et un jeton serveur.
21. 🟡 **Limiteur : purge O(n) à chaque requête et seau `unknown`** : `src/lib/checkout/rate-limit.ts:16-21` parcourt toute la map à CHAQUE appel quand elle dépasse 5 000 clés ; `clientIp` renvoie `"unknown"` si `x-forwarded-for` manque → tous les clients partagent 8 commandes/10 min. Sur Vercel l'en-tête est posé par la plateforme (risque faible), mais hors Vercel (preview locale, VPS) un en-tête `X-Forwarded-For` aléatoire par requête contourne la limite et fait grossir la mémoire. En Afrique de l'Ouest les opérateurs mutualisent les IP (CGNAT) : 8 commandes/10 min pour un quartier entier n'est pas impossible.
22. 🟡 **Heure limite de livraison calculée avec l'horloge du client** : `src/components/checkout/OrderConfirmation.tsx` utilise `new Date(order.placedAt).getHours()` (appareil) face à `cutoff` 18 h ; un client à l'étranger ou avec une heure fausse voit « livraison demain » / « 48 h » incorrect. Calculer côté serveur, fuseau Africa/Porto-Novo.
23. 🟡 **E-mail jamais collecté au checkout** : `CheckoutFlow.tsx:157` n'envoie ni `email` ni consentement ; le suivi invité par e-mail (`track.ts:24-25`) ne trouvera jamais de correspondance et le futur e-mail de confirmation n'aura pas de destinataire. À décider (champ optionnel).
24. 🟡 **Quantités extrêmes dans localStorage non normalisées** : `cart/store.ts:33` accepte `qty` entier quelconque (ex. 1e9) ; l'API rejette > 99 (`cart_invalid`) mais l'UI affiche des totaux absurdes et le bouton « Commander » échoue sans explication. Clamp à la lecture (1…99, ≤ stock).
25. 🟡 **`reviews_read` expose `user_id`** (select * public, `0001_core.sql:297`) et `profiles_update_own` permet d'écrire `phone` sans unicité ; les deux facilitent le recoupement d'identités. Exposer une vue publique sans `user_id`.
26. 🟡 **Pas d'en-têtes de sécurité** : `next.config.ts` ne définit ni CSP, ni `X-Frame-Options`/`frame-ancestors`, ni `Referrer-Policy`, ni `Permissions-Policy` (clickjacking possible sur `/commande` et `/compte`). Voir la fiche CSP Next App Router (`'unsafe-inline'` requis pour RSC).
27. 🟡 **Origine des liens e-mail** : `src/lib/auth/http.ts:30-34` retombe sur `new URL(req.url).origin` si `NEXT_PUBLIC_SITE_URL` est absent. Si la variable manque en production, l'origine des liens de confirmation/réinitialisation dépend de l'en-tête Host reçu. Rendre la variable obligatoire en production (échec au démarrage).
28. 🟡 **Pas d'énumération par signup/login directe, mais un canal temporel possible (supposé, non mesuré)** : pour un identifiant téléphone, `resolveEmail` fait 2 requêtes DB avant de répondre `invalidCredentials`, un identifiant e-mail 0 ; pour un téléphone inconnu la réponse revient après 1 requête. La différence de latence (~100-300 ms) peut révéler quel numéro est inscrit. Faible exploitabilité avec les rate-limits ; à mesurer.

---

## Cas testés qui TIENNENT (surface attaquée sans faille trouvée)

- Prix, frais et totaux : calculés dans `place_order` à partir de la base ; le client ne peut pas forger un montant (`route.ts:103-115`, test `checkout-api.test.ts`).
- Quantités négatives, nulles, énormes, ids non UUID, pack vs produit mélangés : bloqués par Zod (`schema.ts:13-20`) puis par la base (`0001_core.sql:372,390,396,406,415`, CHECK `qty between 1 and 99`).
- Dernier article en concurrence : `select … for update` + `update … where stock >= qty` (`:395-399`) : un seul gagnant, jamais de stock négatif (CHECK `stock >= 0`).
- Franco : règle côté SQL, `>=` exact, Cotonou seulement ; pas de contournement par quantité ni par lignes dupliquées (agrégation `group by` `:386-388`).
- Annulation APRÈS paiement quand `mark_paid` arrive tard : traitée (`order_cancelled` → `needs_refund`, `:450-453`) ; idempotence webhook correcte (`:438-440`).
- Escalade de rôle : trigger `profiles_guard_role`, `revoke update` + `grant update (cols)` (`:43-61`), EXECUTE révoqué sur toutes les fonctions sensibles (`:486-497`). La table `product_costs` et `webhook_events` ne fuient pas.
- Redirection après login : `safeInternalPath` (`validation.ts:135-138`) bloque `//`, `\`, schémas externes ; la callback n'accepte que `fr|en` (`callback/.../route.ts:16`).
- Enumération par e-mail : signup/login/forgot renvoient des réponses identiques (`signup:46`, `login:30,36`, `forgot:38`) ; suivi : « introuvable » identique pour numéro inconnu et contact erroné.
- Sans Supabase : `createAdminClient` jette, toutes les routes répondent 503/`null` proprement (`checkout:83-88`, `contact:23-28`, `newsletter:63-65`, `me:5-10`).
- Hydratation du panier : `getServerSnapshot = EMPTY` (`cart/store.ts:96`) ; `useHydrated` évite le flash « panier vide » (`CheckoutFlow.tsx:36-38`). Double-clic 100 ms : `paying` bloque (le cas réseau est le 🔴 3).
- XSS dans le site public : aucun `dangerouslySetInnerHTML`/`innerHTML` ; `cssImage` échappe via `JSON.stringify` (`media.ts:3`).

## Priorités de correction proposées

1. 🔴 1 (plafonds + expiration COD) · 🔴 2 (tolérance horloge) · 🔴 3 (idempotence) — avant toute mise en ligne.
2. 🟠 4, 5, 12 (prix périmé, repli démo, paiement mock) — avant mise en ligne ; 🟠 7 (cookie recovery) avant ouverture des comptes.
3. 🟠 8, 9, 10, 11, 13, 14 — avant la campagne de lancement.
4. 🟡 par lot au fil de J2-J4.
