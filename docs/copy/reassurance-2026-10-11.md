# Réassurance : « Livraison rapide » + bloc « Nos garanties » (2026-10-11)

Proposition Marcus. Aucun fichier du site n'est modifié.

Conventions :
- Ce fichier peut contenir des espaces ordinaires. Au moment d'appliquer en FR, mettre une espace insécable U+00A0 avant « : ? ! », à l'intérieur des « », dans « 24 h/24 » (entre 24 et h) et, de préférence, dans « {cutoff} h » / « {hour} h » (évite qu'un « h » se retrouve seul à la ligne sur mobile).
- Aucun tiret cadratin. Variables et syntaxe ICU plural conservées à l'identique.
- Faits respectés : « dès le lendemain » (jamais « en 24 h »), pas de dimanche promis, aucune réduction de livraison, assistance 24 h/24 = l'assistant IA ; l'équipe humaine est citée sans délai.

---

## 1. `src/messages/{fr,en}/shop.json`

### Shell.topbar

| Clé | FR actuel | FR proposé | EN proposé |
|---|---|---|---|
| `Shell.topbar.delivery` | Livraison demain à Cotonou & Calavi | Livraison rapide à Cotonou & Calavi | Fast delivery in Cotonou & Calavi |

### Home

| Clé | FR actuel | FR proposé | EN proposé |
|---|---|---|---|
| `Home.title` | Les petites choses utiles, livrées demain. | Les petites choses utiles, livrées vite chez vous. | Small useful things, delivered fast to your door. |
| `Home.g1Title` | Livré demain | Shopper depuis chez vous | Shop from home |
| `Home.g1Sub` | Cotonou & Calavi, commande avant {hour} h | Vous commandez, on emballe, on livre | You order, we pack, we deliver |
| `Home.g2CodTitle` | Payez à la réception | Payez à la réception (inchangé) | Pay on delivery (unchanged) |
| `Home.g2CodSub` | Ou MTN MoMo, Moov Money, Celtiis Cash, carte | (inchangé) | (unchanged) |
| `Home.g2Title` | Paiement Mobile Money | (inchangé) | (unchanged) |
| `Home.g2Sub` | MTN MoMo, Moov Money, Celtiis Cash ou carte | (inchangé) | (unchanged) |
| `Home.g3Title` | Stock réel, chez nous | Livraison rapide | Fast delivery |
| `Home.g3Sub` | Ce que vous voyez est disponible | Dès le lendemain à Cotonou & Calavi si vous commandez avant {hour} h | As soon as the next day in Cotonou & Calavi if you order before {hour}:00 |
| `Home.g4Title` | {days} jours pour changer d'avis | Assistance 24 h/24 | 24/7 support |
| `Home.g4Sub` | Échange ou remboursement | L'assistant répond jour et nuit, l'équipe sur WhatsApp | Our assistant answers day and night, our team on WhatsApp |

Note g1Sub : texte de Fresnel conservé, seul le point final est retiré pour s'aligner sur les autres sous-titres (aucun n'en a). Si Fresnel tient au point, le remettre partout ou nulle part.

---

## 2. `src/messages/{fr,en}/product.json`

| Clé | FR actuel | FR proposé | EN proposé |
|---|---|---|---|
| `stockLow` | Plus que {count} en stock. Commandez avant {cutoff} h, livré demain à Cotonou. | Plus que {count} en stock. Commandez avant {cutoff} h, livraison rapide à Cotonou. | Only {count} left in stock. Order before {cutoff}:00 for fast delivery in Cotonou. |
| `stockOk` | En stock. Commandez avant {cutoff} h, livré demain à Cotonou. | En stock. Commandez avant {cutoff} h, livraison rapide à Cotonou. | In stock. Order before {cutoff}:00 for fast delivery in Cotonou. |
| `deliveryNote` | Commandez avant {cutoff} h, recevez demain à Cotonou et Calavi. | Livraison rapide à Cotonou et Calavi : dès le lendemain si vous commandez avant {cutoff} h, du lundi au samedi. | Fast delivery in Cotonou and Calavi: as soon as the next day if you order before {cutoff}:00, Monday to Saturday. |

Logique : la ligne de stock (en haut, près du prix) garde l'heure limite comme levier d'action ; la note sous le bouton donne le fait concret et complet (lendemain, lundi au samedi). Le client du samedi soir n'est pas déçu, et on ne promet rien de faux.

---

## 3. `src/messages/{fr,en}/packs.json`

| Clé | FR actuel | FR proposé | EN proposé |
|---|---|---|---|
| `Packs.metaDescription` | Des packs de produits choisis pour aller ensemble, moins chers que séparément. Stock à Cotonou, livraison demain. | Des packs de produits choisis pour aller ensemble, moins chers que séparément. Stock à Cotonou, livraison rapide. | Bundles of products chosen to go together, cheaper than buying separately. Stock in Cotonou, fast delivery. |
| `Packs.detail.stockLow` | {count, plural, one {Plus qu’# pack en stock.} other {Plus que # packs en stock.}} Commandez avant {cutoff} h, livré demain à Cotonou. | {count, plural, one {Plus qu’# pack en stock.} other {Plus que # packs en stock.}} Commandez avant {cutoff} h, livraison rapide à Cotonou. | {count, plural, one {Only # pack left.} other {Only # packs left.}} Order before {cutoff}:00 for fast delivery in Cotonou. |
| `Packs.detail.stockOk` | En stock. Commandez avant {cutoff} h, livré demain à Cotonou. | En stock. Commandez avant {cutoff} h, livraison rapide à Cotonou. | In stock. Order before {cutoff}:00 for fast delivery in Cotonou. |
| `Packs.detail.deliveryNote` | Commandez avant {cutoff} h, recevez demain à Cotonou et Calavi. | Livraison rapide à Cotonou et Calavi : dès le lendemain si vous commandez avant {cutoff} h, du lundi au samedi. | Fast delivery in Cotonou and Calavi: as soon as the next day if you order before {cutoff}:00, Monday to Saturday. |

`Packs.card.stockLow` / `stockOk` (lignes 33-34) ne parlent pas de délai : rien à changer.

---

## 4. `src/messages/{fr,en}/consent.json` (section `Seo`)

| Clé | FR actuel | FR proposé | EN proposé |
|---|---|---|---|
| `Seo.description` | Les petites choses utiles, livrées demain à Cotonou. | Les petites choses utiles du quotidien, à petit prix et livrées vite à Cotonou et Calavi. Paiement Mobile Money ou carte. | Small useful everyday things at small prices, delivered fast in Cotonou and Calavi. Pay by Mobile Money or card. |
| `Seo.ogSubtitle` | Livrées demain à Cotonou | Livrées vite à Cotonou & Calavi | Delivered fast in Cotonou & Calavi |

La description Google passe de 52 à environ 120 caractères : on occupe l'extrait, on ajoute « petit prix » (mot de recherche) et le paiement. Le paiement à la livraison n'y figure pas exprès : il peut être désactivé, et `ogFooter` le mentionne déjà.

---

## 5. Justifications conversion et variantes

### Titre d'accueil : « Les petites choses utiles, livrées vite chez vous. »
- Garde la première moitié, déjà mémorisable et propre à la marque ; seul le bénéfice final change.
- « chez vous » ramène la promesse au client (le confort de ne pas se déplacer à Dantokpa) et fait écho au slogan « Shopper depuis chez vous ».
- « vite » est vrai partout au Bénin, y compris hors Cotonou ; « demain » ne l'était pas.

Variante : « Utile, pas cher, livré vite chez vous. » (plus percutant sur mobile, met le prix en avant ; perd un peu de la chaleur de « petites choses »).

### Garantie 3 : « Livraison rapide » / « Dès le lendemain à Cotonou & Calavi si vous commandez avant {hour} h »
- Titre court, exactement le mot que Fresnel veut installer ; le sous-titre prouve la rapidité par un fait au lieu d'un adjectif creux.
- « Dès » rend la promesse vraie même le samedi soir et le dimanche ; l'heure limite reste un déclencheur d'action honnête (vraie échéance, pas de fausse urgence).

Variante : « Livré vite à Cotonou & Calavi » / « Commandé avant {hour} h, chez vous dès le lendemain ».

### Garantie 4 : « Assistance 24 h/24 » / « L'assistant répond jour et nuit, l'équipe sur WhatsApp »
- Lève l'objection n° 1 de l'achat en ligne au Bénin : « si j'ai un souci, qui me répond ? ». Deux réponses : immédiate (l'assistant) et humaine (WhatsApp, canal de confiance local).
- Formulation exacte : le 24 h/24 est porté par l'assistant, l'équipe est citée sans délai promis.
- « 24 h/24 » est la graphie correcte de « 24/24 », sans changer le sens voulu par Fresnel.

Variante : « Une question ? Réponse à toute heure » / « Assistant du site 7 j/7, équipe sur WhatsApp ».

---

## 6. Notes pour Kody (technique, à ton jugement)

1. `src/components/shop/HomeHero.tsx` lignes 134-137 : l'ordre des variables ne suit plus les clés. Après le changement, `g1Sub` n'a plus de variable, `g3Sub` a besoin de `{ hour: settings.shipping.cutoff }`, `g4Title` n'utilise plus `{days}`. Sans ce remappage, `g3Sub` affichera « {hour} » en brut ou lèvera une erreur next-intl.
2. Redite : `Home.lead` se termine déjà par « Vous commandez, on emballe, on livre. », juste au-dessus de la garantie 1. À trancher avec Fresnel : soit raccourcir le lead à « Des objets du quotidien choisis pour leur utilité et leur prix. », soit garder la répétition (effet slogan). Je recommande de raccourcir le lead.
3. Les mentions « {days} jours pour changer d'avis » et « Stock réel » sortent de l'accueil : elles restent sur la page Livraison et retours et dans `defaults.ts`. Si l'on veut garder le retour gratuit visible, le bandeau du haut ou la fiche produit (`payAll` ligne suivante) peuvent l'accueillir plus tard.
