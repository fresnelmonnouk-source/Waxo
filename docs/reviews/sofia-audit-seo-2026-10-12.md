# Waxo (Wá xɔ) : audit SEO et commercial

Auteure : Sofia (stratégie marketing). Date : 2026-10-12. Mode : lecture seule (code + production https://www.waxo.boutique, relevés du 2026-10-12 vers 10 h 35 UTC).
Documents lus d'abord : `docs/marketing/{funnel-map,lancement-90-jours,marketing-kpis,analytics-stack}.md`, `docs/compliance-checklist.md`, état projet KODY (`Waxo_MEMORY.md`).
Hors périmètre (autres équipes) : rendu visuel, a11y (Mia) ; sécurité, CSP (Raphaël) ; architecture (Victor) ; performance, LCP, poids des images (Tariq). Quand un point touche aussi leur domaine, je ne traite que l'angle SEO ou commercial.

Légende : **[VÉRIFIÉ]** = constaté dans le code ou en production ; **[ESTIMATION]** = ordre de grandeur sans outil de mesure ; **[HYPOTHÈSE]** = à valider par la mesure ; **[À VÉRIFIER]** = information que je n'ai pas pu contrôler moi-même.
Format des constats : `[Sévérité]` · emplacement · problème · impact · correctif.

---

## 0. Synthèse

1. **La base technique est saine** : URL canonique en `www`, redirections 308 depuis l'apex et le http, canonique et hreflang FR/EN par page, pages privées en `noindex` et bloquées dans robots.txt, sitemap dynamique, vraies 404, HSTS. [VÉRIFIÉ]
2. **Ce qui manque, c'est la partie « ce qui se classe et ce qui se partage »** : le titre de l'accueil est seulement « Wá xɔ », toutes les pages ont la même meta description et le même aperçu de partage (og:title « Wá xɔ »), il n'y a pas de données structurées Product, les photos produit sont des fonds CSS (invisibles pour Google Images et pour l'aperçu WhatsApp), et les rayons ne sont pas des pages indexables. [VÉRIFIÉ]
3. **C'est le bon moment pour corriger** : le catalogue est vide. Chaque fiche saisie à partir de maintenant doit être prête pour le SEO dès le premier enregistrement (le slug est figé à la création).
4. **Côté commercial, trois points bloquent toujours l'ouverture** : FedaPay est encore en clés d'essai (sandbox) selon l'état du projet, les mentions légales affichent « [à compléter] » en production, et aucune commande n'enregistre sa source d'acquisition. Les deux derniers étaient déjà signalés le 2026-10-09 et ne sont toujours pas traités.
5. **Mes attentes pour le SEO sont réalistes** : nouveau domaine, aucun lien entrant, marché de recherche de petite taille. Dans les 90 jours, le SEO apportera surtout des recherches sur la marque, des requêtes de longue traîne locales et la fiche Google Business Profile, qui est le levier le plus rapide. Ce n'est pas le canal de volume du trimestre (WhatsApp et Meta le restent, cf. `lancement-90-jours.md`), mais c'est le seul dont les résultats s'accumulent sans budget. Je recommande environ **3 h par semaine**, pas plus.

---

# PARTIE A : stratégie SEO

## A1. Constats techniques SEO (vérifiés)

| # | Sévérité | Emplacement | Problème | Impact | Correctif |
|---|---|---|---|---|---|
| S1 | **[Élevé]** | `src/app/[lang]/(shop)/page.tsx:16` (`withSeo({}, …)`) + `src/app/[lang]/layout.tsx:32` + `src/messages/fr/consent.json:27` ; prod `/fr` et `/en` : `<title>Wá xɔ</title>` | Le titre de l'accueil ne contient que le nom de marque, sans aucun mot-clé (« boutique en ligne », « Cotonou », « livraison »). | L'accueil est la page la plus forte du site, et personne ne cherche encore « Wá xɔ ». Le site est donc invisible sur ses requêtes principales (« boutique en ligne Cotonou », « achat en ligne Bénin »). | Donner à l'accueil un `title` et une `description` propres (FR et EN) via les messages, en suivant le gabarit §A5. Texte à rédiger par Marcus. |
| S2 | **[Élevé]** | `src/lib/seo/jsonld.ts:19-33`, `layout.tsx:32` (template `%s · Wá xɔ`) ; prod : Organization `name: "Wá xɔ"`, pas d'`alternateName` | La graphie ASCII « Waxo », celle que les gens taperont (c'est le domaine), n'apparaît dans aucun titre ni dans les données structurées. « ɔ » (U+0254) est une lettre à part entière, pas un « o » accentué : sa correspondance avec « o » dans les moteurs n'est pas garantie [À VÉRIFIER dans la Search Console]. | Les recherches de marque « waxo » ou « waxo cotonou » risquent de mal remonter. Autre risque : « waxo » peut être confondu avec « wax » (le pagne), très recherché en Afrique de l'Ouest [HYPOTHÈSE, à vérifier dans l'autocomplétion Google depuis le Bénin]. | (1) Mettre `alternateName: ["Waxo", "Wa xo"]` dans l'Organization et le WebSite. (2) Choisir un gabarit de titre qui contient « Waxo » (décision de marque à prendre par Fresnel et Vincent, options au §A5). (3) Ajouter `logo` et `sameAs` (réseaux sociaux) une fois créés. |
| S3 | **[Élevé]** | `src/app/[lang]/layout.tsx:33` ; `catalogue/page.tsx:18` ; `src/components/account/page-meta.ts:14` (faq, contact) ; pages légales via `infoPageMetadata` ; prod : même description sur `/fr`, `/fr/catalogue`, `/fr/faq`, `/fr/contact`, `/fr/a-propos`, `/fr/livraison-retours`, `/fr/mentions-legales` | Une seule meta description, celle du layout, sert à toutes les pages sauf les fiches, les packs et les campagnes. | Les extraits Google sont identiques d'une page à l'autre : la page la plus pertinente n'est pas mise en avant et le taux de clic baisse. | Une clé `metaDescription` par page FR et EN (Marcus), branchée dans chaque `generateMetadata`. |
| S4 | **[Élevé]** | `src/lib/seo/metadata.ts:68-76` (`withSeo` ne pose ni `openGraph` ni `twitter`) ; `layout.tsx:35-36` ; prod `/fr/faq`, `/fr/livraison-retours`, `/en/catalogue` : `og:title="Wá xɔ"`, description générique, pas d'`og:url` | Toutes les pages, fiches produit comprises, héritent de l'aperçu de partage du layout. Le helper `pageMetadata()` (`metadata.ts:28`), qui pose un Open Graph complet, n'est utilisé par aucune page. | **Effet commercial direct.** Un lien produit partagé sur WhatsApp ou Facebook (le canal n°1 du plan) s'affiche comme « Wá xɔ » avec la phrase générique et l'image de marque : ni nom de produit, ni prix, ni photo. | Faire poser à `withSeo` `openGraph: { title, description, url, images }` et `twitter`, ou passer les pages publiques à `pageMetadata`. Sur les fiches produit et les packs, utiliser la photo du produit comme `og:image` (et non l'image générée de `[lang]/opengraph-image`). |
| S5 | **[Élevé]** | `src/lib/seo/jsonld.ts:66` (`productJsonLd`) : importé nulle part (grep sur `src/**/*.tsx`) ; `breadcrumbJsonLd` non plus | La fiche produit n'émet pas de JSON-LD `Product`, alors que la fonction existe, qu'elle est testée et qu'elle refuse les notes inventées. | (a) SEO : pas de résultats enrichis (prix, disponibilité, et plus tard la note) ni d'éligibilité aux fiches marchandes gratuites de Google. (b) Mesure : `TrackingProvider.tsx:46-111` lit ce JSON-LD pour `view_item`. Comme il est absent, l'événement part avec `id = slug` et **sans prix** (repli ligne 111), alors que `add_to_cart` envoie l'UUID (`toItems`). ViewContent et AddToCart ne se rattachent donc pas au même produit côté Meta et GA4 (catalogue Meta, audiences, valeur). | Dans `produit/[slug]/page.tsx`, rendre `<JsonLd data={[productJsonLd({...}, lang), breadcrumbJsonLd([...], lang)]} />`, avec `rating` seulement à partir des vrais avis (`product.rating`). Faire de même pour les packs. Tester ensuite avec le Test des résultats enrichis de Google. |
| S6 | **[Élevé]** | `produit/[slug]/page.tsx:141-146` + `src/components/product/media.ts` (`cssImage` → `background: url(...)`) ; même principe sur les cartes | Les photos produit sont des fonds CSS dans un `div role="img"`, et non des balises `<img>`. | Google Images n'indexe pas les fonds CSS. Pour des requêtes comme « lampe rechargeable prix Bénin », l'onglet Images et les blocs d'images comptent. La photo ne peut pas non plus servir d'`og:image` automatique. | Rendre la photo principale de chaque fiche (et des cartes) avec `<img>` ou `next/image`, et un `alt` = nom du produit + attribut clé. Coordonner avec Tariq (LCP, tailles responsives) et Mia (rendu) : changement unique, trois bénéfices. |
| S7 | **[Élevé]** | `src/components/shop/CatalogView.tsx:25-27,57` (rayons = `?cat=` filtrés côté navigateur) ; `catalogue/page.tsx:18` (canonique `/catalogue`) ; liens `HomeSections.tsx:33`, `MegaMenu.tsx:41`, `MobileNav.tsx:104` | Les 6 rayons (Maison, Cuisine, Beauté, Tech, Bureau, Voyage) n'existent qu'en paramètre d'URL, avec une canonique vers `/catalogue`. Aucune page de rayon n'est indexable. | Les requêtes de catégorie, qui forment le cœur de l'intention d'achat (« ustensiles de cuisine Cotonou », « accessoires téléphone Cotonou »), n'ont pas de page cible. Tout le poids interne se concentre sur `/catalogue`. | Créer de vraies pages de rayon (§A3) : `/[lang]/rayon/[slug]`, rendu serveur, H1 et introduction propres, canonique sur elles-mêmes, présence dans le sitemap. Faire pointer les liens du menu et de l'accueil vers ces pages. `?cat=` reste un filtre d'interface, avec une canonique vers la page de rayon. Spec pour Kody. |
| S8 | **[Moyen]** | `src/components/account/FaqList.tsx:32-36` (`{on ? <p>… : null}`) ; prod `/fr/faq` : seule la réponse 1 est dans le HTML | Les réponses 2 à 8 de la FAQ ne sont pas dans le DOM tant qu'on ne clique pas. | Google et les moteurs à réponse IA ne voient qu'une réponse sur huit. C'est pourtant la page qui répond aux questions qui rassurent (« paiement à la livraison ? », « livrez-vous à Calavi ? »). | Toujours rendre les 8 réponses et les masquer avec `hidden` ou `<details>`, ce qui garde l'accessibilité (à vérifier avec Mia). Option : JSON-LD `FAQPage`. Google ne l'affiche presque plus en résultat enrichi, mais il reste lisible par les moteurs IA. |
| S9 | **[Moyen]** | `produit/[slug]/page.tsx:125` (`/catalogue?category=${id}`) contre `src/components/shop/logic.ts:194` (lit `cat`) | Le fil d'Ariane de la fiche envoie un paramètre `category=` que le catalogue ignore : le lien mène au catalogue complet. | Maillage interne et navigation cassés au niveau du rayon. | Après S7 : lien vers `/rayon/[slug]`. En attendant : `?cat=`. |
| S10 | **[Moyen]** | `src/lib/catalog/index.ts:178` (repli sur la traduction FR) + `src/lib/seo/sitemap-build.ts:37` | Une fiche sans traduction EN est servie en `/en/produit/<slug-fr>` avec le texte français, et déclarée en hreflang `en`. | Contenu dupliqué FR/EN et signal hreflang trompeur, dès que les vrais produits arrivent sans version anglaise. | Règle de saisie : toujours remplir `nameEn` et `descriptionEn`. Garde-fou technique (Kody) : sans traduction EN, la page EN pose une canonique vers la page FR et sort du sitemap EN. |
| S11 | **[Moyen]** | Prod : aucun enregistrement TXT `google-site-verification` (DNS-over-HTTPS : seul le SPF Hostinger existe), aucune meta de vérification, `/BingSiteAuth.xml` en 404. GA4 est en opt-in, donc la balise n'est pas dans le HTML initial et ne peut pas servir à la vérification. | Aucune trace de propriété Search Console ni Bing Webmaster [À VÉRIFIER avec Fresnel]. | Sans ces outils, on ne voit ni l'indexation, ni les requêtes, ni les erreurs. Et GA4 en opt-in sous-estimera fortement le trafic organique, donc la Search Console devient la seule source fiable pour le SEO. | §A10 : propriété de domaine via TXT chez Hostinger, puis import dans Bing. |
| S12 | **[Faible]** | En-tête HTTP `Link` de `/fr` : `x-default` = `https://www.waxo.boutique/` ; HTML : `x-default` = `/fr` | Deux signaux `x-default` différents, l'un dans l'en-tête posé par next-intl, l'autre dans les balises de page. | Faible : Google tolère, mais le signal est incohérent. | Aligner : `alternateLinks: false` dans le routage next-intl (les pages posent déjà leurs hreflang), ou l'inverse. Décision pour Victor ou Kody. |
| S13 | **[Faible]** | `src/app/sitemap.ts:15` (pas d'`updatedAt`) ; `supabase/migrations/0001_core.sql:72-86` (pas de colonne `updated_at` sur `products`) | Pas de `lastmod` sur les fiches. | Recrawl un peu moins efficace quand les prix ou les stocks changent. | Colonne `updated_at` (trigger) transmise au sitemap. Peu urgent. |
| S14 | **[Faible]** | `produit/[slug]/page.tsx:44` (`description: product.description`) | La meta description de la fiche reprend la description complète, sans limite de longueur. | Extrait tronqué par Google, mais acceptable. | Couper proprement à environ 155 caractères. Plus tard, un champ « meta description » facultatif en admin. |
| S15 | **[Faible]** | `src/messages/en/shop.json:210` (« Cash on delivery ») | « Cash » est inexact puisque le paiement Mobile Money est aussi accepté à la livraison. Le terme figure dans la liste de recherche finale de Helena. | Petite incohérence de promesse. | « Pay on delivery » (Marcus). |

**Déjà correct, à ne pas toucher** : canonique en `www` (308), hreflang par page, robots.txt (privé + `/api` + `/admin`), `noindex` sur compte, commande, suivi, favoris et avis-boutique, vraies 404 (`/fr/produit/test` → 404), sitemap qui retire `/packs` quand les packs sont désactivés, slug FR figé à la mise à jour (`produits/actions.ts:191`, les liens partagés ne cassent pas), `aggregateRating` seulement sur de vrais avis.

Note sur l'état actuel : `/fr/packs` et `/fr/avis-boutique` répondent 404 en production (packs désactivés ou vides, et la page d'avis boutique, migration 0018, n'est pas encore déployée). Ce n'est pas un bug, mais il ne faut pas les soumettre à l'indexation avant qu'elles existent.

---

## A2. Univers de mots-clés (Bénin, Cotonou)

**Avertissement méthodologique** : je n'ai aucun outil de volume. Les niveaux ci-dessous sont des **[ESTIMATION]s relatives au marché béninois** : ●●● = parmi les plus recherchées du cluster, ●● = moyen, ● = faible ou longue traîne. Au Bénin, les volumes absolus sont petits : beaucoup de requêtes utiles font quelques dizaines de recherches par mois. On gagne par l'addition de nombreuses requêtes de longue traîne, pas avec 2 ou 3 requêtes vedettes.
Pour mesurer gratuitement (semaine 1) : Google Keyword Planner (compte Google Ads sans dépense, zone « Bénin », langue « français »), Google Trends (région Bénin, comparaison de termes), autocomplétion Google en navigation privée, puis la Search Console après 4 à 6 semaines, qui est la vraie source.

Constat d'usage à intégrer : au Bénin, la recherche transactionnelle passe souvent par la formule **« prix [produit] au Bénin »** ou **« [produit] Cotonou »** [HYPOTHÈSE forte, à confirmer dans l'autocomplétion]. Les fiches et les rayons doivent porter ces formulations naturellement (H1, introduction, alt des images), sans bourrage.

### Cluster 1 : boutique et achat en ligne local (pages : accueil, `/livraison-cotonou-calavi`)
| Requête type (FR) | Intention | Niveau estimé | Page cible |
|---|---|---|---|
| boutique en ligne Cotonou / Bénin | transactionnelle | ●●● | Accueil |
| achat en ligne Bénin, acheter en ligne Cotonou, site de vente en ligne Bénin | transactionnelle | ●●● | Accueil |
| livraison à domicile Cotonou, livraison rapide Cotonou, livraison le jour même Cotonou | transactionnelle locale | ●● | Page Livraison Cotonou & Calavi |
| livraison Abomey-Calavi, livraison Godomey, livraison Fidjrossè / Akpakpa / Cadjèhoun | locale | ● (chacune) | La même page, avec la liste des quartiers. Pas une page par quartier (§A3). |
| paiement à la livraison Cotonou, payer à la livraison Bénin | réassurance | ●● | FAQ + page Livraison |

### Cluster 2 : paiement Mobile Money (pages : FAQ, guide paiement)
| Requête type | Intention | Niveau | Page cible |
|---|---|---|---|
| payer en ligne avec MTN MoMo, paiement MoMo site internet | informationnelle et réassurance | ●● | Guide « Payer en ligne avec MoMo, Moov Money, Celtiis Cash » |
| boutique en ligne paiement mobile money Bénin | transactionnelle | ● | Accueil + guide |
| arnaque achat en ligne Bénin, site fiable Bénin | confiance | ●● | Guide (section sécurité : « ne jamais donner son code secret ») |
| Celtiis Cash paiement en ligne | informationnelle | ● | Guide |

### Cluster 3 : produits par problème et usage (pages : sélections d'usage, rayons, fiches)
À recaler sur le **vrai catalogue** une fois saisi. Exemples cohérents avec les rayons et les sélections déjà présentes sur l'accueil (« Contre les coupures de courant », « Un cadeau à moins de 10 000 F », « Pour mon bureau ») :
| Requête type | Intention | Niveau | Page cible |
|---|---|---|---|
| ventilateur rechargeable Cotonou / prix au Bénin | transactionnelle | ●●● (chaleur et coupures) [HYPOTHÈSE] | Fiche + sélection « Coupures de courant » |
| lampe rechargeable / lampe solaire prix Bénin | transactionnelle | ●● | Fiche + sélection |
| batterie externe (power bank) Cotonou prix | transactionnelle | ●● | Fiche + rayon Tech |
| chargeur rapide 20 W Cotonou, écouteurs Bluetooth Cotonou | transactionnelle | ●● | Fiches + rayon Tech |
| raquette anti-moustique Cotonou | transactionnelle | ●● | Fiche + rayon Maison |
| solution coupure de courant maison | informationnelle | ●● | Guide « Kit coupures » |
| boîtes hermétiques, ustensiles de cuisine Cotonou | transactionnelle | ● | Rayon Cuisine |
| accessoires bureau Cotonou, fournitures bureau livraison Cotonou | transactionnelle | ● | Rayon Bureau + sélection |

### Cluster 4 : cadeaux et saisonnalité (pages : sélection Cadeaux, guides saisonniers, campagnes)
| Requête type | Intention | Niveau | Page cible |
|---|---|---|---|
| idée cadeau Cotonou, cadeau pas cher Bénin | transactionnelle | ●● (pic en décembre) | Sélection « Cadeau à moins de 10 000 F » |
| idée cadeau Noël Bénin / fin d'année | saisonnière | ●● en novembre et décembre | Guide cadeaux (à publier **avant mi-novembre**) |
| cadeau Saint-Valentin Cotonou, fête des mères Bénin | saisonnière | ●● ponctuel | Campagnes avec **slug stable d'une année sur l'autre** (`/campagne/saint-valentin`) |

### Cluster 5 : diaspora et anglophones (EN et FR, à conditions)
| Requête type | Langue | Niveau | Condition |
|---|---|---|---|
| envoyer un cadeau au Bénin depuis la France, faire livrer sa famille à Cotonou | FR | ● à ●● [HYPOTHÈSE] | Paiement par carte réellement actif (FedaPay live) + champ « j'offre à un proche » au checkout. **Phase 2**, voir B-OPP1. |
| online shopping Cotonou, delivery Cotonou, buy [product] Cotonou | EN | ● | Expatriés, ONG, ambassades, résidents nigérians et ghanéens [HYPOTHÈSE]. Les pages EN existent : on les garde propres (S10) sans investir en contenu tant que l'EN fait moins de 15 % des impressions dans la Search Console à la semaine 8. |
| send gift to Benin, gift delivery Cotonou | EN | ● | Même condition que la diaspora FR. |

### Cluster 6 : marque
« waxo », « wá xɔ », « waxo cotonou », « waxo boutique ». Ce cluster grandira avec WhatsApp, TikTok et le bouche-à-oreille. C'est généralement la première source de clics organiques d'une nouvelle boutique [HYPOTHÈSE]. Il faut qu'elle tombe sur l'accueil et sur la fiche Google Business Profile, d'où S2.

---

## A3. Architecture des pages cibles

```
/fr                                   Accueil : « boutique en ligne Cotonou, livrée le jour même », réassurance
├─ /fr/rayon/{maison|cuisine|beaute|tech|bureau|voyage}     [À CRÉER, S7] 6 pages de rayon indexables
├─ /fr/selection/{coupures-de-courant|cadeau-moins-10000|bureau}  [À CRÉER] 3 pages d'usage (les chips existent déjà sur l'accueil)
├─ /fr/produit/{slug}                 Fiches (JSON-LD Product, <img>, OG produit)
├─ /fr/packs, /fr/packs/{slug}        Quand les packs seront actifs
├─ /fr/campagne/{slug}                Slugs saisonniers RÉUTILISÉS chaque année (noel, saint-valentin, rentree)
├─ /fr/livraison-cotonou-calavi       [À CRÉER ou enrichir /livraison-retours] zones, liste des quartiers, heure limite 20 h, 7 j/7, frais, FAQ locale
├─ /fr/guides, /fr/guides/{slug}      [À CRÉER] 6 guides en 90 jours (§A6)
├─ /fr/faq                            Les 8 réponses dans le HTML (S8)
└─ /fr/a-propos, /fr/contact, pages légales
(+ miroir /en/… avec hreflang)
```

Règles :
- **Pas de pages « par quartier » en série** (Akpakpa, Fidjrossè, Cadjèhoun…). Vingt pages quasi identiques sont des pages satellites (*doorway pages*) au sens des règles de Google : risque de déclassement, sans valeur pour le client. On fait **une** page de zones bien faite, avec la liste des quartiers desservis et les délais. Des pages par **ville** (Porto-Novo, Parakou…) ne se justifient que si les conditions diffèrent réellement (48-72 h, transporteur) **et** si la Search Console montre de la demande (semaine 12 ou plus).
- **Pages de rayon** : H1 avec le mot-clé local, introduction de 80 à 150 mots écrite par Marcus (usage réel au Bénin, livraison, paiement), grille de produits rendue côté serveur, 3 à 4 questions-réponses en bas de page, liens vers les sélections d'usage. Une catégorie vide ne doit pas être indexée (`noindex` tant qu'elle a moins de 3 produits actifs) et doit sortir du sitemap.
- **Pages de sélection** : mêmes règles. Elles visent les requêtes par problème (cluster 3), mieux adaptées à une marque inconnue que les requêtes génériques très concurrencées.
- **Les guides renvoient vers les produits et les rayons**, et les fiches renvoient vers le guide lié (« Comment choisir sa batterie externe »). C'est le maillage en cocon, simple.
- **Données structurées** : Organization (+ `alternateName`, `logo`, `sameAs`, `contactPoint` avec le vrai numéro), WebSite, Product et BreadcrumbList sur les fiches, BreadcrumbList sur les rayons, Article sur les guides. Pas de `LocalBusiness` avec adresse tant qu'il n'y a pas d'adresse publique (cohérence avec la fiche Google en zone desservie, §A7).

### Fiche produit prête pour le SEO : checklist de saisie (à donner à Fresnel)
1. **Nom = type de produit + attribut distinctif** (ex. de structure : « Lampe rechargeable LED 3 modes »), pas un nom fantaisie. Le slug est généré au **premier** enregistrement puis figé : il faut avoir le bon nom avant de cliquer sur « Enregistrer ».
2. **Description FR de 120 à 250 mots**, dans cet ordre : à quoi ça sert au quotidien (coupures, chaleur, bureau…), caractéristiques chiffrées **confirmées par le fournisseur** (Helena L4 : autonomie, étanchéité, « sans BPA »…), contenu de la boîte, entretien. La livraison et le paiement sont déjà affichés par le gabarit, inutile de les répéter.
3. **Nom et description EN remplis** (sinon S10).
4. **Photo réelle**, produit en situation, fond propre, au moins 1 200 px. Le schéma n'accepte qu'une image (`image_url`) : une galerie de 3 photos est un plus pour la conversion, à prévoir plus tard.
5. **Bon rayon**, prix réel, stock réel (la disponibilité part dans le JSON-LD).
6. Le champ `keyword`, affiché en grand sur la vignette, peut reprendre le mot-clé court du produit.
7. Avant de saisir les 20 premiers produits, regarder pour chacun l'autocomplétion Google « prix [produit] Bénin » et réutiliser le terme que les gens emploient (« power bank » contre « batterie externe », par exemple).

---

## A4. Gabarits title et meta (règles ; Marcus rédige)

Je ne rédige pas les textes. Voici les règles que Marcus devra respecter :

| Type de page | Title (≤ 60 caractères) | Meta description (140-155 caractères) |
|---|---|---|
| Accueil | [mot-clé principal : boutique en ligne + Cotonou] + [différenciateur : livré le jour même] + marque | promesse 20 h / 7 j/7 Cotonou & Calavi + paiement Mobile Money **ou à la livraison** + incitation à l'action |
| Rayon | [Rayon] + « à Cotonou » ou « au Bénin » + [bénéfice court] + marque | 2-3 exemples de produits du rayon + livraison + paiement |
| Sélection d'usage | [problème ou occasion] + [solution] + Cotonou + marque | ce que la sélection résout + fourchette de prix réelle |
| Fiche produit | [Nom produit] + [attribut ou « prix au Bénin »] + marque. **Pas le prix dans le title** : les campagnes le font varier. | bénéfice + attribut chiffré validé + « livré le jour même à Cotonou si commandé avant 20 h » + paiement |
| Guide | la question telle que les gens la tapent | réponse en une phrase + ce que le guide apporte |
| FAQ, Livraison, Contact | sujet + Cotonou | une ligne de réponse concrète (zones, délais, moyens de paiement) |

**Décision de marque à prendre (Fresnel + Vincent)** pour le gabarit `%s · Wá xɔ` : (a) `%s · Waxo` sur les pages internes et « Wá xɔ (Waxo) » sur l'accueil seulement ; (b) garder « Wá xɔ » partout et compter sur `alternateName` plus les signaux externes (fiche Google, réseaux) pour « waxo ». **Ma recommandation : (a)**. Le logo et le texte visible restent « Wá xɔ », seul le titre de l'onglet et des résultats Google utilise la graphie que les gens tapent. Toute promesse chiffrée (20 h, 7 j/7, frais) passe par Helena, et les titles doivent rester identiques à ce que la page affiche.

---

## A5. Plan de contenu (fondateur seul : 2 contenus par mois au maximum)

Format : guides de 700 à 1 200 mots, utiles, avec photos réelles, chacun lié à 3 à 5 produits. Environ 3 h par guide avec l'aide de Marcus. Pas de blog d'actualités : on ne pourra pas le tenir.

| # | Sujet (angle, pas le titre final) | Cluster | Produits liés | Publication |
|---|---|---|---|---|
| G1 | Payer en ligne avec MTN MoMo, Moov Money ou Celtiis Cash : comment ça marche et comment éviter les arnaques | 2 (confiance) | n/a, mais rassure avant le checkout | S3-S4 |
| G2 | Guide cadeaux de fin d'année à moins de 10 000 F / 20 000 F, livrés à Cotonou | 4 | sélection cadeaux | **S4-S5 (avant le 16 novembre)** : il faut 3 à 6 semaines d'indexation avant le pic de décembre |
| G3 | Coupures de courant : le kit maison (lumière, ventilation, téléphone chargé) | 3 | lampe, ventilateur, batterie, chargeur | S6-S7 |
| G4 | Batterie externe : comment choisir la capacité (mAh) adaptée à son téléphone | 3 | batteries, chargeurs | S8-S9 |
| G5 | Moustiques à la maison : ce qui aide vraiment (sans allégation de santé, relecture Helena) | 3 | raquette, etc. | S10-S11 |
| G6 | Sujet choisi d'après les requêtes émergentes dans la Search Console | selon données | selon données | S12-S13 |

Formats dérivés, même effort : chaque guide donne 2 ou 3 vidéos courtes TikTok / Reels / YouTube Shorts (cf. §A8) et 1 statut WhatsApp. Sujets **à éviter** : ceux où le site ne vend rien, et les comparatifs de marques non vendues.

---

## A6. SEO local

### Google Business Profile (priorité n°1 du SEO local)
- **Type de fiche** : établissement « zone desservie » sans adresse publique (pas de boutique physique, comme l'indique `/fr/contact`). La livraison au domicile des clients rend l'activité éligible selon les règles GBP [À VÉRIFIER dans la version en vigueur des consignes]. La vérification peut demander une vidéo et prendre 1 à 3 semaines : **c'est la raison de lancer la démarche dès la semaine 0**.
- **Zones** : Cotonou, Abomey-Calavi (seulement ce qui est réellement livré en Express).
- **Catégorie principale** : la plus proche du rayon dominant du vrai catalogue, choisie dans la liste officielle. Ne pas inventer de catégorie et ne pas ajouter de mots-clés au nom (interdit par les consignes).
- **Horaires = horaires réels**, une fois corrigées les trois versions contradictoires du site (constat B5).
- **Liens** : site avec UTM `?utm_source=google&utm_medium=organic&utm_campaign=gbp` ; bouton WhatsApp / message ; numéro +229 01 54 55 45 49.
- **Contenu** : 10 photos réelles minimum (produits, emballage, livraison), 1 post par semaine (nouveauté ou offre), réponses à **tous** les avis sous 48 h.
- **Avis Google** : ajouter le lien court de demande d'avis Google au message WhatsApp de J+2 déjà prévu (E5), en complément de l'avis sur le site. Jamais d'incitation, jamais de tri entre clients satisfaits et mécontents (règles Google + Helena). Objectif : au moins 10 avis réels à la semaine 13 [HYPOTHÈSE].
- **Ensuite** : Bing Places (import depuis GBP, 10 minutes). Apple Business Connect est facultatif (part iPhone faible au Bénin [HYPOTHÈSE]).

### NAP (nom, adresse, téléphone) cohérent partout
- **Nom** : une seule forme pour toutes les fiches externes, alignée sur la raison sociale dès qu'elle existe (checklist Helena, section 1). À défaut, « Wá xɔ » partout avec « Waxo » en mention.
- **Adresse** : « Cotonou, Bénin » (sans rue, zone desservie), identique sur le site (pied de page « Cotonou, Bénin » [VÉRIFIÉ]), GBP, Facebook et les annuaires.
- **Téléphone** : +229 01 54 55 45 49, même format partout.
- **E-mail** : le site affiche `commande@waxo.boutique` [VÉRIFIÉ]. Les e-mails transactionnels partent de `commandes@…` d'après l'état du projet [À VÉRIFIER : valeur d'`EMAIL_FROM`]. Choisir une adresse de contact publique unique et vérifier qu'elle reçoit.

---

## A7. Netlinking local réaliste (zéro budget, environ 1 h par semaine)

Objectif : au moins 10 domaines référents réels à la semaine 13 (rapport « Liens » de la Search Console) [HYPOTHÈSE]. Pas de PBN, pas de liens achetés. Les liens sponsorisés (influenceuses) sont marqués `sponsored`.

| Vague | Source | Valeur | Effort |
|---|---|---|---|
| S0-S2 | Profils de marque : GBP, Facebook, Instagram, TikTok, YouTube, LinkedIn (page), WhatsApp Business (lien du site dans le profil) | signaux de marque, contrôle de la page de résultats sur « waxo », `sameAs` | 2 h, une fois |
| S3-S6 | Annuaires et plateformes actifs au Bénin : GoAfricaOnline (section Bénin), CoinAfrique (profil vendeur), annuaires d'entreprises locaux [À VÉRIFIER un par un : site vivant, indexé, sans spam] | lien et citation NAP | 5 à 8 annuaires au maximum |
| S4-S8 | Partenaires naturels : FedaPay (vitrine ou témoignage marchand, à demander), fournisseurs qui ont une page « revendeurs », livreurs partenaires | liens pertinents, rarement refusés | 3 e-mails |
| S5-S9 | Presse et blogs locaux. Angle factuel : « livraison avant 20 h, 7 j/7, paiement à la livraison, une boutique en ligne de Cotonou ». Médias en ligne béninois (par ex. Banouto, La Nouvelle Tribune, 24 Heures au Bénin, Bénin Web TV), blogs tech, podcasts [contacts À VÉRIFIER]. | autorité locale + notoriété | 1 communiqué + 3 propositions personnalisées. Communiqué validé par Helena (promesses chiffrées). |
| S6-S13 | Écosystème : Sèmè City, incubateurs, communautés d'entrepreneurs (listes de startups, événements) | liens durables | opportuniste |
| continu | Guide G1 (paiement, anti-arnaque) : le contenu le plus susceptible d'être cité | liens éditoriaux naturels | partager aux médias après publication |
| S9-S12 | Influenceuses (E4) : lien dans la bio ou la story + mention | trafic et marque plus que SEO | déjà prévu |

---

## A8. Réseaux sociaux et WhatsApp (angle recherche)

- **TikTok et YouTube Shorts sont aussi des moteurs de recherche** : publier les mêmes vidéos de démonstration avec un titre et une légende contenant la requête réelle (« lampe rechargeable prix Cotonou »). Les vidéos YouTube peuvent remonter dans Google, ce qui double l'usage du contenu sans effort supplémentaire.
- **WhatsApp Business** : catalogue de produits avec **lien vers la fiche du site**, lien du site dans le profil, statuts quotidiens (déjà prévus). Pour l'attribution : liens avec `?utm_source=whatsapp&utm_medium=status&utm_campaign=<produit>` (convention `analytics-stack.md` §6).
- **Prérequis technique** : un lien produit partagé doit afficher le produit (S4 + S6). Sans cela, chaque partage WhatsApp gaspille l'aperçu.
- **Profils sociaux affichés sur le site** : aucun champ prévu aujourd'hui (constat B7).

---

## A9. Search Console et Bing Webmaster (semaine 0, 30 minutes, Fresnel)

1. Search Console → « Domaine » `waxo.boutique` → enregistrement TXT à ajouter dans la zone DNS **Hostinger** (là où sont déjà le SPF et les MX). Ce type de propriété couvre `www`, l'apex, le http et le https.
2. Soumettre `https://www.waxo.boutique/sitemap.xml`. **Ne demander l'indexation des pages clés (accueil, rayons, sélections) qu'une fois au moins 20 vrais produits en ligne.** Aujourd'hui l'accueil affiche « 0 produit » dans chaque rayon [VÉRIFIÉ] : la première impression laissée à Google serait celle d'une boutique vide. Le site est déjà public, donc ce n'est pas bloquant, mais il ne faut pas l'accélérer.
3. Associer la Search Console à GA4 (prévu dans `analytics-stack.md` §5.7).
4. Bing Webmaster Tools → « Importer depuis Google Search Console ». Bing alimente aussi certains assistants IA.
5. Suivi hebdomadaire (10 minutes, rattaché au tableau de bord du lundi de `marketing-kpis.md` §4) : rapport Pages (indexées, exclues et pourquoi), requêtes (marque contre hors marque), Améliorations (Product, Breadcrumb).

---

## A10. KPIs SEO

**KPI principal** : **clics organiques hors marque par mois (Search Console)**. C'est le seul chiffre qui montre que le SEO apporte des gens qui ne nous connaissaient pas.
Pourquoi pas GA4 : il est en opt-in, donc le trafic organique y sera sous-estimé dans une proportion inconnue. La Search Console ne dépend d'aucun consentement. Pour les commandes, la source fiable reste la base, à condition que le champ `source` existe (constat B3).

| KPI | Source | S4 | S8 | S13 |
|---|---|---|---|---|
| URL du sitemap indexées | Search Console, Pages | ≥ 80 % | ≥ 90 % | ≥ 90 % |
| Impressions hors marque par mois | Search Console | amorçage | ≥ 800 | ≥ 2 500 |
| **Clics hors marque par mois** | Search Console | — | ≥ 20 | **≥ 60** |
| Requêtes cibles en top 10 (sur un panel de 15, fixé en S2) | Search Console | 0-1 | ≥ 2 | ≥ 4 |
| Actions sur la fiche GBP (appels + WhatsApp + site) par mois | GBP Insights | fiche vérifiée | ≥ 30 | ≥ 80 |
| Avis Google réels | GBP | ≥ 2 | ≥ 5 | ≥ 10 |
| Commandes déclarées « Google / recherche » | base (`source`) | — | ≥ 2 au total | ≥ 3 par mois |
| Domaines référents | Search Console, Liens | ≥ 4 | ≥ 7 | ≥ 10 |

Toutes les cibles sont des **[HYPOTHÈSE]s** de démarrage pour un domaine neuf sur un marché de petite taille, à recalibrer en S6 sur les premières données de la Search Console. Signal d'alerte : si l'indexation reste sous 50 % en S6, le problème est technique ou de qualité (pages trop minces), pas de contenu, et on corrige avant d'écrire davantage.

---

## A11. Calendrier SEO sur 90 jours (S0 = semaine du 12 octobre 2026)

Jamais plus de 3 chantiers SEO en même temps. Les expériences E1-E5 de `lancement-90-jours.md` restent prioritaires sur le temps de Fresnel.

| Semaines | Chantiers (3 au maximum) | Qui | Jalon |
|---|---|---|---|
| **S0-S1** | (1) Correctifs S1-S6 + S8-S9 (titles, metas, OG, JSON-LD, FAQ, fil d'Ariane, `<img>`) ; (2) Search Console + Bing + création de la fiche GBP (vérification en cours) ; (3) décision sur le gabarit de marque (§A4) | Kody, Marcus, Fresnel | Test des résultats enrichis OK sur une fiche de test |
| **S1-S3** | (1) Saisie des vrais produits avec la checklist §A3 (FR + EN) ; (2) pages de rayon indexables (S7) ; (3) profils sociaux créés + `sameAs` | Fresnel, Kody, Marcus | ≥ 20 produits en ligne → soumission du sitemap |
| **S3-S5** | (1) 3 pages de sélection d'usage + page Livraison Cotonou & Calavi ; (2) G1 (paiement) ; (3) **G2 cadeaux de fin d'année publié avant le 16 novembre** | Marcus, Kody | Panel de 15 requêtes fixé |
| **S5-S8** | (1) Annuaires (5-8) + partenaires (FedaPay, fournisseurs) ; (2) communiqué de presse + 3 propositions ; (3) G3 coupures + demande d'avis Google intégrée au message de J+2 | Fresnel, Marcus, Helena | Recalibrage des KPIs en S6 |
| **S9-S11** | (1) Pic de fin d'année : rafraîchir G2, campagne `/campagne/noel` (slug stable) ; (2) G4 ; (3) posts GBP chaque semaine | Fresnel, Marcus | |
| **S12-S13** | (1) Bilan Search Console : 2 requêtes émergentes → 2 pages ou guides (G6) ; (2) décision sur l'EN (seuil de 15 % des impressions) ; (3) décision sur la diaspora (B-OPP1) | Sofia + Fresnel | Bilan SEO à 90 jours |

Charge estimée pour Fresnel : environ 3 h par semaine (saisie produits non comprise).

---

# PARTIE B : audit commercial et CRO

Je ne répète pas `funnel-map.md` et `lancement-90-jours.md`. Je ne reprends que ce qui reste **non fait** ou ce qui est **nouveau**.

## B1. Positionnement

- **Ce qui est fort** : la promesse « commandé avant 20 h, livré le jour même, 7 j/7, dimanche compris » + « payez à la réception » est concrète et différenciante à Cotonou [VÉRIFIÉ sur l'accueil, la bannière et l'image OG]. Le signe de marque « 20 h » (direction Vincent) est bien utilisé dans l'image OG.
- **Ce qui est faible** : cette promesse vit dans la bannière, mais **ni dans le H1** (« Les petites choses utiles, livrées vite chez vous. ») **ni dans le title** (S1). Or le title, le H1 et l'extrait Google sont ce que voit un prospect qui arrive par la recherche. « Petites choses utiles » décrit la catégorie, « 20 h / le jour même / à la livraison » décrit pourquoi acheter ici. Hypothèse **H-POS** : un title et un H1 qui portent « Cotonou + le jour même » améliorent le taux de clic dans la Search Console (comparaison avant/après sur 4 semaines, indicative). Brief Marcus ci-dessous.
- « à petit prix » (meta description globale, `consent.json:28`) est une affirmation de prix non étayée tant que le catalogue réel n'existe pas : à faire valider par Helena ou à retirer.

## B2. Constats commerciaux

| # | Sévérité | Emplacement | Problème | Impact | Correctif |
|---|---|---|---|---|---|
| B1 | **[Critique]** (avant toute vente) | État du projet au 2026-10-11/12 (`Waxo_MEMORY.md` : « FedaPay sandbox… RESTE : passage clés live ») ; prod : accueil, pied de page et meta annoncent « MTN MoMo · Moov Money · Celtiis Cash · Visa · Mastercard » [VÉRIFIÉ pour l'affichage ; le mode sandbox n'est pas vérifiable publiquement, À VÉRIFIER dans l'admin] | Les moyens de paiement en ligne sont annoncés alors que les clés seraient encore en mode essai. La carte (Visa / Mastercard) en particulier doit être activée côté FedaPay. | Un vrai client qui choisit le paiement en ligne échoue, ce qui détruit la confiance d'une marque inconnue, et constitue une promesse non tenue (Helena B9 🔴). | Passer les clés en live (`sk_live_` + `wh_live_`) et faire un paiement réel par moyen de paiement **avant** de publier le premier produit. À défaut, désactiver dans `settings.pay` les moyens non opérationnels (les libellés suivent). |
| B2 | **[Critique]** | https://www.waxo.boutique/fr/mentions-legales : « Éditeur du site [à compléter] … RCCM : [à compléter] · IFU : [à compléter] … [Indiquer ici la formalité APDP…] » [VÉRIFIÉ] | Les mentions légales affichent des trous en production (Helena 🔴, toujours ouvert). | Pour un site inconnu qui demande un paiement Mobile Money, l'identité de l'exploitant est un signal de confiance majeur. Des « [à compléter] » visibles signalent un site non fini, voire douteux. C'est aussi un risque juridique. | Saisir l'entité dans `/admin/reglages` dès que le statut est décidé. En attendant, retirer les lignes vides et la phrase APDP plutôt que d'afficher des crochets (décision Helena). |
| B3 | **[Élevé]** | `supabase/migrations/*.sql` + `src/**` : aucune trace de `source`, `referrer_code`, `utm_*` ni « comment nous avez-vous connus » [VÉRIFIÉ par grep] | Demande du 2026-10-09 (`funnel-map.md` §6) **toujours non faite** : aucune commande ne porte sa source. | Avec le Pixel en opt-out, GA4 en opt-in et WhatsApp hors navigateur, la base est la seule source de vérité, et elle est muette. Impossible de calculer un CAC par canal, ni de savoir si le SEO ou la fiche Google apportent des ventes (KPI §A10). | Colonnes `source` (liste déclarative incluant « Google / recherche ») et `referrer_code` + capture des UTM en première visite, conservées jusqu'à la commande (spec `analytics-stack.md` §9). **À faire avant la première vente.** |
| B4 | **[Élevé]** | `src/components/product/*` et `produit/[slug]/page.tsx` : aucun lien WhatsApp [VÉRIFIÉ par grep] ; `contact/page.tsx:35` et `Footer.tsx:96` : `wa.me/<numéro>` sans message pré-rempli | Pas de bouton « Une question sur ce produit ? WhatsApp » sur la fiche ni au checkout, alors que WhatsApp est le canal n°1 de réassurance du plan. Les liens existants n'ont ni message pré-rempli ni référence. | Fuite de conversions sur les clients qui hésitent (les plus fréquents pour une marque inconnue) et conversations non attribuables. | Bouton WhatsApp secondaire sur la fiche (message pré-rempli : nom du produit + URL + référence) et dans l'étape paiement du checkout. Événement GA4 `contact_whatsapp` avec paramètre `placement`. Texte du message rédigé par Marcus. |
| B5 | **[Moyen]** | Prod pied de page FR **et EN** : « Du lundi au samedi, 24/24 » (réglage `brand.hours` en base ; `Footer.tsx:30` ne traduit que la valeur par défaut) ; `/fr/contact` : « du lundi au samedi, de 8 h à 19 h » ; accueil : « 7 j/7, dimanche compris » et « Assistant en ligne 24 h/24 » ; `shop.json:122` : « Un message WhatsApp dans l'heure » [VÉRIFIÉ] | Quatre affirmations de disponibilité qui se contredisent : « 24/24 » n'est pas compatible avec « 8 h-19 h » ; le service client ferme le dimanche alors que la livraison tourne 7 j/7 ; « dans l'heure » était déjà signalé par Helena (🟠) ; la version EN affiche du français. | Confiance (le client ne sait pas quand il aura une réponse), promesse non tenable (« dans l'heure », « 24/24 »), et horaires de la fiche GBP impossibles à fixer de façon cohérente. | Fresnel décide **une** grille réelle (service client contre livraison contre assistant IA), puis : réglage `brand.hours` corrigé, champ EN dans les réglages ou clé traduite, « dans l'heure » remplacé (Marcus + Helena), mêmes horaires sur la fiche GBP. |
| B6 | **[Moyen]** | Prod `/fr` : rayons « 0 produit », « Nos produits les plus vendus » vide, lien « Les mieux notés » dans le pied de page avec 0 avis [VÉRIFIÉ] | La boutique est publique et vide (purge de la démo, attendu), avec un Pixel Meta actif dès l'arrivée. | Tout trafic envoyé maintenant (publicité, statuts, presse, demande d'indexation) atterrit sur une boutique vide : visite perdue, audiences polluées. | **Règle de lancement** : aucune publicité, aucun statut avec lien, aucune demande d'indexation tant qu'il y a moins de 20 produits avec photo réelle et que B1-B3 ne sont pas réglés. Masquer les blocs « plus vendus » et « mieux notés » tant qu'ils n'ont pas de données réelles (côté rendu : Mia ; côté règle : Helena M5). |
| B7 | **[Moyen]** | `src/lib/settings/schema.ts`, `Footer.tsx` : aucun champ ni lien vers les réseaux sociaux [VÉRIFIÉ] | Aucun lien vers Facebook, Instagram ou TikTok. | Les profils sociaux sont la preuve d'existence que les acheteurs béninois vérifient avant de payer un inconnu [HYPOTHÈSE forte]. Ils alimentent aussi `sameAs` et la page de résultats sur la marque. | Champs `social.facebook / instagram / tiktok` dans les réglages, affichés en pied de page, injectés dans `sameAs`. |
| B8 | **[Moyen]** | `vercel.json` : cron `expire-orders` une fois par jour (03:00) [VÉRIFIÉ] | Toujours ouvert (`funnel-map.md` §4.3, point 13) : une commande Mobile Money abandonnée peut bloquer le stock jusqu'à environ 24 h. | Avec de petits stocks réels au lancement, fausses ruptures sur les produits poussés en publicité. | Déclenchement externe toutes les 15 minutes (cron-job.org ou équivalent, protégé par `CRON_SECRET`) ou plan Pro. Spec pour Kody ou Victor. |
| B9 | **[Moyen]** | `TrackingProvider.tsx:111` (voir S5) | `view_item` / ViewContent sans prix et avec un identifiant (le slug) différent de celui d'`add_to_cart` (l'UUID). | Taux vue → panier faussé par produit, catalogue et audiences Meta inutilisables, valeur absente. | Corrigé avec S5 (JSON-LD Product). Recette : un `view_item` puis un `add_to_cart` sur la même fiche doivent porter le même `item_id`. |
| B10 | **[Faible]** | Rétention : pas de parrainage, pas de code influenceuse, envoi de newsletter non construit, pas d'opt-in WhatsApp marketing [VÉRIFIÉ : aucune trace de `referral` / `coupon` / `parrain`] | Les leviers de réachat et de recommandation de E5 n'ont pas encore de support technique. Seul l'e-mail « Donnez votre avis » existe. | Normal à ce stade, mais E5 démarre en S5. | Garder dans l'ordre : B3 (`referrer_code` couvre le parrainage déclaratif) → script WhatsApp J+2 / J+7 / J+30 (Marcus) → newsletter plus tard. Pas de développement de programme de parrainage avant 30 commandes par mois. |

## B3. Funnel AARRR : où en est-on (état au 2026-10-12)

| Étape | Prêt ? | Bloquant restant |
|---|---|---|
| Acquisition | non | catalogue vide (B6) ; partage WhatsApp sans aperçu produit (S4, S6) ; SEO de base (S1-S3, S7) ; source non capturée (B3) |
| Activation (visite → commande) | partiel | paiement en ligne live (B1) ; WhatsApp sur la fiche (B4) ; mentions légales (B2) ; horaires cohérents (B5) |
| Revenu | partiel | B1 ; marge réelle à mesurer (Hx du plan) |
| Rétention | partiel | e-mail d'avis OK ; scripts WhatsApp J+2 / J+7 / J+30 non rédigés ; newsletter non construite |
| Recommandation | non | `referrer_code` (B3) ; avis Google (§A6) |

**Analytics** : la décision Pixel en opt-out et GA4 en opt-in est actée par Fresnel, je ne la rediscute pas. Conséquence à assumer : Meta verra plus d'événements que GA4, et les deux divergeront durablement. **La base (avec B3) et la Search Console sont les seules sources de vérité.** Ne jamais comparer GA4 et Meta pour juger un canal.

## B4. Opportunité à tester plus tard

**B-OPP1, diaspora (« Commandez depuis l'étranger, livré à votre famille à Cotonou »)**. Le site affiche déjà les prix en € et en $. Hypothèse **H-DIA** : une page dédiée + une case « J'offre à un proche » (nom et téléphone du destinataire, message cadeau) + le paiement par carte live apportent au moins 5 % des commandes en décembre, avec un panier supérieur au panier moyen. Conditions : B1 (carte live) fait, téléphone de l'acheteur international accepté, Helena (CGV : acheteur différent du destinataire). **Pas avant S9** : aucune ressource n'y est consacrée avant que le cœur du plan tourne. Décision en S12-S13 (§A11).

---

## Top 10 des actions priorisées

Classées par impact × urgence, en 3 vagues de 3 ou 4 actions au maximum.

**Vague 1 (avant la première vente, S0-S1)**
1. **Paiement en ligne live et vérifié** (B1) : clés live FedaPay, 1 paiement réel par moyen, moyens non opérationnels désactivés. Fresnel.
2. **Mentions légales sans « [à compléter] »** (B2) + **grille d'horaires unique et cohérente** (B5). Fresnel, Helena, Marcus.
3. **Capture de la source d'acquisition** (B3 : `source`, `referrer_code`, UTM). Kody.
4. **Correctifs SEO et partage** : title et meta par page (S1, S3), Open Graph par page avec la photo produit (S4), JSON-LD Product + Breadcrumb (S5, qui règle aussi B9), `<img>` produit (S6), FAQ dans le HTML (S8), fil d'Ariane (S9), `alternateName` « Waxo » (S2). Kody (specs ci-dessus) + Marcus (textes).

**Vague 2 (S1-S5)**
5. **Search Console (TXT Hostinger) + Bing + fiche Google Business Profile en zone desservie** (§A6, §A9). Fresnel, 1 h.
6. **Saisie des vrais produits avec la checklist SEO** (§A3), FR + EN, garde-fou S10, puis soumission du sitemap à partir de 20 produits. Fresnel.
7. **Pages de rayon indexables (S7) + 3 pages de sélection d'usage + page Livraison Cotonou & Calavi** (§A3). Kody + Marcus.
8. **Bouton WhatsApp sur la fiche et au checkout** avec message pré-rempli et événement GA4 (B4). Kody + Marcus.

**Vague 3 (S4-S13)**
9. **Guide cadeaux de fin d'année publié avant le 16 novembre** (G2), puis G1 et G3. Marcus + Fresnel.
10. **Netlinking local et avis Google** : profils sociaux + `sameAs` (B7), 5 à 8 annuaires, FedaPay et fournisseurs, 1 communiqué de presse, lien d'avis Google dans le message de J+2 (§A6, §A7). Fresnel + Marcus + Helena.

---

## Coordination

### À implémenter par Kody (spécifications)
- S1/S3 : clés `Seo.home.title/description` + `metaDescription` par page (FR et EN), branchées dans chaque `generateMetadata` (accueil, catalogue, FAQ, contact, à propos, livraison, pages légales).
- S4 : `withSeo` pose `openGraph {title, description, url, images, locale}` + `twitter` ; fiche et pack : `images = [photo produit]`.
- S5 : `productJsonLd` + `breadcrumbJsonLd` sur `produit/[slug]` et `packs/[slug]` ; Organization enrichi (`alternateName`, `logo`, `sameAs`, `contactPoint` depuis les réglages).
- S6 : photo principale en `<img>` ou `next/image` avec `alt` (avec Tariq et Mia).
- S7 : route `/[lang]/rayon/[slug]` (rendu serveur, H1, introduction issue d'un nouveau champ `description_fr/en` sur `categories`, canonique propre, sitemap, `noindex` si moins de 3 produits) ; liens du menu et de l'accueil mis à jour ; `?cat=` avec canonique vers le rayon.
- S8 (FAQ rendue en entier), S9 (fil d'Ariane), S10 (canonique EN vers FR si pas de traduction), S12 (`x-default` unique), S13 (`updated_at`).
- B3, B4, B7, B8 comme décrits ci-dessus.
- Plus tard : route `/[lang]/guides/[slug]` (contenu CMS, les pages `pages` existent déjà en admin et peuvent servir de base) + JSON-LD Article.

### Briefs à transmettre à Marcus (je ne rédige aucun texte)
1. **Titles et metas** de toutes les pages publiques FR et EN selon le gabarit §A4. Contraintes : ≤ 60 et 140-155 caractères ; mots-clés « boutique en ligne Cotonou », « livré le jour même », « paiement à la livraison / Mobile Money » ; promesses identiques à la page ; « Waxo » selon la décision de marque.
2. **H1 et sous-titre de l'accueil** qui portent la promesse « Cotonou + le jour même avant 20 h » (H-POS), en gardant le ton de la marque.
3. **Introductions des 6 rayons et des 3 sélections d'usage** (80-150 mots chacune + 3 questions-réponses), FR et EN.
4. **Message WhatsApp pré-rempli** pour la fiche produit et le checkout ; **ligne d'horaires** unique (après décision de Fresnel) ; remplacement de « dans l'heure » ; « Pay on delivery ».
5. **Guides G1 et G2** (plan + rédaction), sujets §A5.
6. **Communiqué de presse** de lancement (une page, factuel) + modèle de proposition aux médias locaux.

### À soumettre à Helena
« à petit prix » (meta), grille d'horaires et « dans l'heure », mentions légales en attendant l'entité (retirer ou afficher), communiqué de presse, demande d'avis Google (sans incitation), guide G5 (aucune allégation de santé), diaspora B-OPP1 (acheteur différent du destinataire).

### À la charge de Fresnel
Clés FedaPay live + paiements réels de test ; entité légale ; décision sur les horaires ; décision sur le gabarit de marque (§A4) ; TXT Search Console chez Hostinger ; création de la fiche GBP et des profils sociaux ; saisie des produits avec la checklist ; envoi des demandes de liens (annuaires, FedaPay, fournisseurs, presse).

### Mesure
- **S4** : indexation ≥ 80 %, fiche GBP vérifiée, JSON-LD Product valide, `item_id` identique entre `view_item` et `add_to_cart`, première commande avec `source` renseignée.
- **S8** : premiers clics hors marque, panel de 15 requêtes, recalibrage des cibles du §A10.
- **S13** : bilan SEO à 90 jours, décisions EN et diaspora.
