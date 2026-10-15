# Victor : revue ingénierie, fiche détaillée + livraison offerte par produit + mot « sans photo » (2026-10-14)

Périmètre : `git diff` non commité (35 fichiers suivis, +498/−113) + 8 fichiers non suivis (0025, `details.ts`,
`free-shipping.ts`, `missing-column.ts`, `ProductDetailsSection.tsx`, 3 tests).
Stack : Next.js 16 App Router (ISR) + Supabase (PostgREST, plpgsql `place_order` SECURITY DEFINER) + next-intl FR/EN, vitest + PGlite.
Contexte prod : 0025 appliquée, 0024 non appliquée.

## Scope drift

- Aucun ajout hors demande. Le refactor en paliers de colonnes (`COLUMN_TIERS`, `ADMIN_TIERS`, `writeProductRow`) est la
  conséquence directe de « 0025 sans 0024 ». Pas de dérive.
- Hors périmètre, pour info : la base de l'assistant (RAG) et la page « Livraison et retours » ne parlent pas de la livraison
  offerte par produit. L'assistant peut donc annoncer un tarif à un client dont le panier serait livré gratuitement. Ce point
  ne bloque pas.

## Vérifié sans finding (lu dans le code)

- `place_order` 0025 comparée à 0015 avec `diff` : seules les 4 lignes marquées « 0025 » changent (déclaration, `select … p.free_shipping`,
  `if not v_free_line`, contrôle des produits d'un pack, branche `v_all_free` du `case`). La branche de franco `freeFrom` est inchangée.
- 0024 ne touche ni `place_order` ni `product_translations` (seulement `products.images` + trigger + check). Appliquer 0024
  APRÈS 0025 est donc sans risque.
- Les 4 combinaisons de migrations sont couvertes côté boutique (`index.ts` COLUMN_TIERS 0 → 3) et côté admin (`ADMIN_TIERS`).
- `writeProductRow` : chaque drapeau (`legacy0025`, `legacyImages`) ne bascule qu'une fois, donc 3 essais suffisent. Le
  `fail(GENERIC)` final ne peut pas être atteint.
- Cohérence estimation ↔ `place_order` dans le sens dangereux (« offerte » affiché alors que la base facture) : seule la
  péremption du cache peut le produire (voir V1). Le reste va dans le sens prudent :
  - un produit inactif fait lever `product_unavailable` ;
  - un pack contenant un produit inactif fait lever `out_of_stock` (filtre `active` sur la mise à jour du stock) ;
  - un id inconnu ou périmé n'est pas dans `free`, donc `cartShipsFree` renvoie false et le site affiche des frais ;
  - quand la lecture retombe sur un palier sans `free_shipping`, `freeShipping` vaut false partout ;
  - les campagnes n'interviennent pas (le franco s'évalue sur `v_sub` après campagne, comme avant).
- `shipping_fee = 0` s'affiche « Offerte » dans `OrderDrawer.tsx:193`, `shop-template.ts:43` et `AccountOrders.tsx:140`.
  L'e-mail client n'affiche que le total. La confirmation utilise le total renvoyé par le serveur.
- `listItem` retire `details` mais garde `freeShipping`, dont `freeShippingIds` a besoin. La fiche (`getProductBySlug`) garde `details`.
- Repli EN : `mergeDetails(detailsFrom(tr), detailsFrom(fr))` fonctionne rubrique par rubrique, y compris sans traduction EN (`tr = fr`).
- Aucun GRANT par colonne sur `products` ni sur `product_translations` : anon lit bien les nouvelles colonnes. Le texte saisi est échappé par React.
- Mot « sans photo » : les 7 rendus de `keyword` sont tous conditionnés à l'absence de photo (grep exhaustif).

## 🟠 IMPORTANTES

**V1. Frais affichés ≠ frais facturés : le garde-fou serveur ne compare que le sous-total**
`src/app/api/checkout/route.ts:196-201`, confiance 9/10 (8 + 1, **MULTI-AGENT CONFIRMÉ** avec Tariq 🟠1).
Empreinte `src/app/api/checkout/route.ts:196:correctness`.
```
const expected = typeof rawObj.expectedSubtotal === "number" && ...
if (now > expected) return fail(lang, "price_changed", { prices });
```
Scénario : le panier n'a que des produits cochés et le client voit « Offerte ». L'admin décoche un produit. La page commande
est en ISR à 60 s, et `/api/checkout/config` répond avec `s-maxage=30, stale-while-revalidate=120`, donc jusqu'à environ 150 s
de décalage. `place_order` facture alors 1 000 F sans `price_changed`. En Mobile Money, l'opérateur réclame un montant plus
élevé que celui affiché. Cela contredit la règle écrite en `route.ts:48` (« refuser … un total plus élevé que celui affiché »).
Avant ce changement, le seul cas possible était une modification des réglages de livraison. Désormais, chaque coche par
produit peut le provoquer.
Correction : le client envoie `expectedShipping` (le `fee` affiché). La route recalcule l'estimation avec `free_shipping` relu
sans cache et renvoie `shipping_changed` en cas de hausse. Autre possibilité : un paramètre `p_max_fee` dans `place_order`.
**ASK** (contrat d'API + éventuellement la signature SQL).

**V2. Les chemins d'écriture et de lecture admin réellement utilisés en prod ne sont pas testés**
`src/app/admin/(panel)/produits/actions.ts:84-107`, `src/lib/admin/data/products.ts:148-168`, confiance 8/10.
Empreinte `src/app/admin/(panel)/produits/actions.ts:91:tests`.
```
if (!legacy0025 && isMissing0025(error)) {
  if (usesMigration0025(input)) return { fail: fail("invalid", NEED_0025) };
```
`grep` dans `tests/` : aucune occurrence de `NEED_0025`, `legacy0025`, `getAdminProducts`, `readAdminRows` ni `detailsColumns`.
`catalog-migration-tiers.test.ts` ne teste que les paliers de la boutique. L'admin en prod passe pourtant par le palier 1
(`free_shipping` + rubriques, sans `images`), et la création passe par `writeProductRow`. Le premier essai échoue sur
`images`, le second réussit avec `free_shipping`. Les rubriques passent ensuite dans `insertTranslation`. Rien de tout cela
n'est vérifié par un test. Une régression pourrait enregistrer une fiche sans ses rubriques, ou bloquer toute sauvegarde,
sans qu'aucun test ne la détecte.
Tests à ajouter :
- création et mise à jour pour les 4 combinaisons 0024/0025 ;
- `NEED_0025` quand la case est cochée ou une rubrique remplie alors que 0025 est absente, avec la vérification que rien n'est écrit ;
- les 4 paliers `ADMIN_TIERS` avec `imagesColumn`/`detailsColumns` attendus ;
- des colonnes de rubriques présentes dans l'insert et l'update de `product_translations`.
**AUTO-FIX** (tests uniquement).

**V3. La page commande dépend maintenant de la lecture complète du catalogue**
`src/app/[lang]/(shop)/commande/page.tsx:34`, confiance 8/10 (**MULTI-AGENT CONFIRMÉ** avec Tariq 🟠2, nuancé).
Empreinte `src/app/[lang]/(shop)/commande/page.tsx:34:reliability`.
```
    getProducts(lang),
    getPacks(lang).catch(() => []),
```
`getProducts` lève `catalog_unavailable` hors build (`index.ts:268`), et sans `.catch`, alors que `getPacks` en a un. Nuance :
`getSettings` levait déjà, et l'ISR garde la page précédente quand la régénération échoue. Le risque réel est donc limité
à une régénération sans version en cache (premier rendu après un déploiement si la base répond mal), et à une lecture plus
lourde (avis, campagnes) sur la page qui encaisse. Correction minimale : `getProducts(lang).catch(() => [])`. C'est le
choix prudent : sans liste, le site affiche les frais et la base peut seulement les offrir. Option plus propre (proposée par
Tariq) : une lecture légère `id, free_shipping`. **AUTO-FIX** pour le `.catch`, **ASK** pour la lecture dédiée.

## 🟡 MINEURES

**V4. Détection de la colonne 0025 manquante : l'expression régulière est trop large**
`src/app/admin/(panel)/produits/actions.ts:76`, confiance 7/10. Empreinte `…/produits/actions.ts:76:maintainability`.
```
const isMissing0025 = (e: DbErr) => isMissingColumn(e) && /free_shipping|color|materials|specs|highlights|uses|care/.test(e?.message ?? "");
```
`writeProductRow` n'écrit que dans `products`, et la seule colonne 0025 de cette table est `free_shipping`. `color|…|uses|care`
ne sert donc à rien et provoque des faux positifs par sous-chaîne (une future colonne ou table contenant `uses` ou `care`,
comme `pauses` ou `skincare`). Dans ce cas, le code bascule en « sans 0025 » et les rubriques ne sont plus écrites, sans
aucun message. Les messages PostgREST actuels (`Could not find the 'images' column of 'products' in the schema cache`) ne
déclenchent pas ce cas aujourd'hui (vérifié). Correction : `/\bfree_shipping\b/`. Ajouter aussi un `console.warn` au
passage en mode legacy (rejoint Tariq 🟡5). **AUTO-FIX**.

**V5. Le panneau « Détails du produit » se replie pendant la saisie**
`src/components/admin/products/ProductDrawer.tsx:286` et `:304`, confiance 7/10. Empreinte `…/ProductDrawer.tsx:286:ux`.
```
<details ... open={hasAnyDetail(v.details) || detailError}>
```
`open` est contrôlé par React. Scénario : l'admin ouvre le panneau, tape « Noir », l'efface pour corriger, et le prop repasse
à `false`. React retire alors l'attribut `open` et le panneau se ferme sous son curseur. Le motif existait déjà sur la
version anglaise, mais le changement l'étend à 6 champs de plus. Correction : calculer l'ouverture une seule fois
(`useState(() => hasAnyDetail(...))`) puis ne forcer `true` que sur erreur. **AUTO-FIX**.

**V6. Couleur et matériaux : les puces ne sont pas retirées, contrairement au bloc**
`src/components/product/ProductDetailsSection.tsx:16`, confiance 9/10. Empreinte `…/ProductDetailsSection.tsx:16:correctness`.
```
<dd className="m-0 text-text">{details[k].split("\n").join(", ")}</dd>
```
Si l'admin saisit « - Noir⏎- Blanc », la fiche affiche « Couleur : - Noir, - Blanc », alors que `detailLines` retire les puces
dans le bloc. De même, une saisie réduite à « - » affiche « Couleur : - » au lieu de masquer la rubrique (le filtre `:13`
teste seulement si la valeur est non vide). Correction : utiliser `detailLines(details[k]).join(", ")` et filtrer sur
`detailLines(details[k]).length > 0`. **AUTO-FIX**.

**V7. Caractéristiques : une ligne sans « : » produit un `<dd>` sans `<dt>`**
`src/components/product/ProductDetailsSection.tsx:41-42`, confiance 8/10. Empreinte `…/ProductDetailsSection.tsx:41:a11y`.
```
{r.label ? <dt className="text-muted">{r.label}</dt> : null}
<dd className={`m-0 text-text ${r.label ? "text-right font-medium" : ""}`}>{r.value}</dd>
```
Dans un `<dl>`, un groupe `<div>` doit contenir au moins un `dt` suivi d'un `dd`. Ce HTML est invalide et axe signale
`definition-list`. Les audits WCAG AA du projet tournent avec axe. Correction : rendre les lignes sans libellé hors du `dl`,
ou passer à une liste ou un tableau simple. **AUTO-FIX**.

**V8. Pack masqué ou fonction packs coupée : le site affiche des frais que la base n'applique pas**
`src/lib/catalog/packs.ts:205` + `src/app/api/checkout/config/route.ts:55`, confiance 6/10 (à confirmer en conditions réelles).
Empreinte `src/lib/catalog/free-shipping.ts:8:consistency`.
```
  return packs.filter(hasRealSaving);
```
Un pack déjà dans le panier peut devenir masqué parce qu'il n'est plus moins cher qu'à l'unité, par exemple pendant une
campagne. Il disparaît alors de `getPacks`, donc de `free`, et le site affiche des frais. `place_order` accepte pourtant tout
pack actif et peut offrir la livraison. L'écart est en faveur du client et la commande d'un pack masqué existait déjà, mais
le récapitulatif ne correspond pas à la confirmation. Correction : construire `free` à partir de `readPackRows` plutôt que de
la liste filtrée, ou refuser les packs masqués dans `place_order`. **ASK**.

**V9. En-tête de migration inexact**
`supabase/migrations/0025_product_details_free_shipping.sql:2`, confiance 9/10 (**MULTI-AGENT CONFIRMÉ** avec Tariq 🟡8).
```
-- 2026-10-13). À exécuter APRÈS 0024, dans l'éditeur SQL Supabase.
```
En prod, 0025 a été appliquée sans 0024, et c'est sans risque (vérifié plus haut). Correction : remplacer par « Indépendante
de 0024 (ordre libre) ». **AUTO-FIX** (commentaire).

## Couverture de tests (vue Victor, Nadia non dispatchée)

Bien couvert :
- 9 scénarios PGlite `place_order` (tout coché, mixte, franco, hors zone, pack) ;
- les fonctions pures `details.ts` ;
- les 4 paliers de la boutique ;
- le rendu de la fiche et le mot « sans photo ».

Manques :
- V2 (admin : écriture et lecture par palier) ;
- un produit inactif dans un pack (Tariq 🟡10) ;
- `CartDrawer` quand `free` est absent ou n'est pas un tableau (le code se protège avec `Array.isArray`, mais aucun test ne le vérifie).

## Sécurité

Rien de bloquant :
- la saisie admin passe par Zod puis `validateProductForm`, et la base ajoute ses CHECK ;
- l'affichage passe par React, donc le texte est échappé ;
- `place_order` garde ses `revoke`/`grant` (testé) ;
- `freeShipping` n'est écrit que par un admin (`assertAdmin`).

## Perf & fiabilité

Voir le rapport de Tariq (`docs/reviews/tariq-livraison-details-2026-10-14.md`). Ce rapport confirme ses 🟠1, 🟠2 et 🟡8.
Je n'ai pas revérifié ses 🟠3 (poids des rubriques dans toutes les lectures) ni ses 🟠4 (écrasement du stock déjà existant).

## Décisions à remonter (ASK, groupées)

1. V1 : ajouter un garde-fou serveur sur les frais (`expectedShipping` → `shipping_changed`) ? Recommandé : oui, avant que des
   produits soient cochés en masse.
2. V3 : lecture dédiée `id, free_shipping` pour la page commande, ou seulement le `.catch` ?
3. V8 : construire `free` sans le filtre `hasRealSaving`, ou laisser l'écart, qui joue en faveur du client ?

## Annexe (confiance ≤ 5 ou informatif)

- Une photo qui ne charge pas (URL cassée) laisse maintenant une case pastel vide, sans le mot. Le mot servait aussi de
  repli visuel (`ProductCard.tsx:63`, `ProductGallery.tsx:103`). C'est un compromis voulu, et c'est acceptable.
- `resetImagesColumnProbe` (`src/lib/catalog/index.ts:257`) remet maintenant tous les paliers à zéro. Le nom est trompeur, ce
  qui est sans conséquence.
- RAG et page « Livraison et retours » : voir la section Scope drift.

## Red-team

Le diff dépasse 200 lignes, donc Zoé doit être dispatchée (seuil gstack), même sans 🔴. Lui transmettre V1 à V9 et le
rapport de Tariq. Pistes : manipulation des frais (cache, ISR, changement de panier pendant le paiement), collision d'id
produit/pack dans `cartShipsFree` (qui ignore `kind`, sans conséquence avec des UUID), soumission de formulaire admin
falsifiée.

## Verdict : ⚠️ Corrections requises (aucun 🔴)

Livrable en l'état, la migration étant déjà appliquée et sûre. À faire de préférence avant que des produits soient cochés :
- V1 (ASK) ;
- V3 (`.catch`) et V2 (tests) ;
- V4 à V7 et V9 en AUTO-FIX groupé (moins de 20 lignes au total).
