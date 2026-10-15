# Textes « livraison offerte » à coller dans l'admin (2026-10-15)

Textes validés par Fresnel le 2026-10-15. Ces quatre textes vivent dans la BASE DE DONNÉES : la version en base prime sur le code, donc le déploiement ne les change pas. À coller à la main dans l'admin. Copier depuis ce fichier (les espaces insécables avant « : » et « ; » et dans les guillemets sont déjà posées).

## 1. Fiche « Frais de livraison et livraison offerte »
Admin → Assistant IA → fiche « Frais de livraison et livraison offerte » → remplacer tout le champ Texte par ce qui suit (849 caractères, limite 900), puis ajouter à la FIN des mots-clés : `article articles panier pack mention un seul frais`.

```
À Cotonou et Abomey-Calavi, la livraison coûte 1 000 F et elle est offerte dès 15 000 F d'achat, ou quand tous les articles du panier portent la mention « livraison offerte ». Dans les autres villes du Bénin, elle coûte 2 500 F : la livraison offerte ne concerne que la zone Cotonou et Calavi. Pour savoir si un article ou un pack porte la mention, regardez sa fiche ou votre panier. Si un seul article du panier ne la porte pas, le tarif habituel s'applique. Il n'y a qu'un seul frais de livraison par commande, quel que soit le nombre d'articles. Un pack a sa propre mention : elle ne s'applique pas à ses produits achetés séparément, et celle d'un produit ne s'applique pas au pack. Les frais de livraison s'ajoutent au prix des produits et vous voyez le total avant de valider votre commande. Les prix sont en francs CFA, toutes taxes comprises.
```

Penser à mettre ces chiffres à jour si les tarifs changent (ils ne suivent pas les Réglages).

## 2. Fiche « Les packs »
Admin → Assistant IA → fiche « Les packs » → remplacer tout le champ Texte par (637 caractères) :

```
Un pack réunit des produits choisis pour aller ensemble, vendus à un prix plus doux que séparément. Sur la page du pack, le prix du pack est affiché face à la somme des produits achetés à l'unité : vous voyez l'économie. Vous commandez le pack en un clic, nous emballons tout ensemble et nous livrons un seul colis. Un pack peut porter la mention « livraison offerte » à Cotonou et Calavi : si c'est le cas, elle est indiquée sur la page du pack. Si un des produits du pack n'est plus en stock, le pack est indiqué épuisé ; les produits sont aussi vendus à l'unité dans le catalogue. Les packs disponibles sont sur la page Packs du site.
```

## 3. Page « Livraison et retours »
Admin → Pages d'infos → « Livraison et retours », en FR puis en EN. Les {{marqueurs}} sont remplacés automatiquement par les réglages.

**a) Dans le tableau, dernière cellule de la ligne « Cotonou et Calavi » (Livraison Express)** :

FR :
```
{{shipping.cotonou}}, offerte dès {{shipping.freeFrom}} d'achat, ou si tous les articles du panier sont à livraison offerte (voir ci-dessous)
```
EN :
```
{{shipping.cotonou}}, free from {{shipping.freeFrom}} of purchases, or if every item in your cart is marked free delivery (see below)
```

**b) Nouveau paragraphe, à insérer juste AVANT le titre « Le jour de la livraison » (FR) / « On delivery day » (EN)** :

FR :
```
## Livraison offerte à Cotonou et Calavi

Un article ou un pack peut porter la mention « livraison offerte ». Vous la voyez sur sa fiche et dans votre panier.

À Cotonou et Calavi, la livraison est offerte quand tous les articles de votre panier portent cette mention. Si un seul article ne la porte pas, le tarif habituel s'applique : {{shipping.cotonou}}, offerte dès {{shipping.freeFrom}} d'achat. Il n'y a qu'un seul frais de livraison par commande, quel que soit le nombre d'articles.

Un pack a sa propre mention : elle ne s'applique pas aux produits du pack achetés séparément, et la mention d'un produit ne s'applique pas au pack. Hors de Cotonou et Calavi, cette mention ne change rien : le tarif habituel s'applique ({{shipping.autre}}). Le total, livraison comprise, s'affiche toujours avant que vous validiez votre commande.
```
EN :
```
## Free delivery in Cotonou and Calavi

An item or a pack can carry the “free delivery” mention. You can see it on its page and in your cart.

In Cotonou and Calavi, delivery is free when every item in your cart carries this mention. If a single item does not, the usual fee applies: {{shipping.cotonou}}, free from {{shipping.freeFrom}} of purchases. There is only one delivery fee per order, however many items it contains.

A pack has its own mention: it does not apply to the products of the pack bought separately, and a product's mention does not apply to the pack. Outside Cotonou and Calavi, this mention changes nothing: the usual fee applies ({{shipping.autre}}). The total, delivery included, is always shown before you confirm your order.
```

## 4. CGV, article 6 « Livraison »
Admin → Pages d'infos → CGV. Dans l'article 6, 1er paragraphe, juste après « … et elle est offerte dès {{shipping.freeFrom}} d'achat. » (EN : « … is free from {{shipping.freeFrom}} of purchases. »), ajouter :

FR :
```
Elle est aussi offerte lorsque tous les articles de votre commande portent la mention « livraison offerte », affichée sur leur fiche et dans votre panier. Si un seul article ne porte pas cette mention, le tarif habituel s'applique. Un seul frais de livraison est compté par commande, quel que soit le nombre d'articles. La mention d'un pack s'applique au pack, et non aux produits qu'il contient lorsqu'ils sont achetés séparément. Cette mention ne concerne que Cotonou et Calavi.
```
EN :
```
It is also free when every item in your order carries the “free delivery” mention, shown on the item page and in your cart. If a single item does not carry this mention, the usual fee applies. One delivery fee is charged per order, however many items it contains. A pack's mention applies to the pack, not to the products it contains when they are bought separately. This mention only applies in Cotonou and Calavi.
```

À faire dans la MÊME session d'édition que l'article 5 (texte Helena du 2026-10-13, `docs/reviews/helena-kb-2026-10-13.md`, point P1) : une sauvegarde peut écraser l'autre si on repart d'une version ancienne. Si la page CGV affiche une date de mise à jour, la mettre à jour.

## Après avoir collé
Poser à l'assistant du site « Combien coûte la livraison ? » et vérifier que la réponse mentionne les articles à livraison offerte.
