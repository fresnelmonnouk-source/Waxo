# Textes "livraison offerte par article ou pack" : proposition Helena (2026-10-15)

Statut : PROPOSITION. Aucun fichier de code ni de base modifié. Le propriétaire valide le texte EXACT avant toute mise en ligne.
Règle prise en compte (brief Kody) : livraison offerte à Cotonou et Calavi quand TOUS les articles du panier (produits ou packs) portent la case ; un seul frais par commande ; un pack coché est offert seulement quand c'est le PACK qui est commandé ; un article non coché dans le panier fait revenir au tarif habituel (1 000 F, offerte dès 15 000 F) ; hors Cotonou et Calavi inchangé (2 500 F).
Vérifié dans le code : `src/lib/checkout/shipping.ts` (`shippingFee`, `cartShipsFree`) et `supabase/migrations/0026_pack_free_shipping.sql` (la case du pack prime, les cases de ses produits ne comptent pas). Cadre : loi n° 2007-21 (information du consommateur, pratiques commerciales trompeuses), CGV/CGU en ligne. Évaluation de risque, pas un avis juridique formel.

## Décision globale

Modifications requises, rien de bloquant. Le point qui compte : aujourd'hui l'assistant, la FAQ, la page Livraison et retours et les CGV disent toutes "1 000 F, offerte dès 15 000 F" sans la règle. Ce n'est pas faux (le tarif habituel reste vrai), mais c'est incomplet dans les deux sens : un client qui a vu "livraison offerte" sur une fiche et demande à l'assistant recevra une réponse qui l'ignore. Risque moyen (information incomplète, pas de dark pattern), à corriger avant d'annoncer la règle ailleurs (publicités comprises).

Mots à ne pas utiliser autour de cette règle : "tous nos articles", "livraison gratuite" sans "à Cotonou et Calavi" et sans la condition "si tous les articles du panier".

Un texte à retenir comme formule commune (utilisée partout ci-dessous) : la mention s'appelle **« livraison offerte »** ; elle est visible **sur la fiche de l'article et dans le panier**.

---

## Où vit chaque texte, et ce que l'administrateur doit faire

| # | Texte | Vit dans | Prime sur le code ? | Action administrateur |
|---|---|---|---|---|
| 1 | Réponse déterministe de l'assistant (`Reply.delivery`) | Code (`src/messages/{fr,en}/assistant.json`) | Non | Aucune (déployé avec le code) |
| 2 | Fiche KB 0003 "Frais de livraison et livraison offerte" | BASE DE DONNÉES (insérée par `0021_kb_seed.sql`) | Oui, la base prime | OUI : Admin, base de connaissances, modifier la fiche et enregistrer. Le fichier de migration ne suffit pas. |
| 2b | Fiche KB 0013 "Les packs" (1 phrase ajoutée) | BASE DE DONNÉES | Oui | OUI, idem |
| 3 | Page "Livraison et retours" | BASE DE DONNÉES (page `livraison-retours`, seed `0017`) ; repli code : `src/lib/pages/defaults.ts` et `account.json › Legal.shipping` | Oui, la base prime | OUI : Admin, Pages, "Livraison et retours". Si la page n'a jamais été éditée dans l'admin, une migration de mise à jour (modèle `0013`) peut le faire ; sinon c'est à la main. |
| 4 | CGV art. 6 "Livraison" | BASE DE DONNÉES (page `cgv`) ; repli code : `defaults.ts` et `account.json › Legal.cgv.s6` | Oui | OUI : Admin, Pages, CGV. À faire dans la MÊME passe que l'art. 5 (voir "Cohérence CGV" plus bas) pour ne pas écraser l'un par l'autre. |
| 5 | FAQ "Combien coûte la livraison ?" (`Faq.a2`) | Code (`account.json`) | Non | Aucune |
| 6 | Notes fiche article/pack (`noteZoneFreeProduct`, `noteFreeProductCond`) | Code (`common.json`) | Non | Aucune |
| 7 | Contexte des brouillons IA admin (`ai-draft.ts` l. 45, `admin/ai/corpus.ts` l. 76) | Code | Non | Aucune. Prompts internes : validation du texte exact requise avant écriture (consigne de Fresnel). |

Note pour Kody sur le code : `defaults.ts` est comparé à la migration de seed par `tests/pages-seed.test.ts` ; toute modification de `defaults.ts` impose de régénérer la migration. De plus, `src/components/account/legal/ShippingDoc.tsx` n'affiche que des clés fixes : le nouveau paragraphe de la page (point 3) demande 4 nouvelles clés dans `account.json` et 3 lignes de JSX pour apparaître dans ce repli. Je ne touche pas au code.

---

## 1. Réponse de l'assistant, clé `delivery` (code)

Où elle sert : `src/messages/{fr,en}/assistant.json › Reply.delivery`, utilisée par `deliveryText()` pour la fiche "Zones et délais" (0002, `kb1`) et pour toute question de type "livraison" reconnue par `RE_DELIVERY`. Texte affiché tel quel, sans reformulation par l'IA : donc les mots comptent.

ACTUEL FR :
> Livraison Express à Cotonou et Calavi : le jour même pour toute commande passée avant {cutoff} h (heure du Bénin), sinon le lendemain, 7 j/7 dimanche compris, pour {cotonou}, offerte dès {free}. Avec le paiement à la livraison, l'heure limite s'applique à l'heure de la confirmation de la commande sur WhatsApp. Ailleurs au Bénin, comptez 48 à 72 h pour {autre}.

PROPOSÉ FR :
> Livraison Express à Cotonou et Calavi : le jour même pour toute commande passée avant {cutoff} h (heure du Bénin), sinon le lendemain, 7 j/7 dimanche compris, pour {cotonou}, offerte dès {free} d'achat. Elle est aussi offerte quand tous les articles de votre panier portent la mention « livraison offerte », visible sur leur fiche et dans votre panier. Avec le paiement à la livraison, l'heure limite s'applique à l'heure de la confirmation de la commande sur WhatsApp. Ailleurs au Bénin, comptez 48 à 72 h pour {autre}.

ACTUEL EN :
> Express Delivery in Cotonou and Calavi: same day for any order placed before {cutoff}:00 (Benin time), otherwise the next day, 7 days a week including Sundays, for {cotonou}, free from {free}. With pay on delivery, the cut-off time applies to the time the order is confirmed on WhatsApp. Elsewhere in Benin, allow 48 to 72 hours for {autre}.

PROPOSÉ EN :
> Express Delivery in Cotonou and Calavi: same day for any order placed before {cutoff}:00 (Benin time), otherwise the next day, 7 days a week including Sundays, for {cotonou}, free from {free} of purchases. It is also free when every item in your cart carries the “free delivery” mention, shown on the item page and in your cart. With pay on delivery, the cut-off time applies to the time the order is confirmed on WhatsApp. Elsewhere in Benin, allow 48 to 72 hours for {autre}.

Pourquoi ainsi : "aussi offerte" garde la règle en une phrase et la place dans la zone Cotonou et Calavi (la phrase précédente) donc "hors zone, rien ne change" est déjà dit par "Ailleurs au Bénin, comptez ... pour {autre}". "d'achat" / "of purchases" évite de lire {free} comme un montant par article. Les détails (un seul frais, packs, article non coché) sont dans la fiche KB 0003, que l'IA reçoit comme "faits".

---

## 2. Fiches de la base de connaissances

Contraintes : 900 caractères maximum par fiche ; champs tag, title, text, keywords. Les fiches ne sont pas multilingues en base (l'insertion n'a pas de colonne de langue) : le texte FR est la source, l'IA répond en anglais à partir de lui. La version EN ci-dessous ne sert qu'à `src/lib/demo/kb.json` (démo) ou si une fiche EN est un jour créée.

Mécanique à connaître (vérifiée dans `engine.ts`) : pour la fiche 0003, la réponse directe sans IA = ses 2 PREMIÈRES phrases (`firstSentences`, coupure après . ! ?). C'est pourquoi la règle principale est dans la 1re phrase et la limite de zone dans la 2e.

### 2.1 Fiche 0003 "Frais de livraison et livraison offerte" (tag Livraison)

Title : inchangé.

ACTUEL (text) :
> À Cotonou et Abomey-Calavi, la livraison coûte 1 000 F et elle est offerte dès 15 000 F d'achat. Dans les autres villes du Bénin, elle coûte 2 500 F : la livraison offerte ne concerne que la zone Cotonou et Calavi. Les frais de livraison s'ajoutent au prix des produits et vous les voyez avant de valider votre commande. Les prix sont en francs CFA, toutes taxes comprises, et vous payez le prix affiché au moment où vous commandez.

PROPOSÉ (text) FR (environ 850 caractères, sous la limite de 900 ; à recompter dans le champ de l'admin, qui fait foi) :
> À Cotonou et Abomey-Calavi, la livraison coûte 1 000 F et elle est offerte dès 15 000 F d'achat, ou quand tous les articles du panier portent la mention « livraison offerte ». Dans les autres villes du Bénin, elle coûte 2 500 F : la livraison offerte ne concerne que la zone Cotonou et Calavi. Pour savoir si un article ou un pack porte la mention, regardez sa fiche ou votre panier. Si un seul article du panier ne la porte pas, le tarif habituel s'applique. Il n'y a qu'un seul frais de livraison par commande, quel que soit le nombre d'articles. Un pack a sa propre mention : elle ne s'applique pas à ses produits achetés séparément, et celle d'un produit ne s'applique pas au pack. Les frais de livraison s'ajoutent au prix des produits et vous voyez le total avant de valider votre commande. Les prix sont en francs CFA, toutes taxes comprises.

(La fin "et vous payez le prix affiché au moment où vous commandez" est retirée pour tenir sous 900 caractères ; elle reste dans la fiche 0014 et les CGV art. 3.)

PROPOSÉ (keywords) : ajouter à la fin de la liste actuelle ` article articles panier pack mention un seul frais`.

PROPOSÉ (text) EN (démo / référence) :
> In Cotonou and Abomey-Calavi, delivery costs 1,000 F and is free from 15,000 F of purchases, or when every item in the cart carries the “free delivery” mention. In other cities in Benin it costs 2,500 F: free delivery only applies to the Cotonou and Calavi area. To know whether an item or a pack carries the mention, look at its page or your cart. If a single item in the cart does not carry it, the usual fee applies. There is only one delivery fee per order, however many items it contains. A pack has its own mention: it does not apply to its products bought separately, and a product's mention does not apply to the pack. Delivery fees are added to the price of the products and you see the total before you confirm your order. Prices are in CFA francs, all taxes included.

Précisions : les chiffres sont en clair (comme demandé). Si l'administrateur change un tarif dans Réglages, cette fiche ne suit pas : à mettre à jour à la main (risque déjà connu, la réponse sans IA à la question générale "livraison" passe par la fiche 0002 qui, elle, lit les réglages).

### 2.2 Fiche 0013 "Les packs" : une phrase à ajouter (recommandé)

Sans cela, un client qui demande "le pack est-il livré gratuitement ?" n'a aucune réponse cohérente avec la fiche 0003. Insérer après la phrase "Vous commandez le pack en un clic, nous emballons tout ensemble et nous livrons un seul colis." :

PROPOSÉ FR :
> Un pack peut porter la mention « livraison offerte » à Cotonou et Calavi : si c'est le cas, elle est indiquée sur la page du pack.

PROPOSÉ EN :
> A pack can carry the “free delivery” mention in Cotonou and Calavi: if it does, it is shown on the pack page.

La fiche passe d'environ 560 à 690 caractères (limite respectée). Formulée au conditionnel ("peut porter") : vrai même si aucun pack n'est coché aujourd'hui.

### 2.3 Autres fiches vérifiées

- 0002 "Zones et délais" : ne cite aucun tarif ; sa réponse directe vient de la clé `delivery` (point 1). Aucun changement de texte.
- 0001, 0004 : ne parlent pas des frais. Aucun changement.
- 0005 "Moyens de paiement" : "Le montant total, livraison comprise, s'affiche avant que vous validiez la commande" reste exact. Aucun changement.
- 0010 "Retours" : ne dit rien du remboursement des frais de livraison (point déjà ouvert dans la revue du 2026-10-13, question 4). Avec la livraison offerte par article, la question se complique : retour d'un seul article d'une commande offerte. Ne pas improviser ; à trancher par Fresnel, l'assistant ne doit pas répondre.

---

## 3. Page "Livraison et retours"

Où elle vit : BASE (page `livraison-retours`). Le Markdown ci-dessous reprend le format de `defaults.ts` (tableau à 3 colonnes ; une cellule ne doit contenir ni barre verticale ni saut de ligne). Les variables restent des marqueurs {{...}}.

### 3.1 Ligne "Cotonou et Calavi" du tableau (page en base et `defaults.ts`)

ACTUEL FR (ligne entière) :
> | Cotonou et Calavi (Livraison Express) | Le jour même si vous commandez avant {{shipping.cutoff}} h, sinon le lendemain. 7 j/7, dimanche compris | {{shipping.cotonou}}, offerte dès {{shipping.freeFrom}} |

PROPOSÉ FR :
> | Cotonou et Calavi (Livraison Express) | Le jour même si vous commandez avant {{shipping.cutoff}} h, sinon le lendemain. 7 j/7, dimanche compris | {{shipping.cotonou}}, offerte dès {{shipping.freeFrom}} d'achat, ou si tous les articles du panier sont à livraison offerte (voir ci-dessous) |

ACTUEL EN :
> | Cotonou and Calavi (Express Delivery) | Same day if you order before {{shipping.cutoff}}:00, otherwise the next day. 7 days a week, Sundays included | {{shipping.cotonou}}, free from {{shipping.freeFrom}} |

PROPOSÉ EN :
> | Cotonou and Calavi (Express Delivery) | Same day if you order before {{shipping.cutoff}}:00, otherwise the next day. 7 days a week, Sundays included | {{shipping.cotonou}}, free from {{shipping.freeFrom}} of purchases, or if every item in your cart is marked free delivery (see below) |

La colonne "Frais" est la plus étroite : la cellule est plus longue mais reste lisible ; "voir ci-dessous" renvoie au nouveau paragraphe.

### 3.2 Clé `r1f` du repli code (`account.json › Legal.shipping.r1f`)

ACTUEL FR : `{cotonou}, offerte dès {freeShip}`
PROPOSÉ FR : `{cotonou}, offerte dès {freeShip} d'achat, ou si tous les articles du panier sont à livraison offerte (voir ci-dessous)`

ACTUEL EN : `{cotonou}, free from {freeShip}`
PROPOSÉ EN : `{cotonou}, free from {freeShip} of purchases, or if every item in your cart is marked free delivery (see below)`

### 3.3 Nouveau paragraphe, à insérer sous le tableau, avant "## Le jour de la livraison"

PROPOSÉ FR (Markdown) :

```
## Livraison offerte à Cotonou et Calavi

Un article ou un pack peut porter la mention « livraison offerte ». Vous la voyez sur sa fiche et dans votre panier.

À Cotonou et Calavi, la livraison est offerte quand tous les articles de votre panier portent cette mention. Si un seul article ne la porte pas, le tarif habituel s'applique : {{shipping.cotonou}}, offerte dès {{shipping.freeFrom}} d'achat. Il n'y a qu'un seul frais de livraison par commande, quel que soit le nombre d'articles.

Un pack a sa propre mention : elle ne s'applique pas aux produits du pack achetés séparément, et la mention d'un produit ne s'applique pas au pack. Hors de Cotonou et Calavi, cette mention ne change rien : le tarif habituel s'applique ({{shipping.autre}}). Le total, livraison comprise, s'affiche toujours avant que vous validiez votre commande.
```

PROPOSÉ EN (Markdown) :

```
## Free delivery in Cotonou and Calavi

An item or a pack can carry the “free delivery” mention. You can see it on its page and in your cart.

In Cotonou and Calavi, delivery is free when every item in your cart carries this mention. If a single item does not, the usual fee applies: {{shipping.cotonou}}, free from {{shipping.freeFrom}} of purchases. There is only one delivery fee per order, however many items it contains.

A pack has its own mention: it does not apply to the products of the pack bought separately, and a product's mention does not apply to the pack. Outside Cotonou and Calavi, this mention changes nothing: the usual fee applies ({{shipping.autre}}). The total, delivery included, is always shown before you confirm your order.
```

Clés `account.json` pour le repli code (si Kody ajoute le bloc à `ShippingDoc.tsx`) :
- FR : `freeH` = `Livraison offerte à Cotonou et Calavi` ; `freeP1` = `Un article ou un pack peut porter la mention « livraison offerte ». Vous la voyez sur sa fiche et dans votre panier.` ; `freeP2` = `À Cotonou et Calavi, la livraison est offerte quand tous les articles de votre panier portent cette mention. Si un seul article ne la porte pas, le tarif habituel s'applique : {cotonou}, offerte dès {freeShip} d'achat. Il n'y a qu'un seul frais de livraison par commande, quel que soit le nombre d'articles.` ; `freeP3` = `Un pack a sa propre mention : elle ne s'applique pas aux produits du pack achetés séparément, et la mention d'un produit ne s'applique pas au pack. Hors de Cotonou et Calavi, cette mention ne change rien : le tarif habituel s'applique ({autre}). Le total, livraison comprise, s'affiche toujours avant que vous validiez votre commande.`
- EN : `freeH` = `Free delivery in Cotonou and Calavi` ; `freeP1`, `freeP2`, `freeP3` = les trois paragraphes EN ci-dessus, avec {cotonou}, {freeShip}, {autre} à la place des marqueurs {{...}}.

---

## 4. CGV, article 6 "Livraison"

Où : BASE (page `cgv`), repli dans `defaults.ts` (FR l. 127, EN l. 181) et `account.json › Legal.cgv.s6`. Une seule phrase d'ouverture change, plus 4 phrases ajoutées à la fin du 1er paragraphe (Cotonou et Calavi). Le reste de l'article est inchangé.

ACTUEL FR (fin du 1er paragraphe) :
> ... La livraison coûte {{shipping.cotonou}} et elle est offerte dès {{shipping.freeFrom}} d'achat.

PROPOSÉ FR (remplace la dernière phrase) :
> ... La livraison coûte {{shipping.cotonou}} et elle est offerte dès {{shipping.freeFrom}} d'achat. Elle est aussi offerte lorsque tous les articles de votre commande portent la mention « livraison offerte », affichée sur leur fiche et dans votre panier. Si un seul article ne porte pas cette mention, le tarif habituel s'applique. Un seul frais de livraison est compté par commande, quel que soit le nombre d'articles. La mention d'un pack s'applique au pack, et non aux produits qu'il contient lorsqu'ils sont achetés séparément. Cette mention ne concerne que Cotonou et Calavi.

ACTUEL EN :
> ... Delivery costs {{shipping.cotonou}} and is free from {{shipping.freeFrom}} of purchases.

PROPOSÉ EN :
> ... Delivery costs {{shipping.cotonou}} and is free from {{shipping.freeFrom}} of purchases. It is also free when every item in your order carries the “free delivery” mention, shown on the item page and in your cart. If a single item does not carry this mention, the usual fee applies. One delivery fee is charged per order, however many items it contains. A pack's mention applies to the pack, not to the products it contains when they are bought separately. This mention only applies in Cotonou and Calavi.

Repli `account.json › Legal.cgv.s6.p` (3e personne, style du repli) : insérer après `offerte dès {freeShip} d'achat.` :
- FR : ` Elle est aussi offerte lorsque tous les articles de la commande portent la mention « livraison offerte », affichée sur leur fiche et dans le panier ; si un seul article ne la porte pas, le tarif habituel s'applique. Un seul frais de livraison est compté par commande. La mention d'un pack s'applique au pack, et non aux produits qu'il contient achetés séparément. Cette mention ne concerne que Cotonou et Calavi.`
- EN : ` It is also free when every item in the order carries the “free delivery” mention, shown on the item page and in the cart; if a single item does not carry it, the usual fee applies. One delivery fee is charged per order. A pack's mention applies to the pack, not to the products it contains when bought separately. This mention only applies in Cotonou and Calavi.`

### Cohérence CGV art. 5 (revue du 2026-10-13, P1, encore en attente)

- Pas de contradiction : l'art. 5 (moyens de paiement) et l'art. 6 (livraison) sont indépendants, et l'art. 3 ("Les frais de livraison s'ajoutent au prix ... vous les voyez avant de valider") reste exact : quand la livraison est offerte, le montant affiché est 0.
- Les deux modifications portent sur la MÊME page en base. Les faire dans une seule session d'édition (art. 5 de P1 + art. 6 ci-dessus), en repartant du texte actuellement en base et non du fichier : sinon la seconde sauvegarde peut écraser la première.
- Si la page CGV affiche une date de dernière mise à jour, la mettre à jour avec cette modification.

---

## 5. Notes `noteFreeProductCond` et `noteZoneFreeProduct` (code, `common.json` l. 36-37)

Verdict : **cohérentes avec la règle, y compris pour un pack, mais deux retouches conseillées (risque faible à moyen).**

Constat (`DeliveryNote` dans `DeliveryPromise.tsx`) : le même composant sert la fiche produit et la fiche pack, avec `freeShipping={pack.freeShipping}` pour un pack. La ligne 1 ("livraison offerte pour cet article") + la ligne 2 grise ("Offerte si tous les articles du panier le sont aussi.") sont donc justes pour un pack : un pack coché affiche la mention, son comportement est celui d'un article.

Points faibles :
1. Ligne 1 : "livraison offerte pour cet article" se lit comme une promesse inconditionnelle si l'on ne lit que la ligne en gras. La condition n'est que dans la ligne 2, en petit et en gris. C'est le risque de pratique trompeuse par omission le plus concret de la fonctionnalité (loi 2007-21). Retouche : ne pas dire que la livraison est offerte, dire que l'article est "à livraison offerte".
2. Ligne 2 : n'indique pas ce qui se passe sinon, ni que le seuil habituel reste possible. Retouche : ajouter "Sinon, le tarif habituel s'applique."

ACTUEL FR :
- `noteZoneFreeProduct` : Cotonou & Calavi · livraison offerte pour cet article
- `noteFreeProductCond` : Offerte si tous les articles du panier le sont aussi.

PROPOSÉ FR :
- `noteZoneFreeProduct` : Cotonou & Calavi · article à livraison offerte
- `noteFreeProductCond` : La livraison est offerte si tous les articles de votre panier ont cette mention. Sinon, le tarif habituel s'applique.

ACTUEL EN :
- `noteZoneFreeProduct` : Cotonou & Calavi · free delivery on this item
- `noteFreeProductCond` : Free when every item in your cart qualifies too.

PROPOSÉ EN :
- `noteZoneFreeProduct` : Cotonou & Calavi · free-delivery item
- `noteFreeProductCond` : Delivery is free if every item in your cart has this mention. Otherwise, the usual fee applies.

Note de lecture : la ligne 2 est suivie de `noteOther` ("Autres villes du Bénin : 48 à 72 h, {price}."), donc "hors zone" est déjà dit.

### Panier (optionnel, recommandé, clé à créer par Kody dans `checkout.json`)

Cas qui surprend : le panier est à livraison offerte, le client ajoute un article non coché, la livraison passe de 0 à 1 000 F. Le total est affiché avant la commande, ce qui suffit légalement, mais un message de cause évite le sentiment de piège.
- FR : `Un article de votre panier n'est pas à livraison offerte : le tarif habituel s'applique.`
- EN : `One item in your cart is not marked free delivery: the usual fee applies.`
À afficher seulement si la zone est Cotonou ou Calavi, qu'au moins un article est coché et qu'au moins un ne l'est pas, et qu'il reste des frais à payer.

---

## 6. Autres surfaces qui disent "1 000 F, offerte dès 15 000 F" sans la règle

### 6.1 FAQ "Combien coûte la livraison ?" (code, `account.json › Faq.a2`) : à ajuster

ACTUEL FR : `{cotonou} à Cotonou et Calavi, offerte dès {freeShip} d'achat. {autre} dans les autres villes du Bénin.`
PROPOSÉ FR : `{cotonou} à Cotonou et Calavi, offerte dès {freeShip} d'achat, ou quand tous les articles du panier portent la mention « livraison offerte ». {autre} dans les autres villes du Bénin.`

ACTUEL EN : `{cotonou} in Cotonou and Calavi, free from {freeShip} of purchases. {autre} in other cities in Benin.`
PROPOSÉ EN : `{cotonou} in Cotonou and Calavi, free from {freeShip} of purchases, or when every item in the cart carries the “free delivery” mention. {autre} in other cities in Benin.`

### 6.2 Contexte des brouillons de réponse IA admin (code, interne ; validation du texte exact requise)

`src/lib/conversations/ai-draft.ts` l. 45, ACTUEL FR : `... Frais : ${fmtXof(s.cotonou)}. Livraison offerte dès ${fmtXof(s.freeFrom)} dans cette zone seulement.`
PROPOSÉ FR : `... Frais : ${fmtXof(s.cotonou)}. Livraison offerte dès ${fmtXof(s.freeFrom)} dans cette zone seulement, ou quand tous les articles de la commande portent la mention « livraison offerte » (un seul frais par commande ; la mention d'un pack ne s'applique pas à ses produits achetés séparément).`
(Même ajout pour la version EN du même fichier, juste avant la ligne 38, que je n'ai pas lue en entier : `... or when every item in the order carries the "free delivery" mention (one fee per order; a pack's mention does not apply to its products bought separately).`)

`src/lib/admin/ai/corpus.ts` l. 76, ACTUEL : `Livraison offerte dès ${...} d'achat, dans la zone Cotonou/Abomey-Calavi seulement.`
PROPOSÉ : `Livraison offerte dès ${...} d'achat, dans la zone Cotonou/Abomey-Calavi seulement, ou quand tous les articles de la commande portent la mention « livraison offerte » (case cochée dans l'admin).`

### 6.3 À ne pas changer
- Bandeau du haut (`Shell.topbar.freeShip`, "Livraison offerte dès {amount} à Cotonou & Calavi") : reste vrai, la zone y est déjà (point P2 de la revue du 10-13 appliqué).
- Panier : `shipFree` ("Livraison offerte à Cotonou et Calavi") : juste dans les deux cas (franco ou articles cochés).

---

## Risques et points de vigilance

| Niveau | Point | Détail |
|---|---|---|
| Orange | Mention "pour cet article" (fiches) | Voir point 5 : condition en petit et en gris, promesse en ligne 1. A corriger si la mise en ligne est déjà faite. |
| Orange | Publicités, réseaux sociaux, bandeaux | Toute annonce "livraison gratuite" sur un article doit dire "à Cotonou et Calavi" ET "si tous les articles du panier sont à livraison offerte" (ou "sous conditions" avec renvoi à la page). Pas de "livraison gratuite" seul. A transmettre à Marcus et Noah. |
| Orange | Version en base qui prime | Tant que l'administrateur n'a pas modifié la fiche KB 0003 et les pages Livraison et retours / CGV dans l'admin, l'assistant (réponse IA des faits) et les pages publiques disent encore l'ancienne règle. Tout reste vrai (tarif habituel) mais incomplet. |
| Orange | Assistant et articles cochés | L'assistant ne connaît pas la case de chaque article. Il ne doit jamais affirmer qu'un article précis est "livré gratuitement" : le texte de la fiche 0003 l'envoie vers la fiche ou le panier. Si Kody veut aller plus loin, il faut lui fournir la donnée dans `productDocs` (changement de code, hors périmètre). |
| Vert | Commentaires de code périmés | `src/lib/checkout/shipping.ts` l. 42 ("pack : tous ses produits cochés") et l'en-tête de `0025_...sql` (l. 8) décrivent la règle de la migration 0025. La règle en prod est celle de 0026 (la case du pack seule compte). Corriger les commentaires pour éviter qu'un futur développeur "réaligne" le code sur l'ancienne règle. Aucun impact client. |
| Vert | Chiffres en clair dans la fiche KB | 1 000 F / 2 500 F / 15 000 F ne suivent pas les réglages (risque connu). Penser à ressaisir la fiche 0003 à chaque changement de tarif. |

## Points à faire trancher par Fresnel

1. Remboursement des frais de livraison et retour d'un seul article d'une commande à livraison offerte : aucune règle écrite (déjà ouvert, question 4 du 10-13). L'assistant ne doit pas répondre.
2. Les listes de produits (catalogue, cartes) affichent-elles la mention ? Si oui, le texte de cette carte doit suivre la même formule que le point 5 (non vérifié, je n'ai pas lu les cartes).

## Rappel de procédure

1. Valider le texte exact (surtout 2.1, 3.3, 4 et 5).
2. Code : points 1, 5, 6.1, 6.2 et repli du 3.2/3.3/4 (Kody), puis régénérer la migration de seed des pages.
3. Admin : fiche KB 0003 et 0013 ; page Livraison et retours ; page CGV (art. 5 et 6 ensemble).
4. Relire une réponse de l'assistant sur "Combien coûte la livraison ?" après mise en ligne (réponse directe et réponse IA).

Disclaimer : évaluation de risque, pas un conseil juridique formel. Pour un point à fort enjeu (modification des CGV), consulter un juriste béninois.
