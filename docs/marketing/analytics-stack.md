# Waxo (Wá xɔ) — Stack analytics et plan de marquage

Auteure : Sofia. Date : 2026-10-09. Périmètre : spécification de mesure, **aucun code modifié**. Les implémentations sont à faire par Kody / l'agent G3 (`src/lib/tracking/events.ts`). Légende : [DÉMO], [CALCUL], [HYPOTHÈSE] comme dans `funnel-map.md`.

## 1. Stack recommandé (solo, budget faible)

| Besoin | Outil | Coût | Pourquoi / pourquoi pas autre chose |
|---|---|---|---|
| Analyse du site | **GA4** (`NEXT_PUBLIC_GA_ID`) | 0 F | Déjà prévu en J3, gratuit, supporte XOF. Interface lourde mais suffisante. |
| Mesure publicitaire Meta | **Meta Pixel** (`NEXT_PUBLIC_META_PIXEL_ID`) | 0 F | Optimisation et audiences Facebook/Instagram. |
| Mesure des conversations WhatsApp | **Meta Ads Manager (objectif Messages)** + **étiquettes WhatsApp Business** | 0 F | Mesure native hors-site : fonctionne sans consentement navigateur. |
| Vérité commerciale | **Base Supabase** (`orders`, `order_items`, `payments`) + page Statistiques admin | 0 F | Chiffre d'affaires, marge, statuts : la seule source exacte. |
| Santé technique | Sentry (déjà prévu) | 0 F (plan gratuit) | Erreurs de checkout/paiement. |
| Performance 3G | Lighthouse mobile throttlé + PageSpeed Insights | 0 F | Pas d'outil tiers supplémentaire (CSP, poids, consentement). |

Volontairement **exclus au lancement** (règle : outils que le fondateur peut vraiment opérer) : heatmaps (Clarity/Hotjar : poids + consentement + CSP, pas assez de trafic pour exploiter), API de conversion serveur Meta (Stape/CAPI : à reconsidérer au-delà de ~30 commandes/mois ; tout envoi serveur exigera aussi le consentement), outil d'A/B testing (trafic insuffisant, voir `funnel-map.md` §3), Mixpanel/PostHog (doublon de GA4 à ce stade). Tableau de bord : une feuille Google Sheets ou la page Statistiques admin, voir `marketing-kpis.md`.

## 2. Règles communes à tous les événements

1. **Devise** : toujours `currency: "XOF"`. **Valeurs entières** (le XOF n'a pas de décimales) : `8900`, jamais `8900.00` ni `8 900`. [À VÉRIFIER pendant le test : Events Manager et GA4 doivent afficher la valeur en XOF/F CFA ; si Meta refuse la devise, c'est un blocage à remonter.]
2. **`value`** = montant des **produits hors livraison** (somme prix × quantité). La livraison va dans `shipping` (GA4) et `shipping_fee` (propriété Meta personnalisée). Raison : ROAS et marge se calculent sur les produits ; la livraison est quasi neutre (≈ 1 074 F encaissés pour ≈ 920 F de coût [DÉMO/CALCUL]).
3. **Identifiants produit** : `item_id` = identifiant slug du catalogue (`lampe`, `gourde`…) identique dans les deux langues ; packs : `pack_<slug>`. `item_name` = nom français dans les deux langues (cohérence des rapports). `item_category` = rayon en français (`Maison`, `Cuisine`, `Beauté`, `Tech`, `Bureau`, `Voyage`), `Pack` pour les packs.
4. **Paramètre `language`** (`fr` / `en`) sur chaque événement.
5. **Jamais de donnée personnelle** dans un paramètre : pas de nom, téléphone, e-mail, adresse, ni texte libre de l'assistant ou du formulaire de contact. Les identifiants de commande `WX-xxxxx` sont autorisés (non identifiants par eux-mêmes).
6. **Un événement = une action volontaire de l'utilisateur** (pas un rendu). Pas d'événement déclenché à chaque frappe (recherche : à la soumission).
7. **`event_id` Meta** : `<nom>_<clé stable>` (ex. `purchase_WX-10262`, `atc_lampe_<horodatage s>`) pour permettre une déduplication future si API de conversion.
8. **Aucun appel avant consentement** : GA4 ne se charge qu'avec la catégorie "mesure d'audience", le Pixel qu'avec "publicité" (séparés, voir §7).

## 3. Schéma des événements

Notation : `*` = obligatoire. `[ajout]` = événement non prévu dans le brief G3, proposé par Sofia (justification donnée).

### 3.1 `page_view` / `PageView` [ajout côté Meta]
| GA4 | Meta |
|---|---|
| `page_location`*, `page_title`*, `language`* | `PageView` (sans paramètre) |

Déclenché manuellement à chaque navigation (App Router = SPA). Paramétrer GA4 `send_page_view: false` et **désactiver dans le flux GA4 la mesure améliorée "modifications de page basées sur l'historique du navigateur"**, sinon doublons de page_view. `autoConfig=false` côté Pixel n'envoie pas de PageView tout seul : il faut l'appeler (base des audiences de reciblage).

### 3.2 `view_item` ↔ `ViewContent`
| GA4 | Meta |
|---|---|
| `currency`="XOF"*, `value`=prix*, `items`=[{item_id, item_name, item_category, price, quantity:1}]*, `language` | `content_ids`=[slug]*, `content_type`="product"*, `content_name`, `content_category`, `value`*, `currency`*, `eventID` |

Déclenché à l'affichage de la fiche produit (une fois par produit et par page). Packs : `item_category`="Pack".

### 3.3 `add_to_cart` ↔ `AddToCart`
| GA4 | Meta |
|---|---|
| `currency`*, `value`=prix×quantité*, `items`=[{… quantity: q}]*, `language`, `source` (`product`\|`catalog`\|`assistant`\|`pack`) | `content_ids`*, `content_type`="product"*, `contents`=[{id, quantity}]*, `value`*, `currency`*, `eventID` |

`source` (dimension personnalisée) mesure si l'assistant et les packs font vendre.

### 3.4 `begin_checkout` ↔ `InitiateCheckout`
| GA4 | Meta |
|---|---|
| `currency`*, `value`=sous-total produits*, `items`=toutes les lignes*, `language` | `content_ids`*, `contents`*, `num_items`*, `value`*, `currency`*, `eventID` |

Déclenché à l'ouverture de la page de commande (une fois par session de panier).

### 3.5 `add_payment_info` ↔ `AddPaymentInfo` [ajout]
| GA4 | Meta |
|---|---|
| `currency`*, `value`*, `payment_type`* (`momo`\|`moov`\|`celtiis`\|`carte`\|`cod`), `delivery_zone`* (`cotonou`\|`autre`), `items` | `value`, `currency`, `content_ids`, + propriétés `payment_type`, `delivery_zone` |

Déclenché à la **soumission** du formulaire de commande (clic sur "Commander/Payer"), avant l'appel serveur. Justification : sans cet événement, on ne sait pas distinguer l'abandon "avant de choisir" de l'abandon "au moment de payer en mobile money" ; la différence `add_payment_info` − `purchase` (en paiement en ligne) est la mesure directe de l'échec/abandon USSD (friction n°12 de `funnel-map.md`).

### 3.6 `purchase` ↔ `Purchase`
| GA4 | Meta |
|---|---|
| `transaction_id`=`WX-xxxxx`*, `currency`*, `value`=sous-total produits*, `shipping`=frais de livraison*, `payment_type`*, `delivery_zone`*, `items`*, `language` | `value`*, `currency`*, `content_ids`*, `contents`*, `content_type`="product", `num_items`*, `order_id`, `shipping_fee`, `payment_type`, `delivery_zone`, `eventID`=`purchase_WX-xxxxx` |

Règles de déclenchement (critiques) :
- **Paiement en ligne** (MoMo/Moov/Celtiis/carte) : seulement quand le serveur confirme `paid` sur la page de retour. Jamais sur "en attente" ni "échec".
- **COD** : à l'enregistrement de la commande (page de confirmation), avec `payment_type="cod"`.
- **Anti-doublon** : mémoriser `WX-xxxxx` en `localStorage` (clé `waxo:tracked:purchase:<n°>`) ; ne jamais renvoyer au rechargement, retour arrière ou réouverture du lien. C'est compatible avec le consentement (la clé n'existe que si mesure acceptée).
- **Annulations/refus COD** : ne pas tenter de les corriger dans GA4/Meta (pas d'événement `refund` au lancement). Le rapprochement se fait avec la base (§8). Conséquence assumée : GA4/Meta surestiment les ventes COD ; ROAS lu dans Meta = ROAS "brut", ROAS réel calculé en feuille.

### 3.7 `search` ↔ `Search`
| GA4 | Meta |
|---|---|
| `search_term`* (minuscules, ≤ 80 caractères), `results_count`, `language` | `search_string`*, `content_category`="catalog" |

Déclenché à la soumission (Entrée / clic sur la loupe), pas à la frappe. **Garde-fou** : si la chaîne contient `@` ou une suite de ≥ 6 chiffres, ne pas l'envoyer (risque de numéro de téléphone). Ne pas envoyer le texte de l'assistant (c'est un autre flux).
Usage : alimenter la décision de catalogue (recherches sans résultat = produits à ajouter).

### 3.8 `generate_lead` ↔ `Lead`
| GA4 | Meta |
|---|---|
| `lead_type`* (`contact_form`\|`whatsapp_click`\|`newsletter`\|`assistant_handoff`), `method` (`email`\|`whatsapp` pour la newsletter), `language` | `content_category`=`lead_type` |

Le brief G3 ne couvre que "contact" ; **la newsletter, le clic sur le bouton WhatsApp et la redirection d'escalade de l'assistant sont les 3 leads qui comptent le plus** (le canal de vente réel est WhatsApp). Pas de `value` au lancement (inventer une valeur de lead fausserait l'optimisation Meta ; à reconsidérer quand le taux lead → commande est mesuré).

### 3.9 `sign_up` ↔ `CompleteRegistration`
| GA4 | Meta |
|---|---|
| `method` (`email`), `source` (`checkout`\|`account`), `language` | `status`=true, `content_name`="account" |

### 3.10 Événements GA4 seulement [ajouts]
| Événement | Paramètres | Pourquoi |
|---|---|---|
| `assistant_open` | `source` (`hero`\|`search`\|`product`\|`faq`\|`fab`) | L'assistant IA est un différenciateur ; il faut savoir s'il est utilisé. |
| `assistant_result_click` | `item_id`, `mode` (`deterministic`\|`llm`\|`escalation`) | Mesure sa contribution aux ventes (lié à `add_to_cart.source=assistant`). Aucun texte libre. |
| `form_error` | `form` (`checkout`\|`contact`\|`newsletter`), `field` (`phone`\|`address`\|`name`\|`email`), `error_code` | Quantifie la friction téléphone/adresse (funnel-map friction n°7). Max 1 par champ et par session. Jamais la valeur saisie. |

## 4. Tableau de correspondance GA4 ↔ Meta

| Étape | GA4 | Meta Pixel | Notes |
|---|---|---|---|
| Navigation | `page_view` | `PageView` | manuel |
| Fiche produit | `view_item` | `ViewContent` | |
| Ajout panier | `add_to_cart` | `AddToCart` | |
| Début commande | `begin_checkout` | `InitiateCheckout` | |
| Soumission commande | `add_payment_info` | `AddPaymentInfo` | ajout |
| Achat | `purchase` | `Purchase` | `value` = produits, XOF entier |
| Recherche | `search` | `Search` | |
| Lead | `generate_lead` | `Lead` | `lead_type` |
| Inscription | `sign_up` | `CompleteRegistration` | |
| Assistant, erreurs de formulaire | `assistant_*`, `form_error` | (aucun) | GA4 seulement |

Ordre de priorité Meta (Aggregated Event Measurement) à saisir dans Events Manager après vérification du domaine : 1 `Purchase`, 2 `InitiateCheckout`, 3 `AddToCart`, 4 `Lead`, 5 `ViewContent`, 6 `Search`, 7 `CompleteRegistration`, 8 `AddPaymentInfo` [8 maximum par domaine]. Désactiver la "correspondance avancée automatique" (aucune donnée personnelle ne part du site).

## 5. Configuration GA4 à faire dans l'interface (une fois)

1. Flux web unique ; **mesure améliorée : tout désactiver sauf "Défilement" si on veut** (page_view, recherche sur site, clics sortants sont gérés à la main ou inutiles).
2. **Événements clés** : `purchase` et `generate_lead`. Ne pas marquer les autres.
3. **Dimensions personnalisées** (portée événement) : `payment_type`, `delivery_zone`, `lead_type`, `source`, `mode`, `form`, `field`, `error_code`, `language`. Métrique personnalisée : `results_count`. (Toutes dans les limites gratuites.)
4. **Exclusions de référents** : le domaine de la page de paiement FedaPay (à relever lors du premier test réel dans la barre d'adresse ; non connu avec certitude à ce jour). Ne pas exclure `l.facebook.com` ni `lm.facebook.com` (vraies sources de trafic). Sans exclusion FedaPay, l'achat est attribué à "fedapay / referral" au lieu du canal d'origine.
5. **Conservation des données** : 14 mois (maximum). **Signaux Google** et personnalisation publicitaire : désactivés (non utilisés, cohérent avec le consentement).
6. Fuseau horaire du compte : Africa/Porto-Novo (UTC+1, pas d'heure d'été) ; devise du compte : XOF si proposée, sinon laisser les valeurs XOF des événements s'afficher.
7. Compte unique lié à la Search Console quand le domaine de production est connu.

## 6. UTM et attribution

### Convention (minuscules, sans accents, sans espaces, tiret ou underscore)
| Paramètre | Valeurs autorisées | Exemple |
|---|---|---|
| `utm_source` | `facebook`, `instagram`, `tiktok`, `whatsapp`, `influ_<prenom>` (ex. `influ_awa`), `referral`, `newsletter`, `google` | `facebook` |
| `utm_medium` | `paid_social`, `organic_social`, `status` (statut WhatsApp), `dm`, `influence`, `referral`, `email` | `paid_social` |
| `utm_campaign` | `AAMM_theme` | `2610_coupures_courant` |
| `utm_content` | identifiant de visuel/vidéo | `v3_lampe_video` |
| `utm_term` | audience (pub) | `cotonou_25_45` |

Un seul tableau (Google Sheets) liste chaque lien généré : lien, date, campagne, budget. Aucune campagne sans UTM.

### WhatsApp (canal principal, hors navigateur)
- Les liens `wa.me/229XXXXXXXXXX?text=...` doivent contenir un **code de référence** dans le message pré-rempli : « Bonjour Wá xɔ, je viens de la pub (réf C2610A) ». Le code (`C` = campagne, `2610` = AAMM, `A` = variante) est lu par Fresnel et reporté par **étiquette WhatsApp Business** (Nouveau / Intéressé / Commande passée / Livré). Numéro actuel du dépôt : `+229 01 00 00 00 00` = **valeur fictive de démonstration à remplacer** avant tout lancement.
- Pour les pubs "Click-to-WhatsApp", Meta compte nativement les **conversations démarrées** (pas de pixel requis) : c'est la mesure du haut de funnel pour l'expérience 1.
- Au checkout : champ déclaratif "Comment nous avez-vous connus ?" + code éventuel (demande à Kody, voir `funnel-map.md` §6). Il sert de **source de vérité d'attribution** quand le consentement est refusé ou que le canal est WhatsApp.

### Modèle de lecture
Attribution = **déclarative d'abord (base de données), GA4 ensuite (indicatif)**, Meta Ads Manager pour son propre canal. Aucune des trois n'a raison seule : la règle de décision est le **CAC mélangé** (dépenses totales de marketing / nouvelles commandes livrées) et le **CAC par canal déclaré**. Les différences de plus de 30 % entre sources sont normales et ne se "corrigent" pas.

### Pièges techniques à tester
- **Redirection de langue** : une visite `https://<domaine>/?utm_source=…` est redirigée vers `/fr` ou `/en` par next-intl. Vérifier que la chaîne de requête survit (sinon 100 % du trafic payant tombe en "direct"). Test : ouvrir le lien avec UTM, lire `page_location` dans GA4 DebugView.
- Les liens de reciblage et `fbclid` : ne pas les nettoyer côté client avant l'envoi du `page_view`.

## 7. Ce qu'on mesure avant / après consentement

| Donnée | Avant consentement ou refus | Après "Accepter" |
|---|---|---|
| Scripts GA4, Pixel, cookies/stockage de mesure | **Aucun** (zéro requête vers google-analytics.com, googletagmanager.com, facebook.net/com : vérifiable dans l'onglet Réseau) | GA4 si "mesure d'audience" ; Pixel si "publicité" ; choix indépendants |
| Stockage strictement nécessaire | panier, langue, choix de consentement | idem |
| Vérité commerciale (base) | **Oui, toujours** : commandes, paiements, statuts, zone, mode de paiement, source déclarée, abonnés, messages | idem |
| Trafic et funnel navigateur | **Non mesuré** | sessions, `view_item`, `add_to_cart`, `begin_checkout`, etc. |
| Pub Meta | impressions, clics, conversations WhatsApp **mesurés par Meta sur sa plateforme** | + événements du site |
| WhatsApp | étiquettes et réf. de campagne (saisie manuelle) | idem |
| Performance du site | Lighthouse/PageSpeed (outils externes sans suivi des visiteurs) ; Sentry erreurs | idem |
| Taux d'acceptation du bandeau | à proposer (voir ci-dessous) | — |

**Compteur de consentement (recommandation à valider par Helena puis Kody)** : un appel serveur anonyme `POST` à chaque choix, contenant seulement `{analytics: bool, ads: bool, language}`, sans cookie, sans IP stockée, agrégé par jour. Il permet de calculer le **taux d'acceptation** (hypothèse de départ 40 à 60 % [HYPOTHÈSE]) et donc la **couverture** (§8). Si Helena estime que même ce compteur nécessite un cadre, on s'en passe et on estime la couverture par la comparaison GA4/base.

Pas de Consent Mode "avancé" (pings sans cookie avant consentement) : incompatible avec le choix "strict opt-in" déjà retenu ; la perte de couverture est compensée par la base (source de vérité).

**Lecture correcte des rapports** : les volumes absolus (commandes, chiffre d'affaires) viennent de la **base**. Les **taux** (conversion par étape) viennent de GA4 et sont à étiqueter "parmi les visiteurs ayant accepté la mesure" (population probablement plus engagée que la moyenne [HYPOTHÈSE] ; ne pas comparer ces taux à des benchmarks externes sans réserve).

## 8. Qualité des données : vérifications

### 8.1 Recette avant lancement (obligatoire, une fois ; 1 à 2 h)
Outils : GA4 DebugView, Meta Events Manager "Tester les événements", onglet Réseau de Chrome, téléphone Android réel en 3G simulée.

| # | Test | Résultat attendu |
|---|---|---|
| 1 | Arrivée sur le site, bandeau affiché, aucun clic | **0** requête vers Google/Meta |
| 2 | "Refuser" | 0 requête, même après navigation, ajout panier, commande COD ; commande bien en base |
| 3 | "Accepter" mesure seule | requêtes GA4 oui, Pixel non (et inversement) |
| 4 | "Gérer mes cookies" → retirer le consentement | envois arrêtés immédiatement |
| 5 | Navigation entre 3 pages | exactement 1 `page_view` par page (pas de doublon) |
| 6 | `view_item`, `add_to_cart` (qté 2) | `value` = prix × 2, `items` correct, `currency`=XOF, entier |
| 7 | Commande COD complète | 1 `purchase`, `transaction_id`=n° de commande base, `value` = sous-total base |
| 8 | Commande MoMo : paiement abouti | 1 `purchase` seulement après statut payé |
| 9 | Commande MoMo : paiement annulé/échoué | **0** `purchase` |
| 10 | Rechargement / retour arrière sur la page de remerciement | pas de second `purchase` |
| 11 | Mêmes tests avec `/en` | `language`="en", mêmes valeurs |
| 12 | Lien avec UTM + `fbclid` | `page_location` conserve les UTM après redirection de langue |
| 13 | Recherche avec un numéro de téléphone saisi | événement `search` non envoyé |
| 14 | Console | 0 violation CSP (`connect-src` / `script-src` / `img-src` pour www.googletagmanager.com, *.google-analytics.com, *.analytics.google.com, connect.facebook.net, www.facebook.com) |
| 15 | Poids : Lighthouse mobile Slow 4G, avant/après consentement | écart de LCP documenté ; scripts de mesure chargés après interaction |
| 16 | Aucun paramètre ne contient nom/téléphone/e-mail/adresse | inspection des charges utiles de 10 événements |

### 8.2 Contrôles récurrents (voir seuils dans `marketing-kpis.md`)
- **Couverture** = `purchase` GA4 / commandes (payées + COD enregistrées) en base, même période. Attendu 35-70 % [HYPOTHÈSE : acceptation × bloqueurs]. Alerte < 25 % (balise cassée / CSP / bandeau) ou > 105 % (doublons).
- **Cohérence du revenu** : somme des `value` GA4 vs somme des `subtotal` en base, sur les mêmes commandes tracées. Écart attendu : GA4 ≤ base.
- **Doublons** : un `transaction_id` vu plusieurs fois dans GA4 (rapport Exploration) = bug.
- **Trafic "direct" anormal** (> 60 % [HYPOTHÈSE]) avec dépenses de pub actives = UTM perdues.
- **Auto-référence** : "fedapay" ou le domaine du site dans les sources = exclusion mal réglée.
- **Événements orphelins** : plus de `purchase` que de `begin_checkout` sur une semaine = événement mal déclenché.
- **Test mensuel** de 3 commandes réelles (COD, MoMo, EN) après chaque déploiement touchant le checkout ou le consentement.

## 9. Responsabilités et demandes

À implémenter par Kody / G3 (spécification ci-dessus) :
1. Événements 3.1 à 3.10, `add_payment_info`, `assistant_*`, `form_error`, `generate_lead` (newsletter, clic WhatsApp, escalade assistant).
2. Garde anti-doublon `purchase` et garde "search" sans PII.
3. Champs `source` (déclaratif) et `referrer_code` dans la commande, sélecteur au checkout (facultatif).
4. Liens WhatsApp avec code de référence pré-rempli ; remplacer le numéro fictif.
5. Compteur de consentement anonyme (sous réserve de Helena).
6. Vérification que la chaîne de requête (UTM, `fbclid`) survit à la redirection de langue.

À soumettre à Helena : cadre légal du bandeau et du compteur, durée de conservation, mentions dans la politique de confidentialité (GA4, Pixel, finalités, hébergement), et tout chiffre promotionnel (délais, remises, "stock réel", avis).
