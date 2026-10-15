# Rapport sécurité — Raphaël — Rubriques produit + livraison offerte (0025) — 2026-10-14

Périmètre : `git diff` non commité de `waxo` + fichiers non suivis
`supabase/migrations/0025_product_details_free_shipping.sql`, `src/lib/catalog/details.ts`,
`src/lib/catalog/free-shipping.ts`, `src/lib/supabase/missing-column.ts`,
`src/components/product/ProductDetailsSection.tsx`.

Méthode : lecture du code, aucune attaque en conditions réelles. Le `place_order` de 0025 a été comparé ligne à ligne
avec celui de 0015 (`diff -w`). Les tests `tests/free-shipping-pglite.test.ts` et `tests/product-details.test.ts` ont été
lancés : 27/27 réussis.

Stack : Next.js 16 (App Router, server actions) + Supabase (RLS, RPC SECURITY DEFINER via service_role), FedaPay +
paiement à la livraison.

Surface d'attaque du changement :
- Server actions admin `createProduct` / `updateProduct` (`src/app/admin/(panel)/produits/actions.ts`) : 6 rubriques FR/EN + `freeShipping`.
- Fiche produit publique (`src/app/[lang]/(shop)/produit/[slug]/page.tsx`) : affichage des rubriques.
- `GET /api/checkout/config` : nouveau champ `free`.
- Page `/commande` : nouvelle prop `freeShippingIds` sérialisée au client.
- `POST /api/checkout` → `place_order` (0025) : calcul des frais de livraison.

---

## CRITIQUES — BLOQUANT

Aucune.

## IMPORTANTES

Aucune.

## MINEURES / durcissement

1. **La zone est déclarée par le client, et la livraison offerte rend ce choix plus rentable** (le problème existait déjà).
   Le changement l'aggrave un peu. Confiance 6/10. VERIFIED.
   - Où : `supabase/migrations/0025_product_details_free_shipping.sql:139` et `src/lib/checkout/schema.ts` (`zone: z.enum(ZONES)`).
   - Code : `v_fee := case when p_zone = 'cotonou' and v_all_free then 0`
   - Scénario : un client de Parakou commande uniquement des produits « livraison offerte ». Il choisit la zone
     « Cotonou & Calavi » mais saisit son adresse réelle. Il paie 0 F au lieu du tarif « autre ».
     Avant 0025, la même manœuvre payait déjà le tarif Cotonou au lieu du tarif « autre ». L'écart est maintenant plus grand.
   - Ce qui limite le risque aujourd'hui : chaque commande est confirmée sur WhatsApp avec l'adresse avant expédition.
   - Correctif proposé, non bloquant : dans le back-office commandes, signaler une commande `zone = cotonou` dont
     l'adresse ne contient ni « Cotonou » ni « Calavi », ou faire vérifier la cohérence zone/adresse à la confirmation WhatsApp.
   - Variantes : aucune autre (le seul calcul de frais est dans `place_order`).

2. **Une case cochée sur un produit très bon marché peut servir de commande-appât en paiement à la livraison.**
   C'est un réglage métier, pas une vulnérabilité. Confiance 4/10. TENTATIVE.
   - Scénario : un troll commande en paiement à la livraison un article à 500 F coché « livraison offerte ». Le livreur
     se déplace pour 0 F de frais, puis la commande est refusée.
   - Garde-fous déjà en place, vérifiés : Turnstile, limite de 8 commandes / 10 min / IP, 3 commandes ouvertes non payées
     par téléphone sur 24 h (`place_order`, `c_max_open`).
   - Correctif proposé : consigne admin, ne cocher la case que si la marge couvre la course. Pas de code requis.

## Points conformes

- **Impossible d'obtenir la livraison gratuite en manipulant le client.**
  - Le client n'envoie jamais de montant (`checkoutSchema` : kind/id/qty seulement).
  - `place_order` relit `p.free_shipping` en base pour chaque produit (0025:73) et pour chaque produit de chaque pack (0025:94-95).
  - `v_all_free` commence à `true` et passe à `false` dès une ligne non cochée.
  - La colonne est `NOT NULL DEFAULT false`, donc aucun cas NULL.
  - `POST /api/checkout` transmet à FedaPay `placed.total` renvoyé par la base (`route.ts`, `createCheckout({ total: placed.total })`).
  - Côté navigateur, `cartShipsFree` / `shippingFee(..., allFree)` ne sert qu'à l'affichage.
  - Panier mixte, pack avec un produit non coché, hors Cotonou : tous testés en PGlite.
- **`place_order` : seules les lignes marquées 0025 ont changé** (vérifié par diff contre 0015).
  - `security definer set search_path = public` est inchangé.
  - `revoke execute ... from public, anon, authenticated` + `grant ... to service_role` sont présents (0025:147-148), avec un test dédié.
  - Les plafonds de quantité, le verrou consultatif, l'ordre des verrous et les campagnes sont inchangés.
- **0025 appliquée sans 0024 : pas de risque de régression du montant.** 0024 ne redéfinit pas `place_order`, donc
  l'appliquer plus tard n'écrasera pas la logique de livraison offerte.
- **Pas de XSS via les rubriques.**
  - Rendu exclusivement en nœuds texte React (`ProductDetailsSection.tsx` : `{l}`, `{r.value}`, `{details[k].split("\n").join(", ")}`).
  - Aucun `dangerouslySetInnerHTML` / `innerHTML` dans `components/product`, `components/shop`, `components/checkout` ni dans la page fiche.
- **Les rubriques ne sortent pas de la fiche.**
  - JSON-LD : `productPageJsonLd` ne lit pas `details`, et `JsonLdScript` passe par `safeJsonLd`.
  - Listes, assistant IA, corpus IA admin, `/api/checkout/config`, page commande, `getRelatedProducts`, `getProductsByIds` :
    tous passent par `listItem`, qui retire `details` (`src/lib/catalog/index.ts:313-315`).
    L'assistant (`src/lib/assistant/answer.ts:66`) utilise `getProducts`, donc les rubriques n'arrivent pas dans le prompt du LLM.
  - E-mails : `src/lib/email/load.ts` et `shop.ts` ne lisent que `order_items(name, qty, unit_price)`.
  - Aucune injection de prompt via les rubriques n'est donc possible.
- **Autorisation des server actions.**
  - `createProduct` / `updateProduct` appellent `prepare()`, donc `assertAdmin()` (session + `profiles.role = 'admin'` lu en
    base), AVANT tout parsing ou toute écriture (`actions.ts:40-41`, `141-142`, `204-205`).
  - Ensuite viennent Zod (`productFormSchema`, clés inconnues retirées) puis `validateProductForm`.
  - `cleanDetails` reconstruit l'objet à partir des seules `DETAIL_KEYS`, donc l'étalement `...details` dans `trColumns`
    (`actions.ts:110`) ne permet pas d'écrire d'autres colonnes.
- **RLS / droits des nouvelles colonnes.**
  - Les colonnes héritent des politiques de leur table : `products_read` (actif ou admin), `product_tr_read` (produit actif ou admin).
  - `revoke insert, update, delete ... from anon, authenticated` est posé au niveau table (0001), donc il couvre les nouvelles colonnes.
  - Écritures uniquement en service_role. `free_shipping` est une donnée publique par nature (affichée sur la fiche).
- **`/api/checkout/config` ne fait rien fuiter.**
  - `free` est filtré sur les `ids` du panier (`route.ts:55`).
  - Les ids sont limités par `SAFE_ID` et `slice(0, 50)`.
  - Seuls les produits actifs sont concernés, et l'information est déjà visible sur chaque fiche.
  - Le cache public `s-maxage=30` est indexé sur l'URL, sans donnée personnelle.
- **Pas de déni de service par la taille des champs ou les regex.**
  - Contraintes CHECK en base (200 / 3 000), Zod à ×2 côté serveur, `maxLength` côté formulaire.
  - Toutes les regex sont linéaires (`/\r\n?/g`, `/\n{2,}/g`, `/^[-•*·]\s*/` ancrée, `isMissing0025` sur un message d'erreur court).
  - `specRows` utilise `indexOf`.
  - Seul un admin peut écrire ces champs.
  - Le fait que JS compte les caractères en UTF-16 rend la validation applicative plus stricte que le `length()` Postgres, donc il n'y a pas de contournement.
- **« sans photo » masqué quand une photo existe** (`PhotoField.tsx` et les composants vitrine) : changement d'affichage uniquement, sans impact sécurité.

## Remarque hors sécurité (non exploitable par un attaquant)

- **Le garde-fou `price_changed` ne couvre pas les frais de livraison.**
  - Il ne compare que le sous-total (`expectedSubtotal`, `src/app/api/checkout/route.ts`).
  - Cas concerné : un admin décoche « livraison offerte » alors que la page `/commande` (`revalidate = 60`) ou
    `/api/checkout/config` (`s-maxage=30`, `stale-while-revalidate=120`) montre encore 0 F. La commande est alors créée
    avec les frais de zone sans nouvel avertissement.
  - En paiement en ligne, le montant réel s'affiche chez FedaPay. En paiement à la livraison, l'écart n'apparaît qu'à la confirmation.
  - Si l'on veut une parité stricte entre affiché et facturé : envoyer aussi `expectedShipping` (ou `expectedTotal`) et
    renvoyer `price_changed` quand les frais réels sont plus élevés.

## Décision sécurité

**RAS — aucun finding critique ni important. Pas de blocage de sécurité pour la mise en production.**
Les deux points mineurs relèvent du durcissement opérationnel et existaient déjà en partie.

Ceci est un audit pragmatique, pas une certification. Pour un enjeu majeur (paiements), un pentest ou un audit
professionnel reste recommandé.
