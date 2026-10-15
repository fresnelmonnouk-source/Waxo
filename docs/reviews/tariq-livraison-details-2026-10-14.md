# Tariq — Perf & fiabilité : fiche détaillée + livraison offerte par produit (0025) — 2026-10-14

Périmètre : changement NON commité (`git status`) + `supabase/migrations/0025_product_details_free_shipping.sql`
(déjà appliquée en production ; 0024 ne l'est pas). Aucun fichier de code modifié par Tariq.

```
PLAN PERF & FIABILITÉ — TARIQ
Stack : Next.js 16 (App Router, ISR) sur Vercel / Supabase Postgres via PostgREST (supabase-js) / RPC plpgsql place_order
Hot paths / changements data : place_order (chemin argent), ALTER products + product_translations,
  readCatalog (toutes les pages boutique), /api/checkout/config (tiroir panier), /[lang]/commande (ISR 60 s), admin produits
Baseline : 0015 (place_order), lecture catalogue avant 0025. Pas d'accès prod (taille du catalogue inconnue) :
  les tailles sont données en formule, pas en absolu.
```

## Mesures / preuves

- **Diff `place_order` 0015 → 0025** (extraction des deux corps de fonction + `diff`) : uniquement les 5 blocs marqués « 0025 »
  (déclaration `v_free_line`/`v_all_free`, `p.free_shipping` dans le SELECT produit, `if not v_free_line`, EXISTS pack,
  1re branche du CASE `v_fee`). Rien d'autre n'a bougé : plafonds, verrou consultatif, `FOR UPDATE` trié, campagnes,
  revoke/grant identiques. Aucune migration 0016–0024 ne redéfinit `place_order` (grep) : pas de régression silencieuse
  d'une version intermédiaire.
- **Tests** : `npx vitest run tests/free-shipping-pglite.test.ts tests/catalog-migration-tiers.test.ts` → 13/13 verts
  (re-up de 0025, défauts, panier tout coché / mixte / franco / hors zone / pack, CHECK, EXECUTE révoqué, 4 paliers).
- **Charge utile client** : `details` retiré des listes (`listItem`, `src/lib/catalog/index.ts:312-317`) ; la fiche passe aux
  composants client des props explicites (pas l'objet `product`), `ProductDetailsSection` est un composant serveur. OK.

## Verrous et cohérence dans `place_order` (question posée)

- **Ordre des verrous inchangé.** Les ajouts sont des SELECT simples : aucun nouveau verrou de ligne, aucune nouvelle table
  verrouillée. Pas de risque d'interblocage ajouté.
- **La lecture de `p.free_shipping` est APRÈS le `FOR UPDATE`** (`0025…sql:76-82` verrou, `:95` lecture produit, `:120-121`
  EXISTS pack). En READ COMMITTED, chaque instruction plpgsql prend un nouvel instantané : la valeur lue est la dernière
  validée au moment où le verrou est obtenu, et elle ne peut plus changer avant le COMMIT (l'UPDATE admin attend le verrou).
  Les produits des packs sont dans le même ensemble verrouillé (UNION `pack_items`). Scénarios :
  - l'admin décoche PENDANT la commande → son UPDATE attend quelques ms ; la commande garde la livraison offerte (état au
    moment du verrou) : cohérent.
  - l'admin décoche JUSTE AVANT → le `FOR UPDATE` attend son COMMIT puis relit : frais facturés : cohérent côté base
    (mais voir 🟠1 : l'écran du client peut encore afficher « offerte »).
  - Seule faille théorique (préexistante depuis 0008, pas aggravée) : `pack_items` n'est pas verrouillé ; une recomposition
    de pack validée entre le verrou et la boucle ferait lire un produit non verrouillé. Négligeable à ce volume.
- **Coût ajouté** : branche produit = 1 colonne de plus dans un SELECT par clé primaire (≈0) ; branche pack = 1 EXISTS par
  ligne pack, `pack_items` par préfixe de PK `(pack_id, product_id)` ⋈ `products` par PK, sur des lignes déjà en cache
  (venant d'être verrouillées). Borné par les plafonds (≤ 50 lignes, ≤ 60 unités dépliées) : microsecondes. Pas de régression.
- EXISTS sans filtre `p.active` : sans effet (un composant inactif fait de toute façon échouer en `out_of_stock` ligne 126).

## ALTER TABLE (déjà appliqué — pour mémoire et pour le down)

- `product_translations` (`0025…sql:16-22`) : un seul ALTER pour les 6 colonnes (= un seul verrou). `DEFAULT ''` constant →
  PAS de réécriture (valeur par défaut « rapide », PG ≥ 11). En revanche les CHECK ajoutés sans `NOT VALID` imposent un
  **parcours de validation** de la table sous verrou ACCESS EXCLUSIVE : table minuscule (≤ 2 lignes par produit) → ms.
- `products` (`:24`) : booléen NOT NULL DEFAULT false constant, sans CHECK → métadonnées seulement, verrou bref.
- Le vrai risque de ces ALTER n'est pas la durée mais la **file d'attente du verrou** : derrière une transaction longue
  (onglet SQL Editor resté ouvert), l'ACCESS EXCLUSIVE bloque toutes les lectures du catalogue et `place_order`. À prévoir
  pour le down : `set local lock_timeout = '3s'`.
- Rejouable confirmé : `add column if not exists` saute aussi le CHECK de la colonne existante (pas de contrainte en double).
- Expand-contract respecté : colonnes additives avec défaut ; ancien code + nouvelle fonction = comportement 0015 tant
  qu'aucun produit n'est coché (tout est `false`).

---

```
RAPPORT PERF & FIABILITÉ — TARIQ
```

### 🔴 CRITIQUES

Aucun.

### 🟠 IMPORTANTES

**🟠1. Frais affichés ≠ frais facturés quand l'admin décoche « livraison offerte » : aucun garde-fou serveur sur les frais**
— `src/app/api/checkout/route.ts:194-203`, `src/components/checkout/CheckoutFlow.tsx:149-151` — confiance 8/10 —
empreinte `src/app/api/checkout/route.ts:196:reliability`
- Scénario : un client ouvre `/fr/commande` (page statique, `freeShippingIds` figés dans le HTML) avec un panier tout coché,
  Cotonou → « Total 8 000 F, livraison offerte ». L'admin décoche le produit. Le client clique « Confirmer — 8 000 F » (COD) :
  `place_order` facture 1 000 F de frais → le livreur encaisse 9 000 F. Même chose depuis le tiroir panier
  (`/api/checkout/config` en cache CDN `s-maxage=30, stale-while-revalidate=120` → jusqu'à ~150 s de retard).
  Le garde `expectedSubtotal` ne couvre que le sous-total, pas les frais. Le sens inverse (case cochée entre-temps) est
  bénin : le client paie moins qu'annoncé.
- Délais de propagation mesurés dans le code : page commande → `revalidatePath("/[lang]","layout")` (actions.ts:34)
  la régénère à la visite suivante (doc Next 16) ; API config → ≤ 30 s + 120 s SWR (non purgée par `revalidatePath`) ;
  onglet déjà ouvert → illimité jusqu'au rechargement. C'est ce dernier cas qui compte.
- Correctif : envoyer `expectedShipping` (le `fee` affiché) à côté de `expectedSubtotal` ; avant `place_order`, si les frais
  recalculés (même règle que `shippingFee` + lecture `free_shipping` des ids du panier) sont SUPÉRIEURS → refuser avec un code
  `shipping_changed` (409, même UX que `price_changed`, le client renvoie les ids `free` à jour). Variante atomique plus tard :
  paramètre `p_expected_fee` dans `place_order` (nouvelle migration, garder l'ancienne signature).

**🟠2. La page commande dépend maintenant de la lecture complète du catalogue (avis + campagnes) pour une simple liste d'ids**
— `src/app/[lang]/(shop)/commande/page.tsx:31-36,42` — confiance 8/10 — empreinte `src/app/[lang]/(shop)/commande/page.tsx:34:reliability`
- Avant : `getSettings` + `onlinePaymentReady`. Maintenant + `getProducts(lang)` = `readProductRows` (1 à 2 requêtes, 4 s
  max chacune) + `readRealRatings` (TOUS les avis, par pages de 1 000, séquentiel) + `getLiveCampaigns`, pour n'utiliser que
  `id` + `freeShipping`. `getProducts` n'est PAS rattrapé (contrairement à `getPacks(...).catch(() => [])`) : si la lecture
  produits expire au moment d'une régénération sans version en cache (1re visite après déploiement, la version de build
  ayant `[]`), la page de PAIEMENT tombe en erreur alors que la donnée n'est qu'une estimation.
- Correctif : (a) lecture dédiée légère et tolérante, p. ex. `getFreeShippingIds()` =
  `products.select("id").eq("active",true).eq("free_shipping",true)` + packs, `catch → []` (l'erreur est sans risque :
  `[]` = frais affichés, la base facture moins) ; ou (b) au minimum `getProducts(lang).catch(() => [])`.
  Option (c) plus propre : la page commande réutilise `free` de `/api/checkout/config` (déjà filtré par le panier) au lieu
  d'une liste globale embarquée dans le HTML.

**🟠3. Toutes les lectures du catalogue tirent les 6 rubriques des 2 langues — y compris l'API panier non mise en cache par panier**
— `src/lib/catalog/index.ts:225-231,262-272` — confiance 7/10 — empreinte `src/lib/catalog/index.ts:226:perf`
- Indicateur de taille : par traduction, jusqu'à 2×200 + 4×3 000 = 12 400 caractères ; ~1–1,5 Ko réalistes une fois
  remplies → ≈ 2–3 Ko par produit (2 langues). Même vides, les 6 clés JSON coûtent ≈ 140 o/produit.
  Avec N produits : base→fonction ≈ N × 3 Ko par lecture (200 produits ≈ 600 Ko, contre ~100 Ko avant). Aujourd'hui le
  delta réel ≈ 0 (rubriques vides) : il grandira à mesure que l'admin remplit les fiches.
- Multiplicateur : `/api/checkout/config` a la liste des ids du panier dans l'URL → clé de cache CDN quasi unique par
  panier → presque chaque ouverture du tiroir = lecture complète. Même chose pour chaque régénération ISR (accueil,
  catalogue, chaque fiche, commande).
- Correctif : retirer `DETAIL_KEYS` de `COLUMN_TIERS` ; lire les rubriques seulement pour la fiche (requête ciblée
  `product_translations.select(DETAIL_KEYS).eq("product_id", id)`, tolérante à la colonne absente). Mesurer avant/après la
  taille de la réponse PostgREST (`content-length`) sur l'API config.

**🟠4. Défaut préexistant aggravé : enregistrer une fiche réécrit le stock avec la valeur chargée (vente perdue / survente)**
— `src/app/admin/(panel)/produits/actions.ts:231-240` (`stock: input.stock`), `src/components/admin/products/ProductDrawer.tsx:39`
— confiance 8/10 — empreinte `src/app/admin/(panel)/produits/actions.ts:235:reliability`
- Scénario : l'admin ouvre la liste (stock 10), remplit les rubriques d'un produit pendant 5 min ; entre-temps 2 ventes
  (stock 8) ; il enregistre → stock remis à 10 → 2 unités vendues deux fois. Pas nouveau, mais 0025 va faire repasser
  l'admin sur CHAQUE fiche (rubriques + case) : l'exposition augmente fortement.
- Correctif : concurrence optimiste — envoyer aussi le stock d'origine et faire
  `update … where id = $id and stock = $stock_origine` ; 0 ligne → « Le stock a changé (vente en cours), rechargez ».
  Ou n'écrire `stock` que s'il a été modifié dans le formulaire.

### 🟡 MINEURES

**🟡5. Paliers de lecture : dégradation silencieuse, sans log** — `src/lib/catalog/index.ts:239-254`,
`src/lib/admin/data/products.ts:157-168` — empreinte `src/lib/catalog/index.ts:251:observability`
- Logique vérifiée correcte : timeout → exception (pas de dégradation) ; erreur autre que 42703/PGRST204 → exception
  `catalog_unavailable` (ISR garde la version en cache) ; mémo remis à 0 après 10 min puis réarmé.
- Mais une faute de frappe future dans `DETAIL_KEYS` (ou une colonne renommée) = 42703 → palier inférieur à vie, rubriques
  et livraison offerte disparues de la boutique sans aucune trace. Correctif : `console.warn("[catalog] palier", i, error.message)`
  au changement de palier (1 fois par instance / 10 min).
- Coût actuel en prod (0025 oui, 0024 non) : +1 requête en échec (~20–50 ms) par instance froide puis toutes les 10 min.
  Mémo par instance (module), non partagé entre instances serverless : acceptable à ce coût. Admin : pas de mémo → 2 requêtes
  séquentielles à chaque affichage de la liste (6 s de timeout chacune) ; acceptable, à mémoriser si l'admin rame.
- Quand 0024 sera appliquée : une instance chaude reste au palier 1 jusqu'à 10 min ; une page régénérée pendant ce temps
  garde une seule photo jusqu'à sa prochaine régénération (fiche : `revalidate=120`). Prévoir ≈ 12 min, ou redéployer juste
  après l'application de 0024 pour vider les mémos.

**🟡6. Liste globale `freeShippingIds` embarquée dans le HTML de la page commande** — `src/app/[lang]/(shop)/commande/page.tsx:42`
- ≈ 40 o par id coché (produits + packs), présent deux fois (HTML + flux RSC) : 200 cochés ≈ 16 Ko par chargement de la
  page de paiement (réseau mobile ouest-africain). Résolu par l'option (c) de 🟠2.

**🟡7. Charge utile admin** — `src/lib/admin/data/products.ts:148-154,86`
- Les 200 produits partent au composant client avec les rubriques FR+EN : jusqu'à 200 × 24,8 Ko au pire théorique, quelques
  centaines de Ko en réaliste. Admin seulement ; si la liste ralentit, charger les rubriques à l'ouverture du tiroir.

**🟡8. En-tête de migration inexact** — `supabase/migrations/0025_product_details_free_shipping.sql:2`
- « À exécuter APRÈS 0024 » : faux en pratique (appliquée sans 0024) et sans dépendance réelle (0025 ne touche ni `images`
  ni ses triggers ; 0024 ne redéfinit pas `place_order`). Corriger en « indépendante de 0024 », pour qu'un futur
  replay ne fasse pas croire à un ordre obligatoire.

**🟡9. Fenêtre après déploiement** — build : `readCatalog` rend `[]` (`index.ts:269`) → page commande prérendue sans
aucun id coché → pendant ≤ 60 s (puis régénération), frais affichés alors que la base n'en facture pas. Sens bénin, à savoir.

**🟡10. Tests manquants** — `tests/free-shipping-pglite.test.ts` : pas de cas « produit d'un pack inactif » ni de cas
« palier 0 en erreur NON colonne → exception » dans `tests/catalog-migration-tiers.test.ts` (à vérifier/ajouter) ;
pas de test du down (à créer avec lui, cf. ci-dessous).

---

## Migration de données : ✅ sûre (expand-only, déjà appliquée) — réversibilité 4/5 — down À AJOUTER (non bloquant)

Oui, il faut un `supabase/0025_down.sql`, pour la parité avec 0008/0015 et parce que le retour arrière a un **piège
d'ordre** :

1. **ORDRE IMPÉRATIF** : restaurer `place_order` de 0015 (copie EXACTE de `0015_campaigns.sql:111-224` + revoke/grant)
   **AVANT** tout `drop column free_shipping`. Sinon `place_order` 0025 lit une colonne disparue → erreur 42703 à
   l'exécution → **100 % des commandes échouent**.
2. `set local lock_timeout = '3s'` en tête (ALTER = ACCESS EXCLUSIVE sur `products`, la table du chemin argent).
3. Les `drop column` doivent être **optionnels et commentés** : ils détruisent le contenu saisi (rubriques) — c'est la
   seule partie non réversible (d'où 4/5). Recommandation : NE PAS les supprimer en cas d'incident ; les colonnes sont
   inoffensives et le nouveau code sait vivre avec ou sans (paliers + `writeProductRow`). Si suppression : exporter
   d'abord `select product_id, locale, color, materials, specs, highlights, uses, care from product_translations where …<>''`
   en CSV depuis l'éditeur SQL.
4. Cohérence code ↔ base au retour arrière : si seule la fonction est restaurée alors que le nouveau code reste en ligne, le
   site affichera « livraison offerte » (colonne toujours lue) mais la base facturera → soit revenir aussi au code
   précédent, soit `update public.products set free_shipping = false;` dans le down.
5. À valider sur PGlite comme 0015 : up → down → place_order OK sur panier tout coché (frais facturés) → re-up.

Squelette proposé (Kody l'écrit) :

```sql
-- Waxo 0025_down (proposition Tariq) : retour au comportement d'avant 0025. NE PAS exécuter sauf incident.
-- ORDRE IMPÉRATIF : place_order de 0015 restaurée AVANT tout retrait de products.free_shipping.
begin;
set local lock_timeout = '3s';
create or replace function public.place_order(...)  -- copie EXACTE de 0015_campaigns.sql:111-224
...;
revoke execute on function public.place_order(jsonb, jsonb, text, text, uuid) from public, anon, authenticated;
grant execute on function public.place_order(jsonb, jsonb, text, text, uuid) to service_role;
update public.products set free_shipping = false;   -- si le nouveau code reste en ligne
-- OPTIONNEL, PERTE DE DONNÉES (exporter avant) :
-- alter table public.products drop column if exists free_shipping;
-- alter table public.product_translations drop column if exists color, drop column if exists materials, …;
commit;
```

## Concurrence

- `place_order` : verrous inchangés, lecture `free_shipping` sous verrou → cohérente (voir plus haut).
- Écran ↔ base : écart possible sur les frais (🟠1).
- Admin : écrasement du stock (🟠4, préexistant, exposition accrue). Échec partiel préexistant : ligne `products`
  (prix, stock, case) écrite puis échec de la traduction → l'admin voit « erreur » mais la case est déjà changée. Les CHECK
  0025 ne le rendent pas atteignable (validation serveur à `DETAIL_MAX` en `string.length` JS, plus strict que `length()`
  Postgres).

## Observabilité

- Dégradation de palier silencieuse (🟡5). `writeProductRow` passe en mode « sans 0025 » sans log non plus.
- Écart de frais (🟠1) invisible aujourd'hui : en attendant le garde, journaliser côté route
  `placed.shippingFee !== frais attendus` (`reportMoneyError` existe déjà) pour mesurer si le cas arrive réellement.

## Verdict : ⚠️ — livrable, migration non bloquante

Migration sûre et compatible (expand-only, `place_order` = 0015 + lignes 0025 exactement, coût négligeable, lecture sous
verrou). À faire avant ou juste après la livraison : 🟠1 (garde serveur sur les frais), 🟠2 (page commande tolérante /
lecture légère), down script 0025 avec l'ordre imposé. 🟠3 et 🟠4 avant que l'admin ne remplisse massivement les fiches.
