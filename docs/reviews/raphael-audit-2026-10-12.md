# Audit sécurité Waxo (Wá xɔ) par Raphaël, 2026-10-12

Méthode : lecture et traçage du code (HEAD local `eba17dd`, non poussé), migrations `0001` à `0018`, `supabase/config.toml`. Aucune attaque contre la prod. Une seule lecture en prod, faite comme n'importe quel visiteur : `GET https://www.waxo.boutique/api/checkout/config` (réglages publics).
Périmètre : tout le code ajouté depuis `d646a8d` (équipe admin, campagnes, avis boutique, livraison express, `/api/auth/confirm`, cron avis, purge, FedaPay depuis l'admin, CSP), plus le suivi des points ouverts des audits J1 (`raphael-securite-J1.md`, `zoe-redteam-J1.md`).
Stack : Next 16 App Router (`src/proxy.ts`), Supabase (RLS + fonctions SECURITY DEFINER), FedaPay, Resend, DeepSeek, Vercel Hobby.

**Bilan : 1 Critique · 0 Élevé · 2 Moyens · 6 Faibles.**

**Décision sécurité : BLOQUANT.** Le Critique C1 doit être réglé avant d'activer le premier vrai produit. La boutique est vide depuis la purge, donc la faille n'a pas encore d'impact. Elle en aura un dès qu'un produit sera actif.

---

## CRITIQUE (en tête : exploitable en prod dès qu'un produit est en vente)

### C1. Paiement « sandbox » accepté en production : n'importe qui peut obtenir une commande « payée » sans débourser un franc

- **Fichiers** :
  - `src/lib/payment/index.ts:28`
  - `src/lib/payment/config.ts:14`
  - `src/lib/payment/settle.ts:39`
  - appelé depuis `src/app/api/webhooks/fedapay/route.ts:62`, `src/app/api/checkout/status/route.ts:62` et `src/app/api/cron/expire-orders/route.ts:88`
  - redirection du client : `src/components/checkout/CheckoutFlow.tsx:249`
- **Confiance** : 8/10.
  - **VERIFIED dans le code** : aucun contrôle du mode.
  - **VERIFIED en prod** : Mobile Money est activé.
  - **Documenté, non relu** (variable Vercel Sensitive) : les clés de prod sont en mode essai.
- **Code en cause** :
  - `if (cfg) return new FedaPayProvider(cfg);` : la config est acceptée telle quelle, y compris quand `env === "sandbox"`.
  - `const env: FedapayEnv = ... input.secretKey.startsWith("sk_live_") ? "live" : "sandbox";` : le mode est connu, mais personne ne le vérifie ensuite.
  - `admin.rpc("mark_paid", { ... })` : la commande passe à `paid = true` sans regarder le mode.
- **Faits établis** :
  - Réponse de prod au 2026-10-12 : `"pay":{"momo":true,"moov":true,"celtiis":true,"carte":false,"cod":true}`.
  - Mémoire projet (`PROJETS/Waxo/Waxo_MEMORY.md`, au 2026-10-11) : « FedaPay sandbox (clés en VARIABLES VERCEL seulement, pas en admin ; webhook OK) … paiement Mobile Money WX-10266 payée par webhook … RESTE : passage clés live ». La chaîne sandbox complète fonctionne donc en prod, de bout en bout.
- **Scénario d'exploit** :
  1. Dès qu'un produit est actif, l'attaquant met un article dans son panier et choisit « MTN MoMo » ou « Moov ».
  2. Il est redirigé vers la page de paiement hébergée par FedaPay en mode **essai**.
  3. Il saisit un des numéros de test que FedaPay publie dans sa documentation. Le paiement est « approuvé » sans aucun argent réel.
  4. FedaPay envoie `transaction.approved`, signé avec le secret de webhook d'essai, que le serveur accepte. Le serveur relit la transaction sur `sandbox-api.fedapay.com`, la trouve approuvée, puis `mark_paid` passe la commande à « payée ».
  5. Le client reçoit l'e-mail « paiement reçu ». La boutique reçoit l'alerte « Nouvelle commande · payée ».
  6. Le livreur apporte le colis sans rien encaisser, puisque la commande est marquée payée.
  - Rien dans `payments.raw` ni dans l'admin n'indique que le paiement était un essai.
  - Effet secondaire : un vrai client qui choisit Mobile Money tombe sur une page d'essai et ne peut pas payer réellement.
- **Impact** : marchandise livrée gratuitement, sans limite autre que le stock et les plafonds de commande (8 commandes / 10 min / IP, 3 commandes ouvertes par téléphone, numéros de téléphone non vérifiés).
- **Correctif** :
  1. **Tout de suite, sans code** : dans `/admin/reglages`, désactiver MoMo / Moov / Celtiis tant que les clés live ne sont pas posées. Ne garder que le paiement à la livraison.
  2. **Code** : en production (`VERCEL_ENV === "production"`), refuser une configuration `env === "sandbox"` à moins d'une variable explicite `ALLOW_SANDBOX_PAYMENTS=1`. Ce refus doit être fait :
     - dans `getPaymentProvider()` (renvoyer `payment_unavailable`) ;
     - **et** dans `settleApprovedTransaction()` (ne jamais appeler `mark_paid` pour une transaction d'essai en production : renvoyer `ignored` et journaliser).
  3. Enregistrer le mode (`env`) dans `payments.raw` et afficher un badge « ESSAI » dans l'admin pour toute commande réglée en sandbox.
  4. Au passage en live, purger ou annuler les commandes de test et vérifier que la clé et le secret de webhook sont tous les deux `live` (le contrôle de cohérence existe déjà en admin, mais pas pour les variables Vercel).
- **Variantes trouvées (grep)** : 3 appels à `settleApprovedTransaction` (webhook, retour de paiement, cron), tous sans garde sur le mode. Un seul point de correction suffit (dans `settle.ts`).

---

## ÉLEVÉ

Aucun.

---

## MOYEN

### M1. Réservation de stock et saturation des e-mails par commandes « paiement à la livraison » fictives (suite de R1 et O2, toujours sans CAPTCHA)

- **Fichiers** :
  - `supabase/migrations/0015_campaigns.sql:124,156` : `c_max_open constant int := 3`, compté **par téléphone**.
  - `supabase/migrations/0008_order_reliability.sql:169` : `p_cod_hours int default 48`.
  - `vercel.json:4` : `"schedule": "0 3 * * *"`, une seule exécution par jour.
  - `src/app/api/checkout/route.ts:102` : 8 commandes / 10 min / IP.
  - `src/app/api/checkout/route.ts:202` : 2 e-mails par commande paiement à la livraison.
- **Confiance** : 7/10. VERIFIED (code). Le plafond Resend dépend du forfait (TENTATIVE).
- **Scénario d'exploit** :
  - Un script envoie `POST /api/checkout` avec `pay: "cod"`, un numéro béninois différent à chaque fois (`01xxxxxxxx` : aucun n'est vérifié), 20 articles par commande et `elapsed: 3000` (le délai anti-robot est déclaratif).
  - Débit par IP : 8 commandes / 10 min, soit **960 unités réservées par heure**.
  - Ces commandes ne sont annulées qu'après 48 h. Comme le cron ne passe qu'à 3 h du matin, le stock reste bloqué jusqu'à environ 72 h. La boutique affiche « épuisé » partout.
  - Chaque commande envoie aussi l'alerte « Nouvelle commande », et une confirmation si un e-mail est saisi.
  - Si le compte Resend est en offre gratuite (100 e-mails / jour), le quota est épuisé en moins d'une heure. Les e-mails de compte Supabase passent par le même SMTP Resend : confirmations d'inscription et réinitialisations de mot de passe tombent aussi en panne.
- **Impact** : déni de vente (stock gelé), boîte de l'équipe noyée, e-mails transactionnels coupés.
- **Correctif** :
  - CAPTCHA (Turnstile) sur `/api/checkout` (O2, toujours ouvert).
  - Expiration des paiements à la livraison non vérifiés plus courte (6 à 12 h).
  - Plafond global d'unités réservées par IP sur 24 h dans `rate_hit`.
  - Alerte « Nouvelle commande » regroupée (1 e-mail récapitulatif / 15 min au-delà de N commandes).
  - Vérifier le forfait Resend et y fixer une alerte de quota.

### M2. Les points ouverts des audits J1 qui restent exploitables

Statut vérifié dans le code actuel :

| Réf. J1 | Statut | Preuve |
|---|---|---|
| R1 vidage du stock | **Partiellement corrigé** : plafonds 10/20/60, expiration COD 48 h, limiteur partagé. Reste M1. | `0008`, `0015` |
| O1 `wx_recovery` forgeable | **Corrigé** : HMAC `id.exp.hmac`, comparaison à temps constant. Voir F3 pour le résidu. | `src/lib/auth/recovery.ts` |
| O2 limite de débit / CAPTCHA | **Limiteur partagé corrigé** (`rate_hit`, `0009`). **CAPTCHA toujours absent** (aucun `captcha` dans `src` ni dans `config.toml`). | `src/lib/ratelimit.ts` |
| O3 téléphone identifiant | **Unicité corrigée** (`profiles_phone_uidx`). **Toujours non vérifié** : désormais réutilisé pour le badge « Client vérifié » (F4). | `0010` |
| Zoé 5 / Y10 repli démo et mock en prod | **Corrigé** : démo seulement sans Supabase ; Mock refuse de tourner en production. | `src/lib/catalog/index.ts:201`, `src/lib/payment/index.ts:16` |
| Y2 / Zoé 26 en-têtes | **Corrigé** : CSP, `frame-ancestors 'none'`, HSTS, nosniff, Referrer-Policy. | `src/lib/seo/security-headers.ts` |
| Zoé 8 / Y4 avis produits | **Ouvert** : publication immédiate (`hidden: false`), aucun achat requis, nom de repli libre. | `src/app/api/reviews/route.ts:104` |
| Zoé 10 suivi invité | **Ouvert** : numéro séquentiel + téléphone seul ; `numberLimiter.hit(number)` est consommé avant la vérification du contact (blocage du suivi d'une commande). | `src/app/api/orders/track/route.ts:28` |
| Zoé 11 / Y6 verrouillage par identifiant | **Ouvert et aggravé** : le limiteur est désormais partagé, donc 8 essais / 10 min avec l'e-mail de la victime la bloquent sur **toutes** les instances. Vaut aussi pour la connexion **admin** (même route). | `src/app/api/auth/login/route.ts:25` |
| Zoé 13 / Y3 newsletter sans double opt-in | **Ouvert** | `src/app/api/newsletter/route.ts:47` |
| Y5 sessions conservées après changement de mot de passe | **Ouvert** (aucun `signOut({ scope: "others" })`) | `src/app/api/me/password/route.ts:39` |

- **Correctif prioritaire dans cette liste** : clé de verrouillage composite `identifiant|IP` sur `/api/auth/login`. Supabase applique de toute façon ses propres limites de débit sur `/auth/v1/token` : le verrou par identifiant seul n'apporte que le risque de blocage d'un tiers.

---

## FAIBLE

### F1. Login CSRF via le lien d'e-mail `/api/auth/confirm` (GET qui ouvre une session sans confirmation)

- **Fichier** : `src/app/api/auth/confirm/route.ts:30,33` (`sb.auth.verifyOtp({ type, token_hash: tokenHash })` puis `finishEmailLink(...)`). Même famille que Y1, toujours ouvert : les POST JSON acceptent `text/plain` cross-site, `src/lib/auth/http.ts:19`.
- **Confiance** : 7/10. VERIFIED.
- **Scénario d'exploit** :
  1. L'attaquant demande « mot de passe oublié » pour **son propre** compte.
  2. Il ne clique pas le lien reçu (`https://www.waxo.boutique/api/auth/confirm?token_hash=…&type=recovery`). Il l'envoie à la victime par WhatsApp (« Confirmez votre commande Wá xɔ »), sur le vrai domaine de la boutique.
  3. La victime clique. Son navigateur reçoit la session de l'attaquant, qui remplace la sienne.
  4. Si elle commande ensuite, la commande est rattachée au compte de l'attaquant. L'attaquant lit alors nom, téléphone, adresse et articles dans « Mes commandes » (`/api/me/orders` renvoie `address`).
- **Impact** : fuite de données personnelles par ingénierie sociale.
- **Correctif** :
  - Page intermédiaire : le GET affiche « Continuer en tant que a•••@gmail.com » et un bouton qui POSTe `token_hash`. Cela évite aussi que les antivirus de messagerie (qui préchargent les liens) consomment le jeton.
  - Refuser `verifyOtp` si une autre session est déjà ouverte.
  - Dans `proxy.ts`, refuser les POST `/api/*` dont `Sec-Fetch-Site` vaut `cross-site`.

### F2. Compte admin compromis : détournement silencieux des paiements, sans alerte ni second facteur

- **Fichier** : `src/app/admin/(panel)/reglages/actions.ts:181` (`saveFedapaySecrets(...)`). Aucun `sendTeamAlert`, alors que les changements d'équipe en déclenchent un (`equipe/actions.ts`, `logEvent`).
- **Confiance** : 6/10. VERIFIED (code). Suppose le vol du mot de passe d'un admin.
- **Scénario d'exploit** : un admin se fait hameçonner (aucun MFA, `src/lib/admin/guard.ts:28` ne vérifie pas `aal2`). L'attaquant colle **sa propre** clé `sk_live_…` et **son** secret `wh_live_…` dans Réglages → Paiement. Tous les paiements Mobile Money suivants arrivent sur son compte FedaPay, et les commandes sont bien marquées « payées » (son webhook est signé avec son secret). Aucun autre admin n'est prévenu.
- **Correctif** :
  - Alerte e-mail à toute l'équipe (même mécanisme que `sendTeamAlert`) à chaque `saveFedapayAction` / `clearFedapayAction`, avec horodatage et adresse de l'auteur.
  - MFA TOTP Supabase obligatoire pour `role = 'admin'` (exiger `aal2` dans `getAdmin`).

### F3. Le contrôle « mot de passe actuel » se contourne en appelant Supabase directement (résidu de O1)

- **Fichiers** : `src/app/api/me/password/route.ts:35,39` ; `supabase/config.toml` (pas de `secure_password_change`). La mémoire projet indique que `config diff` vaut 0 après `config push`, donc la prod suit ce fichier.
- **Confiance** : 6/10. VERIFIED pour le fichier de config. Comportement GoTrue par défaut.
- **Scénario d'exploit** : session laissée ouverte dans un cybercafé. L'attaquant lit le cookie `sb-…-auth-token` (non `httpOnly`, c'est voulu par `@supabase/ssr`) et envoie `PUT https://<ref>.supabase.co/auth/v1/user` (clé anon publique + `Bearer <access_token>`, corps `{"password":"…"}`). Le mot de passe change sans l'ancien : prise de contrôle durable. La vérification serveur du mot de passe actuel n'est pas une frontière de sécurité.
- **Correctif** :
  - `[auth.email] secure_password_change = true` dans `config.toml` puis `config push`. Cela impose une ré-authentification par code au-delà de 24 h de session : protection partielle.
  - `signOut({ scope: "others" })` après changement (Y5).
  - Durée de session plus courte.
  - Au passage : `minimum_password_length = 8` (aligné sur le front) et retirer `http://localhost:3007/...` des `additional_redirect_urls` de prod.

### F4. Badge « Client vérifié » des avis boutique accordé sur un téléphone non vérifié

- **Fichiers** : `src/app/api/site-reviews/route.ts:71` (`delivered.or(\`user_id.eq.${userId},phone.eq.${phone}\`)`) ; `supabase/migrations/0001_core.sql:61` (`grant update (… phone …) to authenticated`). Pas d'injection de filtre PostgREST : `normPhone` ne garde que des chiffres.
- **Confiance** : 7/10. VERIFIED.
- **Scénario d'exploit** : un utilisateur connecté met dans son profil (via `/api/me/profile` ou directement via PostgREST) le numéro d'un client **invité** dont une commande a été livrée. Ce numéro n'appartient à aucun profil, donc l'index unique ne bloque pas. Il obtient alors le droit de déposer un avis boutique marqué `verified: true`.
- **Impact** : limité, l'avis reste « à valider » par l'admin. Le badge ne prouve pourtant rien.
- **Correctif** : n'accorder `verified` que sur `user_id = auth.uid()` tant que le téléphone n'est pas vérifié (OTP). À défaut, afficher à l'admin, pendant la modération, la commande qui a servi de preuve.

### F5. Proxy d'images ouvert sur tous les projets Supabase

- **Fichier** : `next.config.ts:18` (`hostname: "*.supabase.co"`).
- **Confiance** : 6/10. VERIFIED. `next/image` n'est utilisé nulle part dans `src`, mais `/_next/image` reste actif.
- **Scénario d'exploit** : `GET /_next/image?url=https://<projet-de-l-attaquant>.supabase.co/storage/v1/object/public/x/<n>.png&w=640&q=75` en boucle sur des milliers d'images distinctes hébergées chez l'attaquant. Cela consomme le quota d'optimisation d'images Vercel (forfait Hobby) et la bande passante à vos frais.
- **Correctif** : supprimer le bloc `images` (inutilisé), ou le restreindre à `btarkkjimnkmiaxzonzq.supabase.co`.

### F6. Oracle « ce numéro a un compte » et données de relecture exposées

- **Fichiers** :
  - `src/app/api/me/profile/route.ts:33` (`phoneTaken`) : tout utilisateur connecté peut tester si un numéro béninois appartient à un compte, à raison de 20 essais par minute et par compte.
  - `supabase/migrations/0018_site_reviews.sql`, politique `site_reviews_read` : la clé anon lit toutes les colonnes des avis publiés (`user_id`, `origin`, `consent`). Même schéma que `reviews_read` (Y4/Zoé 25).
- **Confiance** : 6/10. VERIFIED.
- **Correctif** :
  - Réponse neutre sur conflit de numéro, plus une vérification OTP.
  - Exposer une vue publique sans `user_id`, ou `revoke select` sur ces colonnes pour `anon` / `authenticated` (privilèges par colonne).

---

## Points conformes (vérifiés dans le code)

- **Fonctions SECURITY DEFINER** : toutes ont `set search_path` figé et un `revoke execute … from public, anon, authenticated` explicite, puis `grant … to service_role`. Liste : `place_order` (0015), `campaign_for`, `replace_campaign_items`, `save_campaign`, `admin_revoke_user_sessions`, `rate_hit`, `cancel_order`, `expire_stale_orders`, `_restock_order`, `mark_paid`, `handle_new_user`, `profiles_keep_one_admin`. Seule `is_admin()` reste appelable, ce qui est voulu (RLS).
- **Escalade de rôle fermée sur les deux voies** :
  - `handle_new_user` pose `'client'` et ne lit jamais le rôle dans les metadata (`0010`).
  - `grant update` limité aux colonnes non sensibles, plus le trigger `profiles_guard_role`.
  - Le rôle lu côté app vient de la table (`src/lib/admin/guard.ts:28`).
- **Équipe admin** :
  - chaque action passe par `assertAdmin()` ;
  - un compte existant est verrouillé avant d'être promu : mot de passe aléatoire, sessions coupées, lien de réinitialisation ;
  - l'invitation est supprimée si l'attribution du rôle échoue ;
  - un trigger garantit qu'il reste au moins un admin, avec un verrou consultatif ;
  - un historique est tenu et une alerte e-mail part.
- **Toutes les server actions et routes admin** (13 fichiers `"use server"`, `api/admin/*`, 4 exports CSV) commencent par `assertAdmin()` / `requireAdmin()`. Les CSV sont protégés contre l'injection de formule.
- **RLS des nouvelles tables** : activée sur `campaigns`, `campaign_items` (prix invisibles avant le début), `site_reviews` (publiés seulement), `admin_role_events` et `order_item_components` (`revoke all`), `rate_limits`. Aucune politique d'écriture : seul `service_role` écrit.
- **Campagnes** : le prix est recalculé en base (`campaign_for` dans `place_order`) et appliqué seulement s'il est inférieur au prix normal. Le client n'envoie jamais de montant. `price_changed` est renvoyé si un prix a augmenté.
- **Webhook FedaPay** :
  - corps brut ;
  - HMAC-SHA256 `t.body` comparé à temps constant, fenêtre de 5 min ;
  - 401 si la signature est invalide ;
  - transaction relue chez FedaPay avant tout règlement ;
  - idempotence `webhook_events` ;
  - montant comparé à `orders.total` ;
  - commande annulée → `needs_refund` ;
  - XOF imposé.
- **Retour de paiement** : jeton HMAC sur 128 bits obligatoire (les numéros de commande sont séquentiels) ; la transaction est liée à la commande et au montant.
- **Secrets FedaPay saisis en admin** : AES-256-GCM avec IV aléatoire et tag vérifié, ligne `is_public=false`, affichage masqué (préfixe + 4 derniers caractères), clé `server-only`. Aucun secret dans un `NEXT_PUBLIC_*`. `kody-scan-leaks` n'a relevé aucun HIGH ; les MED sont des numéros fictifs dans les tests et la démo.
- **Cookie `wx_recovery`** : signé HMAC, lié à l'utilisateur, 15 min, `httpOnly`, chemin `/api`, effacé après usage.
- **Redirections** :
  - `/api/auth/confirm` et `/callback` : chemin construit (`/${lang}/…`, `lang` limité à `fr|en`), origine tirée de `NEXT_PUBLIC_SITE_URL` ;
  - `next` passe par `safeInternalPath` ;
  - actions de l'assistant filtrées (`/` interne ou `https://wa.me/`) ;
  - URL de paiement vérifiée `https://`.
- **XSS** :
  - un seul `dangerouslySetInnerHTML` (JSON-LD), échappé par `safeJsonLd` (`<` → `<`, plus U+2028/2029), donc pas de `</script>` possible ;
  - mini-markdown en arbre, liens en liste blanche (`http(s)`, `mailto`, `/` interne ; pas de `//`, `\`, guillemets ni `javascript:`) ;
  - e-mails : `escapeHtml` partout, `raw()` réservé aux gabarits ;
  - avis rendus par React (échappement automatique).
- **Injection** : aucun SQL construit à la main. Les filtres `.or()` reçoivent des valeurs nettoyées (`sanitizeSearch`, `normPhone` qui ne garde que des chiffres).
- **Cron** : `Bearer CRON_SECRET` comparé à temps constant via SHA-256 ; 503 si le secret est absent.
- **Upload** : admin seulement, type vérifié par les octets de signature, nom généré côté serveur, 5 Mo maximum.
- **En-têtes** : CSP (avec `'unsafe-inline'` imposé par l'App Router), `frame-ancestors 'none'`, `form-action 'self'`, `object-src 'none'`, HSTS, nosniff.
- **SEO** : `robots` interdit `/admin`, `/api` et les espaces privés ; `noindex` sur l'admin, `/commande`, `/commande/merci`, `/avis-boutique` et le compte ; le sitemap ne liste que des pages publiques.
- **Purge** (`purge_demo.sql`) : suppression par IDs de démo explicites ; aucune écriture dans `auth.*`.

---

## Ordre de correction proposé

1. **C1** : désactiver Mobile Money dans l'admin **aujourd'hui** (avant le premier produit), puis ajouter la garde sandbox en production dans `settle.ts` et `index.ts`.
2. **M1** : CAPTCHA sur checkout et inscription, expiration COD plus courte, alerte « Nouvelle commande » regroupée.
3. **M2** : verrou de connexion `identifiant|IP` (protège aussi l'admin).
4. **F2** : alerte équipe sur changement de clés FedaPay, puis MFA admin.
5. F1, F3, F4, F5, F6.

Ceci est un audit pragmatique par lecture de code, pas une certification. Avant le passage aux clés FedaPay live, il est recommandé de faire faire un test d'intrusion ciblé (paiement, auth, admin).
