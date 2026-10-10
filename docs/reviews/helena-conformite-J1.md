# Helena : revue de conformité J1 (Waxo / Wá xɔ)

Date : 2026-10-09 · Reviewer : Helena (évaluation de risque, pas un conseil juridique formel)
Périmètre : textes légaux et d'infos (`src/messages/{fr,en}/account.json`, `src/components/account/legal/**`), claims commerciaux (`shop.json`, `product.json`, `checkout.json`, composants), collecte de données (inscription, contact, newsletter, suivi invité, avis, commande), futur suivi (G3), publicité/promotions, paiement mobile money.
Non ouvert (consigne) : `src/app/admin`, `src/lib/admin`, `src/components/admin`. La modération des avis, l'export newsletter et le suivi des messages côté admin ne sont donc PAS évalués.
Vérifications : FR lu en entier ; EN : structure et textes légaux relus, mêmes constats que le FR (pas de divergence de fond trouvée). Code lu : catalogue, cartes, héro, fiche, avis, newsletter, inscription, contact, suivi, checkout, paiement mock, tracking (`src/lib/tracking/*`, `consent.json`), migrations 0001 et 0002.

## Décision globale

- Développement et staging : OK, rien à bloquer.
- Mise en ligne publique avec ventes réelles : ❌ BLOQUANT tant que les 🔴 B1 à B9 ne sont pas levés.
- Les textes légaux sont des modèles (le bandeau « à valider par un juriste » est honnête, à garder jusqu'à validation).

Réserve de méthode : pour le droit béninois je cite le cadre indiqué dans le brief (Code du numérique, loi n° 2017-20 du 20 avril 2018, modifiée par la loi n° 2020-35 du 6 janvier 2021 ; APDP ; OHADA ; UEMOA). Je ne cite aucun numéro d'article béninois. Les références RGPD / UE (consentement, prix de référence, faux avis) sont des repères de bonne pratique, pas du droit applicable de plein droit au Bénin. Tout ce qui est marqué « à vérifier par un juriste local » doit l'être avant publication.

Bilan : 36 findings = 9 🔴 (B1-B9), 14 🟠 (M1-M14), 13 🟡 (L1-L13). Les ajouts M14 et L11-L13 viennent de la validation des claims de Marcus (`docs/reviews/marcus-copy.md`, `docs/copy/emails.md`) et de `docs/marketing/analytics-stack.md`, traitée dans les sections « Validation des claims de Marcus » et « Rulings analytics » ci-dessous.

---

## 🔴 Bloquants publication

### B1. Avis, notes et « Achat vérifié » de démonstration affichés comme avis clients
- Où : `src/lib/demo/catalog.json` (clés `reviews[]` avec `"seed": true, "verified": true`, auteurs fictifs « Nadège K. », « Hermann Q. »… ; `ratingSeed` / `ratingSeedCount` jusqu'à 214 avis) ; `supabase/migrations/0002_seed_demo.sql` (colonnes `rating_seed`, `rating_seed_count`, et lignes `reviews` avec `verified=true, seed=true`) ; `src/lib/catalog/index.ts` (`ratingOf()` additionne `rating_seed × rating_seed_count` aux vrais avis ; `getReviews()` ne filtre PAS `seed=false` : les faux avis sortent avec leur badge) ; affichage : `Home.rating` (« 4,6/5 · N avis clients », `HomeHero.tsx` l.55-61), `Card.rating` (« 4,7 · 188 avis »), fiche produit (`page.tsx` l.158-161), `Reviews.verified` (« Achat vérifié »), tri « Les mieux notés ».
- Constat : en production avec ces données, le site afficherait des centaines d'avis « clients » inexistants et des badges « Achat vérifié » faux, sur un site qui n'a pas encore vendu. La fiche dit « 188 avis » mais n'en liste que 2.
- Risque : pratique commerciale trompeuse / faux avis (référence UE : directive 2005/29/CE, annexe I, points 23 ter et 23 quater ajoutés par la directive 2019/2161 ; au Bénin : droit de la consommation et de la concurrence, texte exact et sanctions à vérifier par un juriste local). Atteinte directe à la crédibilité d'une marque neuve. Aggravé : la CGU (art. 4) promet que « Achat vérifié » = produit reçu par une commande réelle.
- Correction (aucune modification faite par moi) :
  1. Avant la mise en ligne : supprimer les avis de démo (`delete from public.reviews where seed;`), remettre `rating_seed = 0` et `rating_seed_count = 0` sur tous les produits, ou ne jamais appliquer 0002 en production.
  2. Code : `getReviews` doit filtrer `.eq("seed", false)` ; `ratingOf` ne doit plus lire le « seed » (note = moyenne des vrais avis publiés uniquement) ; la note moyenne du héro n'apparaît qu'au-delà d'un seuil de vrais avis (suggestion : ≥ 10 sur la boutique).
  3. Tant que `count = 0` : afficher `Product.noRating` (« Pas encore d'avis »), pas d'étoiles pleines ni de « 0,0 ».
  4. Si une démo est gardée en staging, la marquer visiblement « Exemple » et ne jamais la déployer en prod.

### B2. Ventes, stocks et remises de démonstration présentés comme réels
- Où : `0002_seed_demo.sql` et `catalog.json` : `sold` (412, 351, 274…), `stock` (5, 12…), `compare_price` (ex. 12 500 F barré à 15 000 F sur un produit créé le 30/09/2026) ; effets visibles : tags « Best-seller » (`logic.ts` `bestSellerIds`), section « Nos produits les plus vendus : ce que nos clients commandent le plus en ce moment » (`Home.bestSub`), classement « Numéro N des plus vendus » (`Card.rank`), « Plus que 5 en stock » (`Card.stockLow`), « Stock réel, chez nous : ce que vous voyez est disponible » (`Home.g3Title/g3Sub`), et FAQ q7 / About c1 (« Tout est en stock chez nous »).
- Constat : « 412 vendus » et « plus que 5 en stock » seraient inventés. Le stock affiché est présenté comme réel et mis à jour à chaque commande.
- Risque : allégation de popularité et de rareté fausses = pratique trompeuse (rareté artificielle explicitement interdite dans mes critères de revue) ; commandes acceptées sur un stock qui n'existe pas (inexécution, remboursements).
- Correction : avant la mise en ligne, repartir d'un catalogue réel (stock compté, `sold = 0`, prix barrés réels ou `null`). Le tag « Best-seller » et la section « plus vendus » ne doivent s'afficher que sur des ventes réelles (voir M5). Tant que vide : masquer la section plutôt que la remplir avec la démo.

### B3. Case « newsletter » pré-cochée à l'inscription
- Où : `src/components/account/AuthForm.tsx` l.39 (`useState(true)` pour `news`), clé `Auth.news` (« Recevoir les nouveautés par e-mail (facultatif) ») ; `src/app/api/auth/signup/route.ts` l.51-61 (si `news` : `profiles.news = true` ET insertion dans `newsletter_subs`).
- Constat : le consentement à la prospection est présumé (case cochée par défaut). Le libellé « facultatif » ne corrige pas le défaut.
- Risque : consentement non valide. Le Code du numérique béninois est largement inspiré du RGPD sur la définition du consentement (libre, spécifique, éclairé, univoque : à vérifier par un juriste local) ; en référence UE : RGPD art. 4(11) et 7, considérant 32 (cases pré-cochées exclues), CJUE Planet49 (C-673/17). Prospection électronique : opt-in préalable (directive 2002/58/CE art. 13). Tous les abonnés issus de cette case seraient inexploitables.
- Correction : case décochée par défaut (`useState(false)`) et libellé : « Je souhaite recevoir les nouveautés et offres de Wá xɔ par e-mail. Je peux me désinscrire à tout moment. » Séparer visuellement de la case CGU. Voir aussi M7 (confirmation).

### B4. Identité légale absente, textes à trous, date « en vigueur » affichée
- Où : `Legal.cgv.s1`, `Legal.cgu.s6`, `Legal.mentions.s1-s3`, `Legal.privacy.s1`, `Legal.privacy.s7` (`<tbc>`), `Legal.shipping.condP` (`<tbc>` sur qui paie le retour), `Legal.effective` (« En vigueur au 8 octobre 2026 »), `Legal.draft` (bandeau modèle).
- Constat : raison sociale, forme, RCCM, IFU, adresse, hébergeur, directeur de publication non renseignés (c'est normal à ce stade : je ne propose aucune valeur). Mais (a) une date « en vigueur » est affichée alors que le texte est un brouillon, (b) la condition de retour hors Cotonou est un trou dans une promesse commerciale (voir M2).
- Risque : vendre sans identification du vendeur = CGV inopposables et manquement aux obligations d'identification des sites marchands (Code du numérique, à vérifier) ; sur le plan OHADA, l'exploitant d'une activité commerciale doit être immatriculé au RCCM (ou avoir le statut simplifié d'« entreprenant » selon son cas) : statut à choisir et à vérifier par un juriste/fiscaliste local avant la première vente. Facturation normalisée (e-MECeF) et régime de TVA : à vérifier aussi, car la CGV dit « toutes taxes comprises » (art. 3).
- Correction :
  1. Décider du statut de l'exploitant, puis remplir `settings.legal` (prévu en 0004) : jamais de valeur inventée.
  2. `Legal.effective` : mettre la date de la vraie publication après validation, et conserver l'historique des versions.
  3. Garder le bandeau `Legal.draft` jusqu'à validation par le juriste, puis le retirer.
  4. Remplacement de `cgv.s3` si l'exploitant n'est pas assujetti à la TVA : « Les prix sont indiqués en francs CFA. [TVA non applicable / toutes taxes comprises : à confirmer avec un conseil fiscal local] ».

### B5. Mention d'une déclaration APDP affirmée alors qu'elle n'existe pas
- Où : `Legal.mentions.s4` : « le site fait l'objet d'une déclaration auprès de l'Autorité de Protection des Données à caractère Personnel (APDP) : récépissé n° [à compléter] ».
- Constat : seule le numéro est en « à compléter ». La phrase affirme que la formalité est faite.
- Risque : fausse déclaration de conformité. Le Code du numérique prévoit des formalités préalables auprès de l'APDP selon la nature du traitement (déclaration ou autorisation ; transferts hors Bénin en particulier) : nature exacte, délais et sanctions à vérifier par un juriste local.
- Correction : tant que les formalités ne sont pas accomplies, remplacer par : « Données personnelles : voir notre <privacy>politique de confidentialité</privacy>. » Une fois faites : « Les traitements réalisés sur ce site ont fait l'objet des formalités prévues par le Code du numérique auprès de l'APDP (référence : [n° et date du récépissé ou de l'autorisation]). » Ajouter ces formalités à la checklist (domaine RGPD/APDP). Aussi corriger la citation « loi n° 2017-20 du 20 avril 2018 … modifiée par la loi n° 2020-35 du 6 janvier 2021 » après vérification (référence reprise du projet, non vérifiée par moi).

### B6. Politique de confidentialité incomplète par rapport aux traitements réels et prévus
- Où : `Legal.privacy.s2` à `s7`.
- Manques constatés :
  - aucune base légale par finalité ;
  - destinataires génériques : « le prestataire de paiement », « l'hébergeur », « la technologie d'IA » non nommés. Réels ou prévus : FedaPay, Supabase, Vercel, Resend, DeepSeek (assistant), Google Analytics, Meta, Sentry, WhatsApp (Meta) pour les confirmations de commande et la newsletter par WhatsApp (`Newsletter.whatsapp`, `Home.step2Text`) ;
  - aucun transfert hors Bénin mentionné (tous ces prestataires sont étrangers ; la région Supabase n'est pas fixée à ma connaissance) ;
  - `s7` (« Stockage sur votre appareil ») contient encore le trou `<tbc>[Préciser l'outil de mesure d'audience]</tbc>` alors que GA4 et Meta Pixel arrivent (G3) ; le sessionStorage de la dernière commande (nom + téléphone, `last-order.ts`) et le drapeau d'avis (`waxo:reviewed:*`) ne sont pas cités ;
  - aucun droit à la portabilité, à la limitation, ni au retrait du consentement ; aucun délai de réponse ni vérification d'identité ; aucun contact de délégué/référent ;
  - les mineurs ne sont pas traités.
- Risque : manquement à l'obligation d'information (Code du numérique : à vérifier ; référence RGPD art. 13-14) ; incohérence avec le bandeau cookies (le bandeau renvoie vers cette page : `Consent.privacyLink`) ; sanction APDP possible.
- Correction : remplacer `s2 à s5` par un tableau « finalité / données / base légale / durée / destinataires ». Base légale à confirmer par un juriste local ; proposition de départ :

| Finalité | Données | Base légale (à vérifier) | Durée | Destinataires |
|---|---|---|---|---|
| Traiter et livrer la commande | nom, téléphone, adresse, note, produits, paiement | exécution du contrat | durée de la commande + conservation comptable légale [durée à confirmer : à vérifier par un juriste local] | équipe, livreur, FedaPay, Supabase, Vercel, WhatsApp |
| Compte client | prénom, nom, téléphone, e-mail, mot de passe (haché) | contrat (service demandé) | jusqu'à suppression ou [3 ans] après dernière activité (voir M9) | Supabase, Resend |
| Avis | nom abrégé, note, texte | consentement / intérêt légitime (à vérifier) | tant que l'avis est publié | public |
| Contact | nom, e-mail ou téléphone, message | intérêt légitime / mesures précontractuelles | 1 an | équipe, Supabase |
| Newsletter | e-mail ou WhatsApp | consentement | jusqu'au retrait + [3 ans] d'inactivité | Resend (e-mail), WhatsApp |
| Assistant IA | contenu des messages | intérêt légitime / consentement (voir M12) | [durée à définir] | DeepSeek |
| Mesure d'audience / publicité | identifiants de cookies, pages, événements | consentement | 6 mois pour le choix ; durée des cookies dans le tableau cookies | Google, Meta |
| Sécurité, anti-fraude, erreurs | IP, journaux | intérêt légitime | [durée à définir] | Vercel, Sentry |

  Ajouter une section « Transferts hors du Bénin » (liste des pays/prestataires, garanties : à vérifier par un juriste local pour le régime exact), une section « Cookies et stockage local » avec tableau nom / finalité / durée / catégorie (voir domaine G3 dans la checklist), les droits complets avec délai de réponse `[délai : à confirmer par un juriste local]` et justificatif d'identité demandé si doute, et une phrase sur les mineurs (`Le site s'adresse à des personnes majeures ; un mineur doit être autorisé par son représentant légal`).

### B7. « Désinscription en un clic » : promesse sans mécanisme
- Où : `Newsletter.text` (« Un message par semaine au maximum, désinscription en un clic »), visible sur toutes les pages (`(shop)/layout.tsx`).
- Constat : il n'existe pas de route de désinscription pour les abonnés sans compte (aucun lien tokenisé, rien pour le canal WhatsApp) ; seule la case « Mes informations » d'un compte retire l'e-mail (`api/me/profile`). La fréquence « 1 message par semaine max » n'est pas non plus garantie par le système.
- Risque : allégation inexacte (pratique trompeuse) + impossibilité d'exercer le retrait du consentement.
- Correction immédiate (texte) : « Arrivages, promos et idées utiles. Un message par semaine au maximum. Vous pouvez vous désinscrire à tout moment. » Correction avant le premier envoi : lien de désinscription tokenisé dans chaque e-mail (1 clic, sans connexion) et « répondez STOP » pour WhatsApp, avec suppression réelle de la ligne `newsletter_subs`.

### B8. Coordonnées factices par défaut
- Où : `src/lib/catalog/index.ts` `DEFAULT_SETTINGS.brand` (WhatsApp `+229 01 00 00 00 00`, e-mail `contact@waxo.bj`) et mêmes valeurs insérées par `0001_core.sql` ; affichées dans le pied de page, `Contact`, `Legal.mentions.s1`, `Legal.privacy.s1/s6`, FAQ.
- Constat : le numéro est factice ; l'adresse `contact@waxo.bj` n'est pas confirmée comme existante. La politique de confidentialité indique cette adresse comme seul canal d'exercice des droits.
- Risque : droits non exerçables, clients injoignables, mentions légales fausses.
- Correction : renseigner le vrai numéro WhatsApp et une vraie boîte e-mail en réglages avant la mise en ligne, et vérifier qu'elle reçoit du courrier. Idéalement, bloquer le déploiement en production tant que `brand.whatsapp` vaut la valeur factice.

### B9. Moyens de paiement annoncés alors que le paiement en ligne est un mock
- Où : `src/lib/payment/index.ts` (`MockPaymentProvider` renvoie `{ pending: true }`) ; textes : `Footer.payments`, `Home.g2Sub`, `Checkout.carteSub` (« paiement sécurisé »), `Legal.cgv.s5`, `Faq.a3`.
- Constat : tant que FedaPay n'est pas branché, une commande MoMo/Moov/Celtiis/carte reste « en attente » (le client voit « Validez le paiement sur votre téléphone… » mais rien n'est envoyé), le stock est réservé puis libéré par `expire_stale_orders`.
- Risque : annoncer des moyens de paiement non opérationnels ; client persuadé d'avoir payé ou commandé.
- Correction : en production, n'activer dans `settings.pay` que les moyens réellement opérationnels (au pire `cod` seul) ; les libellés du pied de page, de l'accueil, de la FAQ et des CGV suivent déjà `settings.pay` pour `cod` uniquement : vérifier que les autres moyens sont aussi conditionnés (aujourd'hui `Footer.payments` liste MoMo/Moov/Celtiis/Visa/Mastercard en dur). Test de bout en bout avec de vrais paiements avant d'ouvrir.

---

## 🟠 À corriger avant ouverture (ou au plus tard avant le premier euro encaissé)

### M1. Promesse « livré demain » absolue, contractualisée et calculée sur l'heure du navigateur
- Où : `Shell.topbar.delivery` (« Livraison demain à Cotonou & Calavi »), `Home.title` (« livrées demain »), `Home.g1Title` (« Livré demain »), `Seo.description/ogSubtitle`, `Legal.cgv.s6` (engagement ferme) vs `About.p1` (« souvent dès le lendemain », plus prudent), `Thanks.etaTomorrow`, `OrderConfirmation.tsx` l.61 (`new Date(placedAt).getHours()` = heure de l'appareil du client, pas de Cotonou, et jamais de test du dimanche/jours fériés).
- Risque : si le délai n'est pas tenu à ~100 %, c'est une promesse trompeuse ; la CGV ne dit rien en cas de retard ; un client à l'étranger ou avec une horloge décalée voit un ETA faux.
- Correction :
  - Alléger les bandeaux : `Shell.topbar.delivery` → « Livraison le lendemain à Cotonou & Calavi (commande avant 18 h) » ; `Home.g1Title` → « Livraison le lendemain » / `g1Sub` « Cotonou & Calavi, commande avant {hour} h, du lundi au samedi » (déjà bon).
  - Slogan « livrées demain » : à garder seulement si le taux réel de livraison à J+1 est mesuré et tenable (suggestion : le suivre les 30 premiers jours) ; sinon « livrées vite à Cotonou ».
  - `cgv.s6` : ajouter « Les délais sont indicatifs hors cas de force majeure, de jour férié ou d'indisponibilité du client. En cas de retard de plus de [X] jours, le client peut annuler sa commande et être remboursé. » (X à fixer par Fresnel).
  - Pour Kody : calculer l'heure sur le fuseau de la boutique (Africa/Porto-Novo) côté serveur à la prise de commande et gérer dimanche/jours fériés.

### M2. « 7 jours pour changer d'avis » : promesse commerciale volontaire, conditions éparses et ambiguës
- Où : `Home.g4Title` (« {days} jours pour changer d'avis »), `Product.returns`, `Checkout.returns`, `About.c3p`, `Faq.a6`, `Legal.cgv.s7`, `Legal.shipping.step3/condP`.
- Constats :
  1. Le droit de rétractation de 7 jours n'est pas un droit légal établi à ma connaissance : le texte béninois applicable (Code du numérique, droit de la consommation) est à vérifier par un juriste local. Une fois annoncé, c'est un engagement contractuel que Wá xɔ doit tenir. Ne pas écrire « droit légal de rétractation ».
  2. Les exclusions (produits d'hygiène descellés, produit utilisé) ne sont visibles qu'au clic (lien « Conditions » sur la fiche), pas sur l'accueil ni dans le tiroir panier.
  3. « Échange ou remboursement » : CGV s7 laisse le choix au client, `shipping.step3` dit « nous échangeons le produit ou vous remboursons » (qui choisit ?).
  4. Qui paie le retour hors Cotonou/Calavi : non décidé (`<tbc>`). Le coût de renvoi vers une autre ville est précisément le point qui décourage l'usage de la promesse.
  5. Frais éventuels de remboursement par Mobile Money : non précisés.
- Correction :
  - `Home.g4Sub` : « Échange ou remboursement, produit non utilisé » ; `Product.returns` : « Échange ou remboursement sous {days} jours, produit non utilisé. » (le lien « Conditions » reste).
  - `shipping.step3` : « Après vérification, nous échangeons le produit ou nous vous remboursons, selon votre choix, sous {days} jours. »
  - `shipping.condP` (décision de Fresnel, choisir une option) : option A « Pour un changement d'avis hors Cotonou et Calavi, les frais de retour sont à votre charge. » ; option B « Le retour est offert partout au Bénin. »
  - Ajouter : « Les frais de remboursement Mobile Money éventuels sont supportés par Wá xɔ. » (ou l'inverse, à décider et à afficher).

### M3. CGV : défauts sous 48 h, clauses manquantes, acceptation non tracée
- Où : `Legal.cgv.s8` (« Tout défaut … dans les 48 h suivant la réception »), `s10`, absence de clauses, `Checkout.terms` (12 px, simple mention).
- Constats :
  - 48 h pour signaler un défaut est très court, contradictoire avec les 7 jours de retour (un produit défectueux serait traité moins bien qu'un produit non défectueux) et susceptible d'être jugé abusif ; garanties légales de conformité / vices cachés à vérifier localement.
  - Clauses utiles absentes : commande en ligne non payée annulée automatiquement et stock libéré (la fonction `expire_stale_orders` annule après 60 min, mais le cron Vercel Hobby est quotidien : le délai réel sera plus long) ; erreur de prix manifeste ; refus de réception d'une commande payable à la livraison ; recours du consommateur (voie amiable via le service client OK, mais aucune mention d'un organisme de médiation ou de l'autorité de consommation béninoise : à vérifier) ; langue (le français fait foi).
  - Acceptation : clause browsewrap (« En validant, vous acceptez ») sans trace de la version des CGV acceptée.
- Correction :
  - `cgv.s8` : « Tout défaut ou erreur de produit peut être signalé dans les {days} jours suivant la réception, photo à l'appui [délai à valider par un juriste local]. Cela ne limite pas les droits que la loi reconnaît au client. Wá xɔ échange ou rembourse le produit et prend en charge les frais de retour. »
  - Nouvel article « Commandes non payées » : « Une commande à payer en ligne qui n'est pas réglée dans un délai de [durée réellement appliquée] est annulée automatiquement. Un paiement reçu après annulation est remboursé. »
  - Nouvel article « Refus de livraison » (seulement si pratique réelle) : « Le refus répété, sans motif légitime, d'une commande payable à la livraison peut conduire à n'ouvrir au client que le paiement en ligne pour ses commandes suivantes. » Attention : cela suppose un fichier d'incidents clients, à ajouter à la politique de confidentialité.
  - Enregistrer sur la commande la date et la version des CGV (côté code, pour Kody).
  - Ajouter « En cas de divergence, la version française fait foi » (EN ne vaut que traduction).

### M4. Prix barrés et remises : aucun contrôle du prix de référence
- Où : colonne `products.compare_price` (`0001_core.sql`), `ProductCard.tsx` l.133-135, `HomeHero.tsx` l.93-95, fiche produit l.168-175, `logic.ts` (`promoLabel`, `heroProducts`), `Shell.nav.promos`, `Home.promosTitle` (« Les promos du moment »), `Catalog.col.promos`. La base impose seulement `compare_price > price`.
- Risque : un prix barré fantaisiste (ou un prix barré jamais pratiqué) est une réduction de prix trompeuse. Référence UE : directive 98/6/CE art. 6 bis (prix antérieur = prix le plus bas pratiqué dans les 30 jours précédents) ; au Bénin, règle précise à vérifier par un juriste local, mais la pratique reste jugée sur le caractère réel du prix de référence.
- Correction : règle interne à écrire et appliquer par l'admin : le prix barré = prix réellement pratiqué en boutique durant les 30 derniers jours précédant la promo ; afficher une date de fin (« jusqu'au [date] ») ou « prix habituel » ; ne pas laisser une promo permanente sur un produit ; ne pas barrer un prix sur un produit lancé depuis moins de 30 jours. Pour Kody/D2 : champ « fin de promo » et historique de prix.

### M5. « Best-seller », « Plus vendus », « Nouveau » : définitions non fiables
- Où : `logic.ts` : `bestSellerIds` (4 produits en stock avec le plus grand `sold`, sans seuil minimal) ; `newIds` (nouveau = moins de 30 jours AVANT LE PRODUIT LE PLUS RÉCENT du catalogue, pas avant aujourd'hui) ; `Home.bestSub` (« ce que nos clients commandent le plus en ce moment »).
- Risque : au démarrage, un produit vendu 2 fois est « Best-seller » ; un produit ajouté en octobre reste « Nouveau » en mars si rien n'est ajouté ensuite.
- Correction : tag Best-seller seulement au-delà d'un seuil de ventes réelles (ex. ≥ 10 ventes sur 30 jours : à fixer) ; « Nouveau » = créé depuis ≤ 30 jours par rapport à la date du jour ; `Home.bestSub` : « Les produits les plus commandés sur la boutique. » (sans « en ce moment » tant que ce n'est pas vrai).

### M6. Avis réels : mode de vérification non affiché, publication immédiate, badge manuel
- Où : `ReviewsSection.tsx` / `api/reviews/route.ts` (insertion `verified=false`, publication immédiate : `Reviews.thanks` « votre avis est publié ») ; `Reviews.policy` ; `Legal.cgu.s4`.
- Constats : (1) n'importe quel compte peut noter n'importe quel produit, sans achat (cela n'est pas dissimulé tant que le badge « Achat vérifié » n'est pas posé à tort) ; (2) le badge dépend d'une action manuelle de l'admin (non évalué, hors périmètre) ; (3) la note moyenne mélange avis vérifiés et non vérifiés sans le dire ; (4) la CGU promet « jamais modifié » : or la modération peut masquer des avis négatifs : il faut distinguer masquage pour non-respect des règles et masquage pour avis défavorable.
- Correction : `Reviews.policy` → « Les avis sont publiés par des clients inscrits. Le badge « Achat vérifié » indique que nous avons retrouvé une commande livrée de ce produit pour ce compte. Nous n'écartons pas un avis parce qu'il est négatif. Les avis ne sont pas rémunérés. » Idéalement poser le badge automatiquement (commande `livree` du même `user_id` contenant ce produit) et ne jamais le poser à la main. Pas de remise ni de cadeau contre un avis sans le mentionner.

### M7. Newsletter : pas de confirmation du contact, abonnement avant confirmation d'e-mail
- Où : `api/newsletter/route.ts` (insertion directe, `consent: true`, aucune vérification que l'e-mail ou le numéro appartient à la personne) ; `api/auth/signup/route.ts` l.51-61 (ligne `newsletter_subs` créée dès l'inscription, avant le clic de confirmation de l'e-mail du compte) ; table `newsletter_subs` sans colonne source ni version du texte.
- Risque : n'importe qui peut abonner l'e-mail ou le numéro WhatsApp d'un tiers (spam, harcèlement) ; preuve de consentement faible ; WhatsApp impose son propre opt-in explicite pour les messages marketing (politique WhatsApp Business : à vérifier au moment de l'envoi).
- Correction : double opt-in (message de confirmation avec lien/réponse OUI avant toute prospection) ; ne créer la ligne issue de l'inscription qu'après confirmation du compte ; conserver date, canal, source (« footer », « inscription ») et version du texte ; limiter la fréquence effectivement (voir B7).

### M8. Information au point de collecte : le tunnel de commande ne renvoie pas vers la confidentialité
- Où : `Checkout.terms` (« En validant, vous acceptez les conditions générales de vente. », 12 px) : pas de lien vers `/confidentialite` ; le formulaire collecte nom, téléphone, adresse, note ; la page de contact et la newsletter, elles, ont un lien (`Contact.privacy`, `Newsletter.privacy`).
- Correction : « En validant, vous acceptez les <terms>conditions générales de vente</terms>. Vos données servent à traiter et livrer votre commande : <privacy>confidentialité</privacy>. » (nouvelle balise `privacy` à ajouter dans le rendu, pour Kody).

### M9. Durées de conservation annoncées sans purge automatique ; durée comptable floue
- Où : `Legal.privacy.s5` : compte « 3 ans après la dernière activité », messages « 1 an », commandes « durée imposée par la réglementation comptable ». Aucune tâche de purge dans le code ni les migrations (je n'ai trouvé que `expire_stale_orders`).
- Risque : promesse non tenue (la durée publiée est un engagement) ; conservation excessive.
- Correction : ajouter des tâches périodiques (messages > 1 an, comptes inactifs > 3 ans après avertissement, avis/commandes selon règles) ou réécrire en « conservés tant que nécessaire, au maximum [X] ». Pour les commandes : la durée comptable légale (OHADA/SYSCOHADA et fiscalité béninoise) est à vérifier par un juriste/fiscaliste local ; ne pas écrire un nombre d'années sans cette vérification. Pour les commandes d'un compte supprimé : la base met `user_id` à NULL (`on delete set null`), ce qui est cohérent avec « supprimer = dissocier, conserver les pièces comptables » ; le dire dans la politique.

### M10. Exercice des droits : processus à décrire et à rendre réalisable
- Où : `Account.security.footer` (« Pour supprimer votre compte ou exporter vos données, écrivez-nous depuis la page Contact »), `Legal.privacy.s6`, `Legal.cgu.s3`.
- Constats : la suppression de compte et l'export passent par un message manuel ; aucune vérification d'identité, aucun délai, aucune procédure interne ; le formulaire de contact n'a pas de sujet « Mes données personnelles » (`Contact.subjects`).
- Correction : ajouter le sujet « Données personnelles » au formulaire ; procédure interne écrite (vérifier l'identité par l'e-mail du compte, répondre sous [délai à confirmer par un juriste local], supprimer le compte et dissocier les commandes, supprimer ou anonymiser les messages) ; mentionner dans la politique le délai de réponse. Le texte « Nous ne vous demanderons jamais votre mot de passe » est bon, à garder.

### M11. Sous-traitants et transferts internationaux sans cadre contractuel documenté
- Où : tout le périmètre données : Supabase, Vercel, Resend, FedaPay, Google, Meta, Sentry, DeepSeek, WhatsApp.
- Risque : le Code du numérique encadre les transferts de données hors du Bénin (autorisation APDP et/ou pays offrant une protection adéquate : régime exact à vérifier par un juriste local) ; référence RGPD art. 28 et 44-49. Aucun registre ni accord de traitement (DPA) n'est documenté.
- Correction : tenir un registre simple (prestataire / données / pays / DPA accepté / date), accepter les DPA en ligne de Supabase, Vercel, Resend, FedaPay, Sentry ; choisir une région Supabase proche et documentée ; mentionner la liste dans la politique (voir B6) ; soumettre la question transferts à l'APDP / au juriste local.

### M12. Assistant IA : réponse non vérifiable, données envoyées à un tiers qui peut entraîner ses modèles
- Où : `Legal.cgu.s5`, `Legal.privacy.s2/s4` (« le fournisseur de la technologie d'IA »), `Home.step1Text` (« Seul ou avec l'assistant »), `Product.askAssistant`, `Cart.askAssistant`. Prévu : DeepSeek (fiche projet).
- Constats : (1) les conversations seront envoyées à DeepSeek, dont la politique d'entraînement sur les données d'API n'est pas la même que celle d'Anthropic ou d'OpenAI (mémoire du projet : DeepSeek entraîne) ; (2) l'utilisateur peut taper un nom, un numéro, une adresse ; (3) si l'assistant n'est pas livré à la mise en ligne, les textes qui le citent sont des promesses vides.
- Correction : nommer le fournisseur et le pays dans la politique ; avertissement dans la fenêtre de l'assistant : « Cet assistant est une IA. Ne saisissez pas de données personnelles. Vos messages sont traités par [fournisseur] pour générer la réponse. » ; ne jamais envoyer au LLM nom/téléphone/adresse du client ; durée de conservation des conversations à définir ; retirer les mentions de l'assistant tant qu'il n'est pas actif (`Home.step1Text`, `Product.askAssistant`, `Cart.askAssistant`, `Cart.emptyText`, `Legal.cgu.s5`).

### M13. Paiement mobile money et carte : formulations à garantir et remboursements non outillés
- Où : `Legal.cgv.s5` (« prestataire de paiement agréé »), `Checkout.carteSub` (« paiement sécurisé »), `Checkout.momoHelp`, `Account.orders.cancelled` (« Un paiement en ligne est remboursé sur le moyen de paiement utilisé »), `Legal.cgv.s4` (« remboursé intégralement »), table `payments.status` (`needs_refund`, `amount_mismatch`).
- Constats : « agréé » doit être vrai (vérifier l'agrément/licence de FedaPay auprès de la BCEAO/autorité compétente ou reformuler en « prestataire de paiement tiers ») ; la carte bancaire doit être réellement activée chez FedaPay avant d'être annoncée ; le remboursement est promis alors que le flux est manuel (`needs_refund` sans automatisation) ; aucun délai de remboursement pour une annulation ; le numéro Mobile Money saisi (`payerPhone`) est transmis au prestataire : à citer dans la politique ; ne pas appliquer de surcoût selon le moyen de paiement sans l'afficher.
- Correction : `cgv.s5` → « Les paiements en ligne sont traités par un prestataire de paiement tiers (FedaPay) ; Wá xɔ n'a jamais accès aux codes secrets ni aux numéros complets de carte. » (nommer FedaPay) ; `cgv.s4` : ajouter « Le remboursement est effectué sous [délai réaliste, ex. 7 jours ouvrés] par le moyen de paiement utilisé. » ; écrire la procédure de remboursement et la tester (cas : commande annulée payée, paiement reçu après annulation, montant différent).

---

## 🟡 Recommandations

### L1. Texte provisoire visible
- `About.photo` (« Photo de l'équipe ou du stock à ajouter ») : à remplacer par une vraie photo (droits à vérifier, autorisation écrite des personnes) ou supprimer.

### L2. Vocabulaire technique inexact
- `Legal.privacy.s2` : « mot de passe (enregistré sous forme chiffrée) » → « sous forme sécurisée (hachée) ». `Legal.privacy.s8` : bien.

### L3. Case d'acceptation : confusion CGU / politique de confidentialité
- `Auth.cgu` : « J'accepte les conditions d'utilisation et la politique de confidentialité ». On « prend connaissance » d'une politique de confidentialité, on n'y consent pas (la base légale du compte est le contrat). Reformuler : « J'ai lu les <cgu>conditions d'utilisation</cgu> et la <privacy>politique de confidentialité</privacy>. »

### L4. Allégations produit à étayer auprès du fournisseur
- Dans `catalog.json` (descriptions) : « sans produit chimique » (raquette), « sans BPA » (bouteille), « nettoie en profondeur sans irriter » (brosse visage : allégation cosmétique), « recharge un smartphone à 50 % en 30 minutes », « garde l'eau fraîche 24 h / le thé chaud 12 h », « jusqu'à 10 h d'autonomie », « étanche », « résistants à la sueur ». Conserver les fiches ou tests du fournisseur ; nuancer (« jusqu'à », conditions de mesure) ; retirer « sans irriter » faute de preuve. Produits électriques (chargeurs, batteries, lampe) : conformité et sécurité de l'importation à vérifier auprès de l'importateur.

### L5. « Stock réel, chez nous » : vrai seulement si le modèle opérationnel l'est
- `Home.g3Title`, `About.p1/p2/c1t`, `Legal.cgv.s2`, `Faq.a7`. Si une partie du catalogue est commandée chez un fournisseur après la vente, ces phrases deviennent fausses. Faire un comptage de stock avant l'ouverture et à intervalle régulier ; si dropshipping partiel, reformuler (« En stock ou livré sous X jours »).

### L6. Seuil de rareté « Plus que N en stock »
- `Card.stockLow` (stock ≤ 5, `logic.ts` `stockKind`) : conforme tant que le stock est réel (donc dépend de B2). Pas de compte à rebours ni de fausse urgence trouvés : bon point à préserver.

### L7. Engagement horaire WhatsApp
- `Home.step2Text` : « Un message WhatsApp dans l'heure avec le créneau de livraison » : à tenir (y compris en dehors de 8 h-19 h) ou à reformuler « dès que possible, du lundi au samedi de 8 h à 19 h ».

### L8. Suivi invité : devinabilité du couple numéro + téléphone
- `api/orders/track/route.ts` : numéros séquentiels `WX-1026x` + téléphone à 10 chiffres. Rate-limit par IP et par numéro en mémoire (réinitialisé à chaque instance serverless) : limite d'efficacité. Protège des données personnelles (statut, articles). Recommandation : limite persistante (base ou KV), délai croissant. Bon point : réponse identique « introuvable » (anti-énumération).

### L9. Affichage multi-devises prévu (J4)
- Les montants en € / $ doivent être marqués « indicatifs, paiement en FCFA » ; taux et date de mise à jour visibles (`fx_rates`).

### L10. Stockage local de données personnelles
- `last-order.ts` conserve nom et téléphone en sessionStorage (effacé à la fermeture de l'onglet) : acceptable ; à citer dans la section « Stockage » de la politique (B6). Les favoris et les produits consultés restent locaux (jamais envoyés au serveur à ma lecture de `ViewedTracker` / `favorites` : à reconfirmer si un jour synchronisés) : exemption à vérifier si ces données alimentent un jour de la publicité.

---

### M14. E-mails transactionnels : aucun champ e-mail dans le tunnel de commande invité
- Où : `docs/copy/emails.md` (6 e-mails, `{{name}}`, `{{trackUrl}}`) ; `CheckoutFlow.tsx` ne collecte que nom, téléphone, adresse (le schéma `checkoutSchema` accepte un e-mail optionnel mais le formulaire ne le demande pas) ; la CGV art. 4 annonce « WhatsApp ou SMS ».
- Constat : sans e-mail collecté, ces gabarits ne partent que pour les comptes. Si un champ e-mail facultatif est ajouté, il faut l'informer (finalité unique : suivi de la commande) et ne jamais l'utiliser pour la newsletter sans consentement séparé (B3, M7).
- Correction : si le champ est ajouté : libellé « E-mail (facultatif) pour recevoir les messages de suivi de commande » ; l'ajouter à `Legal.privacy.s2/s3` ; ne pas pré-abonner à la newsletter. Les e-mails de commande sont des messages de service : ils ne doivent contenir aucune promotion ; pas de lien de désinscription obligatoire, mais le pied de page doit renvoyer vers la politique de confidentialité et, une fois connue, indiquer la raison sociale (voir B4).

## Validation des claims de Marcus (`marcus-copy.md` et `emails.md`)

Décision par claim (V = validé, V+ = validé avec condition, C = corrigé, R = refusé tant que non justifié).

| Claim / clé | Décision | Texte retenu / condition |
|---|---|---|
| `Home.step2Text` « dans l'heure » | C (retrait validé) | « Un message WhatsApp vous confirme le créneau de livraison. » (proposition de Marcus acceptée) |
| `Card.stockOut`, `Product.comingSoonTitle`, EN idem « bientôt de retour » | C (retrait validé) | « Épuisé pour le moment », « Ce produit est momentanément épuisé. » (propositions de Marcus acceptées : aucun réassort promis) |
| `Checkout.zoneCotonouSub` « entre 9 h et 19 h » | C | Plage horaire = engagement non étayé. Remplacer par « Demain, créneau confirmé sur WhatsApp (commande avant {cutoff} h) ». Garder la plage seulement si elle est contractuelle avec les livreurs. |
| `zoneAutreSub`, `Thanks.etaOther`, `Faq.a1` « 48 à 72 h » | V+ | À condition que `cgv.s6` précise que les délais sont indicatifs (voir M1). |
| `Thanks.eta48` « sous 48 h » | C | Marcus a raison : aucune source. Ce texte s'affiche pour une commande à Cotonou passée après l'heure limite. Remplacer par « Livraison prévue dans 2 jours. » ET ajouter la règle dans `cgv.s6` / `shipping.r1d` (« après {cutoff} h : le surlendemain ») une fois confirmée par Fresnel. À défaut, utiliser « Livraison prévue sous 48 à 72 h ». |
| `Thanks.pendingNote` « reçu par WhatsApp » | C | « Vous recevez une confirmation dès que le paiement est validé. » (Marcus). Le canal n'est pas promis. |
| `Account.orders.cancelled`, FR-6 / EN-6 « remboursé sur le moyen de paiement utilisé » | R pour l'instant | Utiliser la formule de repli de Marcus : « Si vous aviez payé en ligne, contactez-nous sur WhatsApp au {{whatsapp}} au sujet du remboursement. » (idem dans `Account.orders.cancelled`). Réintroduire la promesse seulement quand la procédure de remboursement a été testée (voir M13), avec un délai : « remboursé sous [X] jours sur le moyen de paiement utilisé ». |
| `Home.g3Sub`, `Faq.a7`, `About.c1p` « ce que vous voyez est disponible », « mis à jour à chaque commande » | V+ | Vrai techniquement (`place_order` décrémente). Valide seulement avec un stock réel (B2, L5). |
| `Home.guarantees` « Nos garanties » → « Nos engagements » | V | Correct : « garantie » a un sens juridique précis. |
| `Legal.cgv.s4` « WhatsApp ou SMS » | C | Aucun SMS n'est prévu. Remplacer par « une confirmation est envoyée par WhatsApp (et par e-mail si vous en avez indiqué un) ». |
| `Legal.cgv.s8` défaut sous 48 h | C | Voir M3. |
| Tagline `Brand.tagline`, `Shell.tagline`, `Footer.tagline` → « Les petites choses utiles, livrées demain » (proposition de Marcus) | R en l'état | Un slogan global, répété sur chaque page, sans lieu ni heure limite = promesse absolue (M1). Retenir l'alternative de Marcus « Faites vos achats depuis chez vous », ou « Les petites choses utiles, livrées vite à Cotonou » ; garder « demain » uniquement avec lieu + heure limite. |
| `Home.lead` proposé : « Commandez avant {hour} h : livraison demain à Cotonou et Calavi. » | V | Conditions explicites. Ajouter « du lundi au samedi » si c'est la règle réelle. |
| `Home.seeProducts` proposé « Voir les {count} produits en stock » | C | Le code passe `products.length` (tous les produits actifs, y compris épuisés). Soit compter les produits avec `stock > 0`, soit écrire « Voir les {count} produits ». |
| `Cart.checkout` proposé « Commander · {total} » | C | Le montant affiché dans le tiroir est un sous-total, hors livraison : ne pas l'appeler « total ». Garder « Commander » et ajouter une ligne « Livraison calculée à l'étape suivante », ou afficher le vrai total. |
| `Cart.reassure` proposé « Sans compte. {days} jours pour changer d'avis. » | V+ | Ajouter « produit non utilisé » (M2) : « Sans compte. {days} jours pour changer d'avis (produit non utilisé). » « Vous pouvez payer à la réception » seulement si `pay.cod` est actif. |
| `Product.stockOut` / `Shell.toast.soldOut` : « L'assistant peut vous proposer… » | V+ | Seulement si l'assistant est en ligne (M12). |
| `Thanks.line` proposé (« … puis le livreur vous appelle avant d'arriver ») | V | Cohérent avec CGV et FAQ. |
| Messages d'erreur avec exemple d'e-mail / « Votre panier est conservé » | V+ | « Votre panier est conservé » : seulement après vérification du comportement réel (réserve déjà posée par Marcus). |
| `Home.step3Text` « le livreur vous appelle avant d'arriver » | V | Corrige la contradiction avec la CGV (c'est un engagement de la CGV art. 6 : à tenir). |
| EN « Pay on delivery » au lieu de « Cash on delivery » ; « PIN » | V | Exact : Mobile Money accepté à la livraison. |
| EN `free on orders over {freeShip}` (Faq.a2, cgv.s6, shipping.r1f, topbar) | C | Le code applique `>=` (franco atteint à 15 000 F pile). « over » serait inexact : écrire « free on orders of {freeShip} or more ». |
| `Legal.effective` « En vigueur depuis le 8 octobre 2026 » | C | Voir B4 : date de la vraie publication. |
| `About.photo` (retrait) | V | Voir L1. |
| `emails.md` : promesses « Livraison prévue : {{deliveryDate}} » calculée par le serveur, « jamais demain après l'heure limite » | V | Bonne pratique qui règle M1 côté e-mail. |
| `emails.md` FR-5 / EN-5 « 7 jours pour changer d'avis : échange ou remboursement » | V+ | Ajouter « produit non utilisé » et un lien vers `/livraison-retours` (M2). Le « 7 » en dur doit suivre `settings.shipping.returnDays`. |
| `emails.md` FR-4 / EN-4 « Votre commande est déjà payée » | V+ | Uniquement si `orders.paid = true` (déjà prévu par Marcus). |
| `emails.md` pied de page « Vous recevez ce message parce que vous avez passé commande » | V | Conforme à un message de service. Ajouter le lien confidentialité et, plus tard, la raison sociale (B4). |
| `emails.md` « Total TTC » (tableau des variables) | V+ | Dépend de la décision TVA (B4). |
| `emails.md` hypothèse e-mail client | C | Voir M14. |

## Rulings analytics (`docs/marketing/analytics-stack.md`)

- Règles 5 et 8 (aucune donnée personnelle, aucun appel avant consentement) : validées. Garde-fou du terme de recherche (`@` ou ≥ 6 chiffres) : validé ; ajouter aussi un plafond de longueur (80) déjà présent dans `events.ts`.
- Pas de Consent Mode « avancé » : validé (compatible avec le strict opt-in). Signaux Google et personnalisation publicitaire désactivés : validé. Conservation GA4 : 14 mois est le maximum ; préférer 2 mois si l'usage ne justifie pas plus (minimisation).
- Anti-doublon `waxo:tracked:purchase:<n°>` en localStorage uniquement si mesure acceptée : validé. `purchase` seulement quand le serveur confirme `paid` : validé (c'est aussi l'exigence 6 de G3).
- Compteur de consentement anonyme (`POST {analytics, ads, language}`) : accepté sous conditions : aucun cookie, aucun identifiant, pas d'IP ni d'User-Agent stockés, agrégation journalière, mention dans la politique de confidentialité. Sinon s'en passer.
- Mesure Meta « Messages » (click-to-WhatsApp) sans consentement navigateur : acceptable côté site (aucun traceur déposé), mais le traitement existe côté Meta/WhatsApp : à citer dans la politique (B6) ; les étiquettes WhatsApp Business sur des clients sont des données personnelles (finalité : suivi de commande, durée limitée).

### L11. Intitulés de bouton et compteurs (voir tableau Marcus)
- Voir les lignes `Cart.checkout` et `Home.seeProducts` : éviter qu'un sous-total soit présenté comme total et qu'« en stock » compte des produits épuisés.

### L12. Franco en anglais
- « free from X » / « over X » : écrire « free on orders of X or more » (le franco s'applique à partir de 15 000 F inclus).

### L13. Attribution et étiquettes clients
- Champ déclaratif « Comment nous avez-vous connus ? » au checkout (`analytics-stack.md` §6), UTM conservés avec la commande, étiquettes WhatsApp Business : à déclarer dans la politique (finalité statistiques/suivi, base intérêt légitime à vérifier), champ facultatif, aucune obligation de répondre pour commander.

---

## Exigences pour G3 (consentement, Meta Pixel, GA4, Sentry)

Constats sur le travail déjà posé (`src/lib/tracking/consent.ts`, `consent-client.ts`, `consent.json`) : opt-in strict par défaut (`NO_CONSENT`), catégories séparées, durée 6 mois, purge des cookies `_ga*`, `_fbp`, `_fbc` au retrait, exclusion `/admin`, événements sans donnée personnelle. Base saine. À appliquer :

1. Aucun script, aucune requête vers Google/Meta, aucun cookie `_ga*`/`_fbp` avant un choix explicite (test réseau Playwright : 0 requête avant choix, 0 après refus, 0 après retrait).
2. Bandeau : « Tout refuser » aussi visible que « Tout accepter » (même taille, même contraste, même niveau, 1 clic). La croix/`Fermer` = refus, jamais acceptation. Interrupteurs « Personnaliser » décochés par défaut. Pas de mur de cookies (le site reste utilisable après refus).
3. Preuve du choix : le stockage conserve le choix, la date et la version (`v:1`, `ts`) ; si les catégories ou les prestataires changent, incrémenter la version pour redemander.
4. Retrait : lien « Gérer mes cookies » dans le pied de page de toutes les pages (y compris commande et compte). Au retrait : purger les cookies (déjà fait) ET neutraliser les scripts déjà chargés (`window['ga-disable-<ID>'] = true`, `fbq('consent','revoke')`, ou rechargement de page) ; supprimer un cookie ne suffit pas à arrêter l'envoi.
5. GA4 : `allow_google_signals: false`, `allow_ad_personalization_signals: false`, pas de User-ID, pas de partage de données avec les produits Google, conservation des données au minimum dans l'interface GA4, aucun e-mail/nom/téléphone dans les paramètres. Consent Mode v2 : si le script n'est chargé qu'après consentement, c'est suffisant ; si un jour il est chargé avant, envoyer `ad_storage/analytics_storage/ad_user_data/ad_personalization = denied` par défaut.
6. Meta Pixel : `autoConfig=false` (prévu), pas d'Advanced Matching (pas d'e-mail ou téléphone hachés) sans consentement dédié et mention dans la politique, `Purchase` envoyé seulement quand le paiement est confirmé (pas sur une commande `pending` ou mock : sinon fausses conversions), pas d'API de conversions serveur sans la même condition de consentement.
7. URL envoyées : retirer la chaîne de requête et le fragment de `page_location` / `page_path` sur `/connexion`, `/inscription`, `/compte`, `/suivi` et sur les liens de réinitialisation de mot de passe (`?code=`, `#access_token=`, etc.) ; ne pas envoyer le numéro de commande dans une URL de page mesurée si cela se produit (le `transaction_id` de l'événement `purchase` est acceptable).
8. `search` : le terme saisi est du texte libre (peut contenir un nom ou un numéro) ; soit ne pas l'envoyer, soit le limiter (déjà 80 caractères) et le déclarer.
9. Sentry : `sendDefaultPii: false`, retirer corps de requête, cookies et en-têtes sensibles, pas de session replay ; bien l'inscrire dans la politique (finalité sécurité, base intérêt légitime, transfert hors Bénin) ; sinon le conditionner au consentement « mesure ».
10. Texte du bandeau (`Consent`) : `analyticsText` « Données agrégées, sans publicité Google. » → « Statistiques de fréquentation (Google Analytics), sans personnalisation publicitaire. » (« agrégées » n'est pas exact au niveau de la collecte) ; `marketingText` → « Partage d'informations avec Meta (Facebook, Instagram) pour mesurer et améliorer nos publicités : pages vues, ajouts au panier, commandes. » ; `text` : « Rien n'est déposé avant votre choix » → « Aucun traceur de mesure ou de publicité n'est déposé avant votre choix » (le panier et la langue sont stockés localement par nécessité).
11. Page de politique : tableau des cookies et stockages (nom, finalité, durée, catégorie), à joindre avec B6 : `waxo_consent` (6 mois, nécessaire), cookies de session Supabase `sb-*` (nécessaire), cookie de langue next-intl (nécessaire), `_ga`, `_ga_<ID>` (durée Google, à lire dans la doc Google au moment de la rédaction), `_fbp` (90 jours selon Meta, à vérifier), `_fbc`, clés localStorage `waxo:*` (panier, favoris, produits consultés, consentement), sessionStorage `waxo:last-order:v1`.
12. Droit béninois : je ne peux pas affirmer le régime exact applicable aux traceurs au Bénin. Appliquer le standard strict (qui sera conforme dans les deux cas) et faire confirmer par un juriste local.

## Publicité et promotions (domaine 5)

- Toute publicité (Meta, Google, TikTok, WhatsApp) reprend UNIQUEMENT des claims validés ci-dessus (livraison, retours, prix, stock). Pas de « livré demain » dans une pub tant que M1 n'est pas tranché ; pas de prix barré sans M4.
- Pas de faux témoignage, pas de capture d'avis démo, pas de photo client sans autorisation écrite et sans possibilité de retrait.
- Promotions : date de fin visible, conditions écrites (produits concernés, stock limité réel, cumul), prix de référence réel. Aucune « dernière chance » ni compte à rebours qui se réinitialise.
- Jeux concours, tirages, parrainage avec récompense : ne pas lancer sans règlement écrit ; régime d'autorisation éventuel au Bénin à vérifier par un juriste local.
- Influenceurs et partenariats : mention claire du caractère publicitaire (« Partenariat rémunéré » / « Publicité »).
- Prospection WhatsApp / SMS / e-mail : uniquement avec opt-in prouvé (B3, B7, M7), identification de l'expéditeur, désinscription simple. Éviter d'acheter ou de collecter des listes de numéros.
- Ciblage Meta : pas de ciblage fondé sur des données sensibles ; les audiences issues du Pixel ne servent que si le consentement « publicité » est donné.

## Points conformes

- Opt-in strict et séparation des catégories dans `consent.ts` ; aucune donnée personnelle dans `events.ts` ; exclusion de `/admin` du suivi.
- Pas de fausse rareté dans le code (aucun compte à rebours ; stock réel lu en base).
- Montants calculés côté serveur (`place_order`), prix du panier non fiables côté client : bon pour la loyauté du prix facturé (CGV art. 3).
- Formulaires publics : honeypot, délai mini 2,5 s, limites de longueur, validation Zod, messages d'erreur génériques anti-énumération (connexion, suivi, inscription).
- Avis : nom abrégé affiché (« Afi H. »), un avis par produit, auteur lié au profil, `verified=false` à l'insertion (pas de faux badge généré par le code actuel).
- CGU art. 4 : règles de modération claires ; FAQ et checkout : « Nous ne vous demanderons jamais votre code secret ».
- Bandeau « modèle à valider » et marqueurs `<tbc>` visibles : aucun champ légal inventé.
- Politique de confidentialité mentionne le droit de saisir l'APDP.
- Suppression de compte : `orders.user_id` en `on delete set null` (pièces comptables conservées, dissociées du compte) cohérent avec la conservation légale.
- Prix en FCFA, frais affichés avant validation ; zones et franco lus depuis les réglages (jamais codés en dur dans les textes légaux).

⚠️ Disclaimer : ce review est une évaluation de risque, pas un conseil juridique formel. Les points marqués « à vérifier par un juriste local » (droit béninois, formalités APDP, TVA/facturation e-MECeF, durée comptable, retours, transferts) doivent être confirmés par un avocat ou un conseil fiscal béninois avant publication.
