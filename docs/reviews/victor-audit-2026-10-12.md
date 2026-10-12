# Audit technique, architecture, qualité et SEO technique : Victor (2026-10-12)

Périmètre : dépôt local `C:\Users\LUFFY MKD\waxo` (HEAD `eba17dd`, non poussé) et site en ligne `https://www.waxo.boutique` (déploiement `bfd2e31`), en lecture seule.
Stack détectée : Next 16.4.0 App Router (`src/proxy.ts`), React 19.3, next-intl 4.14.7 (`localePrefix: "always"`, mêmes chemins en FR et en EN), Supabase (client anon sans cookies pour l'ISR, service_role côté serveur), Vercel (ISR 120 s), Vitest 5, Zod 4.

Preuves fraîches :
- `npx tsc --noEmit` : 0 erreur. `npx eslint .` : 0 erreur. `npx vitest run` : 80 fichiers, **990 tests verts**.
- Contrôles HTTP en production (curl) : codes de retour, redirections, `<head>`, sitemap, robots, page 404.

Les audits précédents (`docs/reviews/*-J1.md`) ne traitaient pas le SEO. Je ne reviens pas sur ce qui y est corrigé ; les points encore ouverts qui touchent mon périmètre sont signalés comme tels.

---

## Ce qui est correct (vérifié, rien à faire)

- **Canonique et hreflang** : chaque page publique pose une canonique sur sa propre URL, sans paramètres (vérifié en ligne sur `/fr`, `/en/catalogue`, `/fr/faq`, `/en/cgv`), avec `fr`, `en` et `x-default` = FR. Les fiches produit et pack ont la canonique seule ; leurs hreflang viennent du sitemap (`withSeo(..., { canonicalOnly: true })`). C'est un choix valable.
- **Filtres du catalogue** (`?cat=&col=&sort=&q=&budget=`) : tous ramenés à la canonique `/catalogue`, et le HTML serveur (`CatalogStatic`) contient la liste complète, donc lisible par les robots.
- **Espaces privés** : `noindex, nofollow` sur compte, connexion, inscription, favoris, suivi, commande, merci, avis-boutique et tout `/admin` (vérifié en ligne sur `/admin/connexion`) ; robots.txt les interdit aussi.
- **Redirections** : apex vers www en 308, `/fr/` vers `/fr` en 308, `/` vers `/fr` en 307 (normal avec next-intl, `x-default` = `/fr`).
- **Statuts** : un produit, un pack ou une campagne inconnus renvoient bien **404** en production, ainsi que `/fr/packs` (packs désactivés). Le piège mémorisé « SSG + notFound = 500 » ne se reproduit pas sur Vercel.
- **Sitemap** : 20 URL, **toutes en 200** (vérifiées une par une), avec alternates FR/EN/x-default ; `/packs` et les fiches pack sont retirés quand les packs sont désactivés.
- **`<html lang>`** : `fr` ou `en` selon la langue sur toutes les pages rendues par le layout.
- **Échappement du JSON-LD** (`safeJsonLd` : `<`, U+2028, U+2029) : correct.
- **Structure des titres** : un seul `h1` par page (accueil, catalogue, fiche, pack, campagne, FAQ, pages légales), puis des `h2` dans l'ordre.
- **Surface FR/EN des API publiques** : codes d'erreur traduits côté client ou messages `apiMessage(lang, code)` ; e-mails en `orders.locale`. Rien à signaler hors des points ci-dessous.

---

## Constats

Format : `[Sévérité]` · `fichier:ligne` · confiance · empreinte.

### [Élevé] S1. Aucune donnée structurée Product/Offer ni BreadcrumbList n'est jamais rendue, et le suivi `view_item` s'appuie dessus
- `src/lib/seo/jsonld.ts:66` : `export function productJsonLd(p: ProductLdInput, lang: string, ...)`, et `:94` : `breadcrumbJsonLd`. Ces deux fonctions sont **testées mais jamais appelées**. Le seul `<JsonLd>` du site est `src/app/[lang]/layout.tsx:48` : `<JsonLd data={[organizationJsonLd(), websiteJsonLd(lang)]} />`. L'historique git (`git log -S "productJsonLd("`) ne montre aucun appel, à aucun moment.
- Effet en chaîne sur le suivi : `src/components/tracking/TrackingProvider.tsx:46` : `/** Cherche le JSON-LD Product de la page (posé par productJsonLd) */`. Faute de JSON-LD, la ligne `:111` se rabat sur `items: [item ?? { id: slug, name: document.title.split(" · ")[0], quantity: 1 }]`. L'événement `view_item` (ViewContent côté Meta) part donc avec **le slug comme identifiant et sans prix**, alors que `add_to_cart` et `purchase` envoient l'UUID (`src/components/shop/add-to-cart.ts:25` : `id: product.id`). Les identifiants de contenu Meta et GA4 ne se recoupent pas entre la vue et l'achat.
- **Impact** : aucune fiche n'est éligible aux résultats enrichis produit (prix XOF, disponibilité) ni aux fiches marchandes gratuites de Google. Pas de fil d'Ariane enrichi. Le reciblage et l'attribution Meta par produit sont faussés.
- **Correctif** : dans `src/app/[lang]/(shop)/produit/[slug]/page.tsx`, rendre `<JsonLd data={[productJsonLd({ id: product.id, slug: product.slug, name: product.name, description: product.description, price: product.price, stock: product.stock, imageUrl: product.imageUrl, rating: realRating }, lang), breadcrumbJsonLd([{name: t("home"), path: "/"}, {name: category.label, path: "/catalogue"}, {name: product.name, path: `/produit/${product.slug}`}], lang)]} />`. Même chose pour les fiches pack, avec un `productJsonLd` adapté (`@type: Product`, `sku: "pack:<id>"`).
  **Attention à la note** : `product.rating` mélange les vrais avis et `rating_seed` (`src/lib/catalog/index.ts:46-49`, `ratingOf(seed, seedCount, own)`). Pour `aggregateRating`, ne passer **que les vrais avis** : `seed=false`, `hidden=false`, et `getReviews` ne filtre pas `seed` (`index.ts:231-236`). Sinon, risque de note inventée (règle Helena B1). Ajouter un test de rendu qui vérifie qu'une fiche contient un script `application/ld+json` de `@type: Product`. Ce test protège aussi le suivi.
- Confiance 10/10 · `src/lib/seo/jsonld.ts:66:structured-data`

### [Élevé] S2. Le sélecteur de langue et les liens du panier mènent à une 404 sur les fiches produit et pack dès qu'il existe une traduction anglaise
- `src/components/shop/LangSwitch.tsx:20-23` : `<Link key={l} href={pathname} locale={l} ...>`. Le chemin est conservé tel quel : `/fr/produit/savon-noir` devient `/en/produit/savon-noir`.
- Or le slug anglais est différent : `src/app/admin/(panel)/produits/actions.ts:71-75`, `const base = slugify(name); ... insert({ product_id: productId, locale, name, slug, description })` avec `name = nameEn`. Et `getProductBySlug` ne cherche que dans la langue demandée (`src/lib/catalog/index.ts:211` : `(await allProducts(locale)).find((p) => p.slug === slug)`), donc **404**. Même logique pour les packs (slugs distincts, `src/lib/catalog/packs.ts:50/56`).
- Même défaut dans le tiroir panier : `src/components/shop/CartDrawer.tsx:189`, `const href = l.kind === "pack" ? \`/packs/${l.slug}\` : \`/produit/${l.slug}\``. Le slug est mémorisé dans la langue d'ajout ; après un changement de langue, le lien du panier tombe en 404.
- **Impact** : un visiteur qui passe en anglais sur une fiche arrive sur une page d'erreur, en anglais technique (voir S3). Cela touchera chaque produit saisi avec un nom anglais, donc dès la mise en ligne du vrai catalogue. Les tests ne le voient pas, car les données de démo n'ont pas de slug EN pour les produits.
- **Correctif** (au choix, le premier est le plus robuste) :
  1. Dans les pages produit et pack, si `getProductBySlug(lang, slug)` est nul, chercher le produit par n'importe quel slug, toutes langues confondues (petite fonction `getProductByAnySlug`), puis `permanentRedirect(\`/${lang}/produit/${bonSlug}\`)`. Cela règle d'un coup le sélecteur de langue, le panier, les anciens liens partagés et la suppression d'une traduction EN (le slug EN repasse alors au slug FR, voir `index.ts:178`).
  2. En complément, faire passer à `LangSwitch` les chemins de chaque langue depuis la page (prop ou contexte), pour éviter la redirection.
- Confiance 9/10 (code lu de bout en bout ; non reproductible en ligne tant que le catalogue est vide) · `src/components/shop/LangSwitch.tsx:20:i18n-routing`

### [Moyen] S3. Pages 404 et 500 : page Next par défaut, en anglais, sans `lang`, sans en-tête ni pied de page
- Aucun `not-found.tsx`, `global-not-found.tsx` ni `error.tsx` dans `src/app` (recherche `find`, résultat vide). En production, `/fr/produit/inconnu-xyz` renvoie `<html id="__next_error__">` **sans attribut `lang`**, avec « This page could not be found ». `/en/page-qui-nexiste-pas` renvoie `<title>404: This page could not be found.</title>`.
- Côté erreurs serveur : `src/lib/catalog/index.ts:150-151`, `if (process.env.NEXT_PHASE === "phase-production-build") return []; throw e;`. C'est un choix voulu (l'ISR garde le cache), mais une page **jamais mise en cache** (fiche rendue à la demande pendant une panne Supabase) affiche la page d'erreur brute de Next.
- **Impact** : cul-de-sac pour l'utilisateur (aucun lien vers le catalogue), page en anglais sur un site français, échec axe `html-has-lang`. Le statut 404 reste correct, donc pas de soft-404.
- **Correctif** : `src/app/[lang]/(shop)/not-found.tsx` (serveur, `useTranslations` sans `getTranslations({locale})` dynamique : la langue est déjà fixée par `setRequestLocale` du layout), qui reprend en-tête, pied de page et un lien « Voir le catalogue ». `src/app/[lang]/(shop)/error.tsx` (client, bouton « Réessayer », textes FR/EN via `useLocale`). Pour les URL hors de toute route, `app/global-not-found.tsx` avec `experimental.globalNotFound: true`, `<html lang="fr">`, `import "./globals.css"` : c'est exactement le cas prévu par la doc Next 16 pour un layout racine sous segment dynamique (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md`). Tester ensuite **un slug inconnu** en `next start` et sur une preview Vercel (piège mémorisé `tech-nextintl-ssg-fallback-static-to-dynamic`).
- Confiance 10/10 (vérifié en ligne) · `src/app/[lang]/layout.tsx:42:not-found`

### [Moyen] S4. Open Graph et Twitter identiques sur tout le site : `og:title = "Wá xɔ"`, même description, pas de `og:url`, pas de photo produit
- `src/lib/seo/metadata.ts:68-75` : `withSeo` ne renvoie que `{ ...meta, alternates: ... }`, sans `openGraph` ni `twitter`. Les pages héritent donc de `src/app/[lang]/layout.tsx:35-36` : `openGraph: { ..., title: t("siteName"), description: t("description") }` et `twitter: { ..., title: t("siteName"), ... }` (Next fusionne `openGraph` de façon superficielle).
- Vérifié en ligne : `/en/catalogue`, `/fr/faq` et `/en/cgv` ont tous `og:title="Wá xɔ"` et la description générale du site ; aucune page n'a `og:url`.
- **Impact** : un lien de fiche partagé sur WhatsApp ou Facebook (premier canal d'acquisition au Bénin) affiche « Wá xɔ » et l'image générique « Express », sans le nom, le prix ni la photo du produit.
- **Correctif** : dans `withSeo`, recopier `title` et `description` dans `openGraph` (avec `url: canonical`, `type`, `locale`) et dans `twitter`, et accepter une option `image` pour les fiches. Le helper `pageMetadata` (`metadata.ts:28-55`) fait déjà tout cela, mais n'est appelé nulle part (code mort). Le plus simple : faire de `withSeo` une enveloppe de `pageMetadata`, puis passer `image: product.imageUrl` ou `pack.imageUrl` dans les fiches. Conserver l'`opengraph-image` générée en repli.
- Confiance 10/10 · `src/lib/seo/metadata.ts:68:open-graph`

### [Moyen] S5. Méta-descriptions dupliquées et titre d'accueil réduit à la marque
- Pages sans `description` propre, qui héritent donc de la description du site (`layout.tsx:33`) :
  - `src/app/[lang]/(shop)/catalogue/page.tsx:18` : `withSeo({ title: t("title") }, lang, "/catalogue")` ;
  - `src/components/account/page-meta.ts:14` : `withSeo({ title: t(key) }, ...)` (FAQ, contact) ;
  - `src/components/account/legal/InfoPage.tsx:45` : `withSeo({ title: page.title }, ...)` (à propos, CGV, CGU, confidentialité, mentions, livraison et retours) ;
  - `src/app/[lang]/(shop)/page.tsx:16` : `withSeo({}, lang, "/")`, d'où **`<title>Wá xɔ</title>`** sur l'accueil (vérifié en ligne).
- Fiches : `produit/[slug]/page.tsx:44` passe `description: product.description` entière, sans coupe (Google tronque vers 155 à 160 caractères, et une description en plusieurs paragraphes donne un extrait sale).
- **Impact** : 10 pages par langue partagent la même description. L'accueil ne contient aucun mot-clé (« boutique en ligne », « Cotonou », « livraison ») dans son titre, l'élément qui pèse le plus.
- **Correctif** : ajouter `metaDescription` (FR et EN) dans les messages Catalog, Info.meta et InfoPages, et les passer à `withSeo`. Pour l'accueil, utiliser `title: { absolute: t("homeTitle") }` (par exemple « Wá xɔ · Boutique en ligne à Cotonou, Livraison Express 7 j/7 » ; texte à faire valider par Sofia et Helena). Pour les fiches, ajouter un helper `metaDescription(text, 155)` qui coupe à la limite d'un mot et retire les sauts de ligne.
- Confiance 10/10 · `src/app/[lang]/(shop)/catalogue/page.tsx:18:meta-description`

### [Moyen] S6. Photos produit en `background` CSS : non indexables, sans texte alternatif dans les cartes
- `src/components/shop/ProductCard.tsx:68-72` : `<div aria-hidden="true" ... style={{ background: \`${cssUrl(product.imageUrl)} center/cover no-repeat\` }} />`. Fiche : `produit/[slug]/page.tsx:140-146`, `<div role="img" aria-label={product.name} ... style={{ background: img }} />`. Le site public ne contient **aucun `<img>` ni `next/image`** (`grep`), alors que `next.config.ts` déclare `images.remotePatterns` pour Supabase, sans l'utiliser.
- **Impact** : les photos sont invisibles pour Google Images (canal gratuit pour des « petites choses utiles »). Pas de `srcset` ni de lazy-loading, donc des photos pleine taille sur mobile 3G/4G. L'image de LCP de la fiche n'est pas découvrable par le préchargeur. Pour la performance, Tariq tranchera ; je ne retiens ici que l'angle SEO.
- **Correctif** : remplacer par `next/image` (`fill`, `sizes="(max-width: 640px) 50vw, 25vw"`, `alt={product.name}` sur la fiche, `alt=""` dans la carte puisque le lien porte déjà `aria-label`), avec `priority` sur l'image principale de la fiche. Garder le fond coloré et le mot-clé en dessous.
- Confiance 9/10 · `src/components/shop/ProductCard.tsx:72:image-seo`

### [Moyen] S7. Réglages illisibles : repli silencieux sur des coordonnées factices, ensuite mis en cache par l'ISR
- `src/lib/catalog/index.ts:28-29` : `whatsapp: "+229 01 00 00 00 00", waNumber: "2290100000000"`, `:30` `email: "contact@waxo.bj"`. Et `:276-280` : `catch { /* repli par défaut */ } } return DEFAULT_SETTINGS;`. Avec un délai de 4 s (`:38`), une lenteur passagère de Supabase pendant une régénération ISR **produit une page valide** avec ces valeurs. Next la met en cache 120 s : elle n'est pas rejetée comme une erreur.
- Visible sur `src/app/[lang]/(shop)/contact/page.tsx:35` (`href={\`https://wa.me/${brand.waNumber}\`}`), le pied de page, le bandeau et la FAQ (frais et franco). En plus : `features.packs` repasse à `true` par défaut, donc `/packs` peut répondre 200 au lieu de 404, et `src/app/sitemap.ts:20` (`getPacksEnabled().catch(() => true)`) republie `/packs`.
- C'est l'incohérence inverse de la règle posée le 12/10 pour les produits (« base injoignable = exception, l'ISR garde le cache »). Lien avec l'ancien point Helena B8 (coordonnées factices) : rouvert par ce chemin.
- **Correctif** : aligner `getSettings` sur `fetchDbProducts`. Base configurée et en erreur : lever une exception à l'exécution (l'ISR garde la version précédente), et ne renvoyer `DEFAULT_SETTINGS` que sans Supabase ou pendant le build. Remplacer les valeurs factices par des chaînes vides, et faire masquer le bouton WhatsApp quand `waNumber` est vide. Même traitement pour `getCategories` (`index.ts:112-119` : base vide ou en erreur, retour aux **rayons de démo**, contraire à « base vide = boutique vide »).
- Confiance 8/10 · `src/lib/catalog/index.ts:280:fallback-settings`

### [Moyen] S8. Fiche sans traduction anglaise : contenu français servi sous `/en`, déclaré `hreflang="en"`
- `src/lib/catalog/index.ts:178` : `const tr = p.product_translations.find((t) => t.locale === locale) ?? p.product_translations.find((t) => t.locale === "fr");`, et `src/lib/seo/sitemap-build.ts:37` : `const slug = prod.slugs[l] ?? prod.slugs.fr; // repli FR`. La traduction EN est facultative dans l'admin (`produits/actions.ts`, « EN (facultatif) »).
- **Impact** : `/en/produit/<slug-fr>` est une copie quasi exacte de la page FR (même nom, même description, seule l'interface change), avec une canonique propre et annoncée comme version anglaise. Google la traite en contenu dupliqué et peut afficher l'URL `/en` à des francophones.
- **Correctif** : quand un produit n'a pas de traduction EN, soit canonique de `/en/produit/x` vers `/fr/produit/x` et sortie de l'entrée EN du sitemap, soit `noindex` sur la version EN. Exposer `hasTranslation` dans `Product` pour décider. Même chose pour les packs.
- Confiance 8/10 · `src/lib/seo/sitemap-build.ts:37:hreflang-duplicate`

### [Faible] S9. Fil d'Ariane de la fiche : paramètre de filtre faux, lien vide possible
- `src/app/[lang]/(shop)/produit/[slug]/page.tsx:125` : `` href={category ? `/catalogue?category=${category.id}` : "/catalogue"} `` alors que le catalogue lit `cat` (`src/components/shop/logic.ts:194` : `const cat = get("cat");`). Tous les autres liens utilisent `?cat=` (`HomeSections.tsx:33`, `MegaMenu.tsx:41`). En plus, `:126` `{category?.label ?? ""}` produit un lien **vide** quand le rayon est introuvable.
- **Impact** : le fil d'Ariane ouvre tout le catalogue au lieu du rayon. Lien vide = problème d'accessibilité et lien interne sans ancre.
- **Correctif** : `` `/catalogue?cat=${encodeURIComponent(category.id)}` `` et ne rendre ce maillon que si `category` existe. AUTO-FIX.
- Confiance 10/10 · `src/app/[lang]/(shop)/produit/[slug]/page.tsx:125:broken-link`

### [Faible] S10. JSON-LD Organization minimal ; pas d'OnlineStore ; `@id` du WebSite partagé par deux langues
- `src/app/[lang]/layout.tsx:48` appelle `organizationJsonLd()` **sans argument**, donc ni `contactPoint`, ni `logo`, ni `sameAs` (`src/lib/seo/jsonld.ts:19-33`). `websiteJsonLd` pose le même `@id` (`${base}/#website`, `:40`) avec une `url` et un `inLanguage` différents selon la langue.
- **Impact** : pas de logo dans le panneau de marque Google, pas de coordonnées structurées. Deux définitions différentes d'une même entité.
- **Correctif** : lire `getSettings()` dans le layout (sans cookies, donc compatible ISR) et passer `email` et `phone` ; ajouter `logo: ${base}/icon-512.png`, `sameAs` (réseaux sociaux quand ils existent), et `@type: ["Organization","OnlineStore"]`, `areaServed: "BJ"`. **Pas de `LocalBusiness` ni d'adresse** tant que l'entité légale et une adresse ouverte au public ne sont pas renseignées (ne rien inventer). Pour le WebSite, `@id: ${absoluteUrl(lang,"/")}#website`. La `SearchAction` peut rester, mais Google n'affiche plus le champ de recherche dans les résultats depuis fin 2024 : gain nul.
- Confiance 9/10 · `src/app/[lang]/layout.tsx:48:jsonld-org`

### [Faible] S11. Sitemap : pas de `lastmod`, pages de campagne absentes, rafraîchi seulement toutes les heures
- `src/app/sitemap.ts:15` : `products = fr.map((p) => ({ id: p.id, slugs: {...} }))`, sans `updatedAt`. La table `products` n'a d'ailleurs **pas de colonne `updated_at`** (`supabase/migrations/0001_core.sql:72-86`). `STATIC_PUBLIC_PATHS` (`src/lib/seo/site.ts:10-22`) n'inclut pas les campagnes en cours (`/campagne/[slug]`, indexables, avec hreflang). `revalidate = 3600` (`sitemap.ts:7`), et `revalidatePath("/[lang]", "layout")` dans les actions admin ne touche pas `/sitemap.xml`.
- **Correctif** : migration `alter table products add column updated_at timestamptz not null default now()` plus un trigger `before update`, puis passer `updatedAt` au sitemap. Ajouter les campagnes `running` et `upcoming` (`getLiveCampaigns`). Ajouter `revalidatePath("/sitemap.xml")` dans les actions produits, packs et campagnes.
- Confiance 9/10 · `src/app/sitemap.ts:15:sitemap-lastmod`

### [Faible] S12. Rayons sans page indexable
- Les rayons n'existent que sous la forme `/catalogue?cat=<id>`, ramenée par canonique à `/catalogue` (choix cohérent avec S-OK). Aucune URL de rayon ne peut donc se positionner (« lampe solaire Cotonou », etc.).
- **Correctif (plus tard, quand le catalogue dépasse une trentaine de produits)** : route `/[lang]/rayon/[slug]` statique, avec titre et description propres, en canonique de soi, présente dans le sitemap. Les filtres `?sort=&budget=` restent en canonique vers la page de rayon. Signalé pour mémoire : rien à faire aujourd'hui.
- Confiance 7/10 · `src/lib/seo/site.ts:10:category-landing`

### [Faible] S13. Robots.txt interdit des pages qui portent aussi `noindex`
- `src/app/robots.ts:6-8` interdit `/fr/compte`, `/fr/connexion`, etc., et `page-meta.ts:8` leur pose `noindex`. Google ne peut pas lire un `noindex` sur une URL interdite : si un lien externe y pointe, l'URL peut apparaître sans extrait.
- **Correctif** : retirer ces chemins du `disallow` (garder `/admin` et `/api`) et laisser le `noindex` faire le travail. Faible enjeu.
- Confiance 8/10 · `src/app/robots.ts:8:robots-noindex`

### [Faible] S14. Catalogue vide indexable
- En ligne, `/en/catalogue` affiche « 0 products » et il est présent dans le sitemap. Un catalogue vide exploré maintenant risque d'être classé en soft-404.
- **Correctif** : ne pas soumettre le sitemap dans la Search Console avant la saisie des vrais produits. Ou poser `robots: { index: false }` dans `catalogue/page.tsx:18` tant que `getProducts(lang)` est vide (calcul déjà fait par la page).
- Confiance 7/10 · `src/app/[lang]/(shop)/catalogue/page.tsx:18:soft-404`

---

## Technique général

### [Moyen] T1. Pas de types Supabase générés : le schéma n'est vérifié qu'à l'exécution
- `src/lib/supabase/public.ts:12` : `return createClient(env.url, env.key, ...)` sans paramètre `Database`. D'où des conversions comme `src/lib/catalog/index.ts:177` (`(rows as unknown as DbProductRow[])`) et `src/lib/campaigns/data.ts:60` (`res.data as unknown as Row[]`) : 41 échappements de type (`as unknown as`, `eslint-disable`, `@ts-…`) dans `src`.
- **Impact** : une colonne renommée ou absente (cas déjà rencontré : migration non appliquée, cf. 0018 ci-dessous) passe `tsc` et ne casse qu'en production.
- **Correctif** : `npx supabase gen types typescript --project-id btarkkjimnkmiaxzonzq > src/lib/supabase/database.types.ts` (lecture seule, faisable par Fresnel), puis `createClient<Database>(...)` dans `public.ts`, `admin.ts` et `server.ts`. Supprimer les `as unknown as` au fil de l'eau.
- Confiance 9/10 · `src/lib/supabase/public.ts:12:typing`

### [Faible] T2. `revalidate = 600` des pages d'infos sans effet
- `src/app/[lang]/(shop)/cgv/page.tsx:10` (même chose pour cgu, confidentialité, mentions, livraison, à propos) : `export const revalidate = 600;`, alors que `src/app/[lang]/(shop)/layout.tsx:20` déclare `export const revalidate = 120;`. Next retient **la plus petite** valeur de la route : ces pages se régénèrent toutes les 120 s. Le commentaire « Régénération périodique de secours » est trompeur, mais sans gravité.
- **Correctif** : supprimer ces `revalidate = 600` ou corriger le commentaire. AUTO-FIX.
- Confiance 8/10 · `src/app/[lang]/(shop)/cgv/page.tsx:10:isr-config`

### [Faible] T3. Six implémentations de `withTimeout`
- `src/lib/catalog/index.ts:39`, `src/lib/auth/timeout.ts:2`, `src/lib/admin/data/products.ts:14`, `src/lib/admin/data/pages.ts:29`, `src/app/admin/(panel)/pages/actions.ts:15`, plus des `Promise.race` en ligne (`campaigns/data.ts:54`, `site-reviews/data.ts:18`). Aucune n'annule son `setTimeout`.
- **Correctif** : n'en garder qu'une (`src/lib/auth/timeout.ts`, à déplacer dans `src/lib/timeout.ts`), avec `clearTimeout` en `finally`. AUTO-FIX.
- Confiance 9/10 · `src/lib/catalog/index.ts:39:duplication`

### [Faible] T4. Manifest : promesse périmée et couleur incohérente
- `src/app/manifest.ts:8` : `description: "Les petites choses utiles, livrées demain à Cotonou."`, alors que la promesse actuelle est « Livraison Express le jour même avant 20 h » (`Seo.description`). `theme_color: "#141210"` (`:13`) contredit `viewport.themeColor: "#F4F1EA"` (`[lang]/layout.tsx:19`).
- **Correctif** : reprendre `Seo.description` (texte validé par Helena) et harmoniser la couleur. AUTO-FIX pour la couleur ; ASK pour le texte (claim).
- Confiance 9/10 · `src/app/manifest.ts:8:copy-drift`

### [Faible] T5. Divers
- Avertissement Vitest : « ESM syntax in a file loaded as CommonJS (vitest.config.ts) ». Renommer en `vitest.config.mts`. AUTO-FIX.
- `next.config.ts` : `images.remotePatterns` est configuré, mais `next/image` n'est jamais utilisé (devient utile avec S6).
- Redirection apex en deux sauts (`http://waxo.boutique` → `https://waxo.boutique` → `https://www…`) : réglage du domaine dans Vercel (rediriger l'apex directement vers `https://www`), pas de code.

### Note de déploiement (HEAD `eba17dd`, non poussé)
L'accueil supporte l'absence de la table `site_reviews` (`src/lib/site-reviews/data.ts:19`, `return []`), mais `POST /api/site-reviews` renverra `server_error` tant que la migration **0018** n'est pas appliquée. L'e-mail « Donnez votre avis » pointe déjà vers `/avis-boutique` dans ce même commit. Ordre conseillé : 0018 appliquée par Fresnel, **puis** push.

---

## Annexe (confiance 4 ou moins, non affichée dans le corps)
- Plusieurs lectures complètes du catalogue par rendu de fiche (`generateMetadata`, page, `getProducts`, `getRelatedProducts`, layout). La mémoïsation `fetch` de React les dédoublonne probablement ; non vérifié. Domaine de Tariq.
- `src/app/api/site-reviews/route.ts:71` construit un filtre PostgREST `.or(\`user_id.eq.${userId},phone.eq.${phone}\`)`, sûr seulement si `normPhone` ne garde que des chiffres. Non vérifié ici, domaine de Raphaël.

---

## Plan priorisé

| # | Action | Constats | Effort | Type |
|---|---|---|---|---|
| 1 | Rendre `productJsonLd` + `breadcrumbJsonLd` sur fiches produit et pack (vrais avis seulement) + test de rendu | S1 | S | AUTO-FIX (sauf choix « avis réels seulement », déjà acté par Helena) |
| 2 | Redirection 308 par « slug d'une autre langue » sur fiches produit et pack (corrige le sélecteur de langue, le panier, les anciens liens) | S2 | M | ASK (comportement) |
| 3 | `[lang]/(shop)/not-found.tsx` + `error.tsx` + `global-not-found.tsx` ; tester un slug inconnu en `next start` et sur preview | S3 | M | AUTO-FIX |
| 4 | `withSeo` qui génère Open Graph/Twitter/og:url par page + image produit | S4 | S | AUTO-FIX |
| 5 | Méta-descriptions par page + titre d'accueil avec mots-clés + description de fiche coupée à 155 caractères | S5 | S | ASK (textes : Sofia/Helena) |
| 6 | `getSettings` / `getCategories` : lever une exception en panne au lieu des valeurs factices | S7 | S | ASK (change le comportement en panne) |
| 7 | Photos en `next/image` avec `alt` | S6 | M | ASK (rendu visuel, Mia) |
| 8 | Fiches sans traduction EN : canonique FR ou noindex, retrait du sitemap EN | S8 | S | ASK |
| 9 | Fil d'Ariane `?cat=` + maillon vide ; `revalidate` des pages d'infos ; vitest `.mts` ; `withTimeout` unique | S9, T2, T3, T5 | XS | AUTO-FIX |
| 10 | Organization/OnlineStore enrichi (logo, contact) ; sitemap avec `lastmod` (migration `updated_at`) + campagnes | S10, S11 | S | AUTO-FIX (migration appliquée par Fresnel) |
| 11 | Types Supabase générés | T1 | M | AUTO-FIX |
| 12 | Plus tard : pages de rayon indexables ; robots.txt sans les chemins `noindex` ; manifest | S12, S13, T4 | M | ASK |

**À ne pas oublier côté exploitation** : appliquer 0018 avant de pousser `eba17dd` ; ne soumettre le sitemap à la Search Console qu'une fois les vrais produits saisis (S14).

## Verdict
**Corrections requises.** Aucun bloquant de sécurité ni de données dans mon périmètre ; typecheck, lint et 990 tests au vert ; base SEO saine (canoniques, hreflang, noindex, sitemap 100 % en 200, redirections). En revanche, deux défauts touchent directement la valeur commerciale dès la saisie du vrai catalogue : **S1** (aucune donnée structurée produit, et suivi `view_item` faussé) et **S2** (404 au changement de langue sur les fiches). Les deux doivent être corrigés avant ou avec la mise en ligne des produits. S3 à S7 suivent dans la foulée.
