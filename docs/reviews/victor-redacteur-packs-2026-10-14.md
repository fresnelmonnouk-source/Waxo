# Victor : revue ingénierie, livraison offerte par pack (0026) + rédacteur IA des fiches produit (2026-10-14)

Périmètre : `git diff 1076ad6` (26 fichiers suivis, +495/−115) + 16 fichiers non suivis (0026 + down, 7 modules `src/lib/admin/ai/*`,
`ai-actions.ts`, `AiWriterPanel.tsx`, 5 tests).
Stack : Next.js 16 App Router (ISR) + Supabase (PostgREST, `place_order` plpgsql SECURITY DEFINER) + next-intl FR/EN, vitest + PGlite,
Vercel `dub1`, DeepSeek (JSON en flux).
Contexte prod (git) : `origin/main` = `4d081ec`. `1076ad6` n'est que sur `feat/livraison-details`, donc le code en ligne
n'affiche AUCUNE livraison offerte. 0025 est appliquée en base.
Exécuté : `vitest run` 120 fichiers / 1 530 tests verts. `tsc --noEmit` passe. `eslint` sur les zones touchées passe.

## Suivi de la revue précédente (`victor-livraison-details-2026-10-14.md`)

- **V2 : traité.** `tests/product-details-actions.test.ts` (dans 1076ad6) couvre l'écriture admin avec et sans 0025, `NEED_0025`
  sans écriture, et les deux replis enchaînés. `tests/catalog-migration-tiers.test.ts:138-170` couvre les 4 paliers `ADMIN_TIERS`
  et l'erreur qui n'est pas une colonne absente.
- **V8 : traité (option « a »).** `getAllPacks` (`packs.ts:242`) garde les packs masqués. `free` de `/api/checkout/config:58`
  et `currentQuote` (`checkout/route.ts:62`) l'utilisent. Le garde-fou de prix s'applique donc aussi aux packs masqués (avant, `prices`
  valait null et le contrôle était sauté). Test : `pack-free-shipping.test.ts:139,169`.
- **T10 : traité.** Un produit inactif dans un pack est testé (`free-shipping-pglite.test.ts:205`). Le palier 0 en erreur
  qui n'est pas une colonne absente est testé (`catalog-migration-tiers.test.ts:129`). Les down sont testés
  (`free-shipping-pglite.test.ts:218,232`).
- Vu au passage, aussi traités : V4 (`/\bfree_shipping\b/`, `produits/actions.ts:80`), V5 (`useState` pour l'ouverture,
  `ProductDrawer.tsx:177`), V9 (en-tête de 0025).

## Scope drift

Aucun. Le changement de texte « ce produit » en « cet article » (`messages/*/common.json`) est nécessaire parce que la note sert
aussi aux packs. L'affichage de l'erreur `keyword` et l'ouverture du panneau EN sur `descriptionEn` servent au garde-fou
« [à confirmer] ».

## Vérifié sans finding

- **`place_order` 0026 comparée à 0025 avec `diff`** : il n'y a que 2 blocs de différence, tous deux dans la branche pack (le `select … p.free_shipping` et le
  remplacement du `exists` par `if not v_free_line`). La branche produit, le franco, le hors zone, les plafonds, les verrous et `revoke`/`grant`
  sont identiques. La `place_order` de `0026_down` est **identique octet pour octet** à celle de 0025. L'ordre du down est
  bon : la fonction est restaurée avant le `drop column`, le tout dans une transaction avec `lock_timeout`.
- **Règle propriétaire** :
  - Le pack ne compte que par sa propre case, quelles que soient celles de ses produits.
  - Sa case n'a aucun effet sur ses produits achetés à l'unité.
  - Il y a un seul frais par commande.
  - La livraison est offerte seulement si toutes les lignes sont cochées.
  - La règle est la même dans la base (`0026:94-95`), dans `freeShippingIds` et dans le garde-fou serveur.
  - Tests PGlite : `:181-200`. Tests de la route : `checkout-shipping-changed.test.ts:91-116`.
- **Code sans 0026** :
  - La boutique relit les packs sans la colonne (`readPackRowsTiered`), donc toutes les cases valent décoché.
  - L'admin lit la liste et signale que la colonne manque (`freeShippingColumn`).
  - Un pack coché ne s'enregistre pas : message `NEED_0026`, rien d'écrit.
  - Un pack décoché s'enregistre sans la colonne.
  - Tout cela est testé (`pack-free-shipping.test.ts:143-245`).
- **Code avec 0026** : la colonne est lue en une seule requête. Un ancien formulaire sans la case est enregistré « non coché » (`z.boolean().optional()`).
- **Écart d'affichage selon l'ordre de mise en prod** :
  - *Code puis 0026 (ordre prévu).* Pendant la fenêtre, la base applique encore la règle 0025 (pack offert si tous ses
    produits le sont) et le site affiche des frais. L'écart joue **en faveur du client** : la confirmation montre un total plus bas.
    Le garde-fou ne bloque pas, car les frais ne montent pas. Après 0026, une instance déjà passée au palier 1 le garde
    ≤ 10 min (`PACK_COLUMNS_RECHECK_MS`, `packs.ts:166`), auxquelles s'ajoutent ISR 60 s et `s-maxage=30, swr=120`. Si l'admin coche un pack pendant
    ce délai, l'écart est encore en faveur du client et dure environ 13 min au maximum.
  - *0026 puis code.* Le code en prod (`4d081ec`) n'affiche jamais la livraison offerte et n'a pas de case dans l'admin. Il n'y a
    donc **aucun écart dans le sens dangereux** (affichée offerte mais facturée). 0026 rend même la base plus proche de
    l'affichage (pack payant).
  - Les deux ordres sont sûrs. Voir V13 pour l'en-tête de 0026, qui dit le contraire.
- **`maxDuration = 60` (`produits/page.tsx:13`)** :
  - La valeur est compatible avec les deux plans Vercel : Hobby sans Fluid compute plafonne à 60 s, avec Fluid compute et sur Pro le plafond est plus haut.
  - Précédent en prod : `admin/(panel)/assistant-ia/page.tsx:14` (même valeur, livré dans `fd6606d`).
  - Les server actions héritent de la config du segment de la page qui les appelle.
  - Budget : lecture du lien 8 s + génération 40 s, ce qui laisse environ 12 s pour `assertAdmin`, le limiteur et le démarrage à froid. C'est suffisant.
  - Confiance 8/10 : je n'ai pas accès au plan réel du projet.
- **Rédacteur, contrats** :
  - Ordre de la server action : `assertAdmin`, puis Zod `.strict()`, puis la clé, puis le limiteur, AVANT la lecture du lien et l'appel au modèle.
  - Le fichier `"use server"` n'exporte qu'une fonction async.
  - Rien n'est écrit en base.
  - Le journal ne contient aucun contenu.
  - Une sortie tronquée est récupérée (`parseLenient`).
  - Les limites du brouillon correspondent à celles du formulaire (nom 120, description 2 000, mot 40, `DETAIL_MAX`).
  - Le prompt système est verrouillé par un test de non-régression. Je ne propose aucun changement de son texte.
- **Garde-fou « [à confirmer] »** :
  - Il est appliqué au client (`ProductDrawer.save`) et au serveur (`parseForm` pour la création et la modification, `setProductActive` pour la remise en ligne depuis la liste).
  - Les clés d'erreur correspondent à `detailErrorKey`.
  - Les panneaux FR et EN s'ouvrent sur l'erreur.
  - Masquer reste toujours permis.
  - Aucun autre chemin n'écrit `products.active` (grep).

## 🟠 IMPORTANTES

**W1. L'IA écrase les saisies faites pendant la rédaction (10 à 48 s)**
`src/components/admin/products/AiWriterPanel.tsx:55-62` + `src/components/admin/products/ProductDrawer.tsx:188-189`, confiance 9/10.
Empreinte `src/components/admin/products/AiWriterPanel.tsx:62:correctness`.
```
      const res = await draftProductAction({ url: link, notes: notes.trim(), rayon });
      ...
      const conflicts = draftConflicts(current, res.draft);
      if (conflicts.length) setStatus({ kind: "confirm", draft: res.draft, conflicts });
      else apply(res.draft, "replace");
```
```
    const { values, filled } = applyDraft(v, draft, mode);
    setV(values);
```
Mécanisme : après l'`await`, `run` utilise encore `current` et `apply`, donc `onApply`, puis `applyAi`, puis `v`, **tels qu'ils étaient au clic**
(fermeture JavaScript figée). Le formulaire n'est pas verrouillé pendant la rédaction, et l'écran annonce « 10 à 30 secondes ».
Scénario : l'admin lance la rédaction, puis il saisit le prix et le stock, change le rayon, ajoute une photo dont l'envoi se termine, ou
passe le prix de 5 000 à 4 500 sur une fiche existante. La proposition arrive sans conflit (les champs texte étaient vides au clic) et
`setV(values)` remet **tout le formulaire** à l'état du clic. Le prix et la photo disparaissent sans aucun message, et la photo
envoyée reste orpheline dans le Storage. Avec un prix modifié, l'enregistrement suivant remet l'ancien prix. Même cause, autre effet :
un champ texte rempli pendant la rédaction n'est pas vu comme un conflit, et il est écrasé.
Correction : dans `ProductDrawer`, garder les valeurs à jour dans une ref (`vRef.current = v` à chaque rendu). Ensuite, soit
`applyAi` lit `vRef.current`, soit on passe par `setV((s) => applyDraft(s, …).values)`. `AiWriterPanel` doit calculer les conflits
sur les valeurs à jour : passer une fonction `getCurrent()` au lieu de `current`. Ajouter un test : rendre le tiroir, modifier le prix
pendant que la promesse est en attente, résoudre, puis vérifier que le prix est conservé. **AUTO-FIX**.

**W2. Le marqueur « [à confirmer] » reste à vie dans l'URL du produit**
`src/app/admin/(panel)/produits/actions.ts:133`, confiance 9/10. Empreinte `src/app/admin/(panel)/produits/actions.ts:133:correctness`.
```
  const base = slugify(name);
```
Le parcours est prévu ainsi : le prompt validé demande « [à confirmer] » quand il manque une information indispensable au **nom**, et le
garde-fou invite à « masquez-le pour le garder en brouillon ». Le brouillon est donc créé avec par exemple « Gourde isotherme
[à confirmer] ». `slugify` donne alors `gourde-isotherme-a-confirmer`. Ensuite, le slug FR ne change plus jamais
(`actions.ts:278` : « le slug reste stable »). Quand l'admin corrige le nom et publie, la fiche publique, le sitemap et les liens
partagés gardent `/produit/gourde-isotherme-a-confirmer`. Même chose en anglais avec `-to-be-confirmed`. Le garde-fou empêche le
marqueur d'apparaître dans le texte, mais il passe par l'URL.
Correction minimale : retirer les marqueurs avant `slugify` dans `insertTranslation` (exporter de `product-writer-gate.ts`
une version globale de `TBC_RE` et faire `slugify(name.replace(TBC_RE_G, " "))`), puis tester le slug obtenu avec un nom marqué.
**AUTO-FIX**. Option plus complète : régénérer le slug à la première mise en ligne d'un produit qui n'a jamais été publié.
**ASK**, car cela change le contrat « slug stable » et il faut une colonne ou un indicateur.

**W3. L'extraction de texte est quadratique sur du HTML hostile : la promesse « aucun retour arrière catastrophique » est fausse**
`src/lib/admin/ai/page-text.ts:56`, `:77` (et le motif `[^>]*>` des lignes 51-52), confiance 8/10 (mesuré).
Empreinte `src/lib/admin/ai/page-text.ts:56:perf`.
```
    .replace(/<[^>]*>/g, " ")
```
```
  const re = /<meta\b[^>]*>/gi;
```
Chaque `<` qui n'a pas de `>` après lui relance un balayage jusqu'à la fin du texte. Mesures sous Node 24 :
- `extractPageText` sur `"<a "` répété : 60 Ko en 0,76 s, 120 Ko en 3,3 s ;
- le motif `<meta ` répété : 240 Ko en 27 s.

La croissance est quadratique et l'entrée peut aller jusqu'à 2 Mo, donc l'appel prend plusieurs minutes. La fonction est coupée à 60 s. Pendant ce temps,
la boucle d'événements de l'instance est bloquée, et avec Fluid compute les autres requêtes de la même instance attendent. Le déclenchement est
réservé à l'admin, mais il suffit d'une page piégée, ou d'un site qui sert du HTML cassé, collée en toute bonne foi. Les pages
normales (balises fermées) restent linéaires. Ce point recoupe le périmètre de Raphaël.
Correction : borner les quantificateurs (`<[^>]{0,4096}>`, `<meta\b[^>]{0,4096}>`, `[^>]{0,4096}` dans le motif des blocs). Un `<`
sans `>` proche est alors traité comme du texte. Ajouter un test sur 2 Mo de `"<a "`, de `"<meta "` et de `"<nav "` qui doit passer en moins d'1 s.
**AUTO-FIX**.

## 🟡 MINEURES

**V13. L'en-tête de 0026 justifie l'ordre de mise en prod par un risque qui n'existe pas en prod**
`supabase/migrations/0026_pack_free_shipping.sql:17-18`, confiance 8/10. Empreinte `supabase/migrations/0026_pack_free_shipping.sql:17:docs`.
```
-- Ordre conseillé : déployer le nouveau code PUIS exécuter 0026. Dans l'autre ordre, l'ancien code afficherait encore
```
« L'ancien code » qui afficherait « pack offert » est `1076ad6`, qui n'a jamais été en prod. Le code en ligne (`4d081ec`) n'affiche
aucune livraison offerte (voir l'analyse des deux ordres plus haut). Les deux ordres sont sûrs. Correction : écrire « Ordre libre
tant que 1076ad6 n'a pas été déployé seul ; ordre conseillé : code puis 0026 », comme V9 l'a fait pour 0025. **AUTO-FIX**
(commentaire).

**V14. 0026 (montée) n'a pas de `lock_timeout`, alors que son down en a un**
`supabase/migrations/0026_pack_free_shipping.sql:22`, confiance 7/10. Empreinte `…/0026_pack_free_shipping.sql:22:reliability`.
```
alter table public.packs add column if not exists free_shipping boolean not null default false;
```
L'`ALTER` demande un verrou ACCESS EXCLUSIVE sur `packs`, que `place_order` lit. Si une transaction longue est en cours, l'`ALTER` attend, et toutes
les commandes avec un pack attendent derrière lui. Le risque est faible (petite table, faible trafic) mais gratuit à fermer : ajouter
`set lock_timeout = '5s';` en tête, comme dans `0026_down.sql:7`. **AUTO-FIX**.

**V15. Les packs masqués ne sont pas testés dans la route POST /api/checkout**
`src/app/api/checkout/route.ts:62`, confiance 7/10. Empreinte `src/app/api/checkout/route.ts:62:tests`.
```
  const packs = packIds.size ? (await getAllPacks(lang)).filter((k) => packIds.has(k.id)) : [];
```
Le changement de comportement de V8 côté commande n'est vérifié par aucun test. Sont concernés :
- `shipping_changed` sur un pack masqué décoché ;
- `price_changed` sur un pack masqué, qui est NOUVEAU : avant, un pack masqué sautait le contrôle des prix.

`pack-free-shipping.test.ts` ne couvre que `/config`. Ajouter les 2 cas dans `checkout-shipping-changed.test.ts`. **AUTO-FIX** (tests).

## Couverture de tests (vue Victor, Nadia non dispatchée)

Bien couvert :
- 0026 en PGlite : toutes les règles du propriétaire, rejouable, les deux down, les droits EXECUTE ;
- les paliers boutique et admin des packs ;
- `writePackRow` avec et sans 0026 ;
- le SSRF, les délais, la taille et les refus de `fetch-page` ;
- la server action : admin, limiteur, clé absente, sortie tronquée ;
- le prompt verrouillé ;
- le garde-fou client et serveur, y compris la remise en ligne depuis la liste.

Manques :
- W1 : il faut un test de composant (concurrence entre la saisie et la réponse) ;
- W2 : le slug d'un nom marqué ;
- W3 : une entrée hostile de 2 Mo ;
- V15 : les packs masqués dans la route POST.

## Sécurité / légal

Raphaël et Helena auditent en parallèle. Pour Raphaël, W3 (déni de service par expression régulière, déclenché par l'admin) recoupe son périmètre. La limite TOCTOU
DNS est documentée dans `fetch-page.ts`. Je ne l'ai pas réévaluée.

## Décisions à remonter (ASK, groupées)

1. W2 : retirer seulement le marqueur du slug (AUTO-FIX, recommandé tout de suite), ou en plus régénérer le slug à la première publication
   (nouveau contrat) ?

## Annexe (confiance ≤ 5 ou informatif)

- `scrubText` (`scrub.ts:6`, `LONG_NUMBER_RE`) masque aussi une suite de tailles du type « 36 37 38 39 » (8 chiffres séparés par
  des espaces) dans la page ou les notes. Le modèle perd l'information et écrit « [à confirmer] ». Il n'y a aucun risque, seulement une perte de détail.
  Confiance 5.
- Les packs masqués n'ont pas d'entrée `stock`/`prices` dans `/config` (calculés sur `packs` filtré). Ce n'est pas une régression, et le
  garde-fou de prix serveur couvre désormais ce cas.

## Red-team

Le diff dépasse 200 lignes, donc Zoé doit être dispatchée (seuil gstack), même sans 🔴. Lui transmettre W1 à W3, V13 à V15 et les rapports
de Raphaël et Helena. Pistes :
- injection de prompt via la PAGE (les balises sont neutralisées, mais il reste les consignes dans le texte et `fromLink`) ;
- contournement du garde-fou par des variantes du marqueur (`［à confirmer］` en pleine chasse, espace insécable) ;
- écart de frais pendant la fenêtre où le palier 1 est mémorisé après 0026.

## Verdict

⚠️ **Corrections requises.** Aucun 🔴. La partie packs (0026) est saine et peut partir en l'état. Pour le rédacteur IA, W1 (perte
silencieuse de saisie, dont le prix) et W2 (marqueur dans l'URL publique) sont à corriger avant de l'ouvrir à l'usage. W3 peut suivre très
vite, ou être traité avec le retour de Raphaël.
