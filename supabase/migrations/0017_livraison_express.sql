-- 0017_livraison_express.sql — Livraison Express : le jour même avant l'heure limite (20 h), sinon le lendemain, 7 j/7 ; paiement à la livraison = délai après confirmation WhatsApp (décisions Fresnel 2026-10-11).
-- Ne remplace une page QUE si son titre ET son texte sont encore ceux d'origine : une page modifiée depuis l'admin
-- n'est jamais écrasée. Comparaison et écriture sans les retours chariot (chr(13)) : un copier-coller depuis Windows
-- ajoute des fins de ligne CRLF. Rejouable sans effet. Source : src/lib/pages/defaults.ts.


-- Heure limite pour une livraison le jour même : 18 h → 20 h (seulement si elle n'a pas été changée dans l'admin).
update public.settings set value = jsonb_set(value, '{cutoff}', '20'::jsonb)
where key = 'shipping' and (value ->> 'cutoff') = '18';

update public.pages set title = 'Livraison et retours', body_md = replace('| Zone | Délai | Frais |
|---|---|---|
| Cotonou et Calavi (Livraison Express) | Le jour même si vous commandez avant {{shipping.cutoff}} h, sinon le lendemain. 7 j/7, dimanche compris | {{shipping.cotonou}}, offerte dès {{shipping.freeFrom}} |
| Autres villes du Bénin | 48 à 72 h | {{shipping.autre}} |
| Hors du Bénin | Pas encore disponible | Sans objet |

## Le jour de la livraison

Nous vous envoyons une confirmation sur WhatsApp avec le créneau de livraison. Si vous payez à la réception, l''heure limite s''applique à l''heure de cette confirmation. Le livreur vous appelle avant d''arriver. {{pay.codShip}}

## Retourner un produit

1. Écrivez-nous au plus tard {{shipping.returnDays}} après la réception, sur WhatsApp ou via le [formulaire de contact](/contact), en indiquant votre numéro de commande.
2. À Cotonou et Calavi, notre livreur passe reprendre le produit chez vous. Ailleurs au Bénin, nous vous expliquons comment nous l''envoyer.
3. Une fois le produit vérifié, nous l''échangeons ou nous vous remboursons sous {{shipping.returnDays}}.

## Conditions

Le produit doit être non utilisé, complet et dans son emballage d''origine. Les produits d''hygiène ne sont plus repris une fois descellés, sauf s''ils ont un défaut. Si le produit a un défaut ou si l''erreur vient de nous, le retour est gratuit. Pour un simple changement d''avis hors de Cotonou et Calavi, les frais de retour sont à votre charge.

[Écrire au service client](/contact){button}', chr(13), '')
where slug = 'livraison-retours' and locale = 'fr' and title = 'Livraison et retours'
  and replace(body_md, chr(13), '') = replace('| Zone | Délai | Frais |
|---|---|---|
| Cotonou et Calavi | Le lendemain si vous commandez avant {{shipping.cutoff}} h. Commandes et livraisons du lundi au samedi | {{shipping.cotonou}}, offerte dès {{shipping.freeFrom}} |
| Autres villes du Bénin | 48 à 72 h | {{shipping.autre}} |
| Hors du Bénin | Pas encore disponible | Sans objet |

## Le jour de la livraison

Nous vous envoyons une confirmation sur WhatsApp avec le créneau de livraison. Le livreur vous appelle avant d''arriver. {{pay.codShip}}

## Retourner un produit

1. Écrivez-nous au plus tard {{shipping.returnDays}} après la réception, sur WhatsApp ou via le [formulaire de contact](/contact), en indiquant votre numéro de commande.
2. À Cotonou et Calavi, notre livreur passe reprendre le produit chez vous. Ailleurs au Bénin, nous vous expliquons comment nous l''envoyer.
3. Une fois le produit vérifié, nous l''échangeons ou nous vous remboursons sous {{shipping.returnDays}}.

## Conditions

Le produit doit être non utilisé, complet et dans son emballage d''origine. Les produits d''hygiène ne sont plus repris une fois descellés, sauf s''ils ont un défaut. Si le produit a un défaut ou si l''erreur vient de nous, le retour est gratuit. Pour un simple changement d''avis hors de Cotonou et Calavi, les frais de retour sont à votre charge.

[Écrire au service client](/contact){button}', chr(13), '');

update public.pages set title = 'Delivery and returns', body_md = replace('| Zone | Lead time | Fee |
|---|---|---|
| Cotonou and Calavi (Express Delivery) | Same day if you order before {{shipping.cutoff}}:00, otherwise the next day. 7 days a week, Sundays included | {{shipping.cotonou}}, free from {{shipping.freeFrom}} |
| Other cities in Benin | 48 to 72 hours | {{shipping.autre}} |
| Outside Benin | Not available yet | N/A |

## On delivery day

We send you a WhatsApp confirmation with your delivery time slot. If you pay on delivery, the cut-off time applies to the time of that confirmation. The courier calls you before arriving. {{pay.codShip}}

## Returning a product

1. Write to us no later than {{shipping.returnDays}} after you receive it, on WhatsApp or through the [contact form](/contact), and include your order number.
2. In Cotonou and Calavi, our courier comes to pick the product up from you. Elsewhere in Benin, we explain how to send it to us.
3. Once we''ve checked the product, we exchange it or refund you within {{shipping.returnDays}}.

## Conditions

The product must be unused, complete and in its original packaging. Hygiene products can''t be returned once unsealed, unless they''re faulty. If the product is faulty or the mistake is ours, the return is free. For a simple change of mind outside Cotonou and Calavi, the return costs are paid by you.

[Write to customer service](/contact){button}', chr(13), '')
where slug = 'livraison-retours' and locale = 'en' and title = 'Delivery and returns'
  and replace(body_md, chr(13), '') = replace('| Zone | Lead time | Fee |
|---|---|---|
| Cotonou and Calavi | Next day if you order before {{shipping.cutoff}}:00. Orders and deliveries Monday to Saturday | {{shipping.cotonou}}, free from {{shipping.freeFrom}} |
| Other cities in Benin | 48 to 72 hours | {{shipping.autre}} |
| Outside Benin | Not available yet | N/A |

## On delivery day

We send you a WhatsApp confirmation with your delivery time slot. The courier calls you before arriving. {{pay.codShip}}

## Returning a product

1. Write to us no later than {{shipping.returnDays}} after you receive it, on WhatsApp or through the [contact form](/contact), and include your order number.
2. In Cotonou and Calavi, our courier comes to pick the product up from you. Elsewhere in Benin, we explain how to send it to us.
3. Once we''ve checked the product, we exchange it or refund you within {{shipping.returnDays}}.

## Conditions

The product must be unused, complete and in its original packaging. Hygiene products can''t be returned once unsealed, unless they''re faulty. If the product is faulty or the mistake is ours, the return is free. For a simple change of mind outside Cotonou and Calavi, the return costs are paid by you.

[Write to customer service](/contact){button}', chr(13), '');

update public.pages set title = 'Conditions générales de vente', body_md = replace('## 1. Qui vend, qui achète

Ces conditions s''appliquent à tous les achats faits sur le site Wá xɔ. Le vendeur est {{legal.companyName}}, {{legal.legalForm}}, immatriculée au RCCM sous le numéro {{legal.rccm}}, IFU {{legal.ifu}}, dont le siège est situé {{legal.address}}, Cotonou (« Wá xɔ » ou « nous »). L''acheteur est toute personne qui passe commande (« vous » ou « le client »). En validant une commande, vous acceptez ces conditions.

## 2. Produits

Vous pouvez acheter les produits affichés sur le site, dans la limite du stock disponible. Nous stockons nous-mêmes nos produits à Cotonou, et le stock affiché se met à jour à chaque commande. Nos photos et descriptions sont aussi fidèles que possible. Une légère différence de teinte ou d''emballage ne rend pas le produit non conforme.

## 3. Prix

Les prix sont en francs CFA, toutes taxes comprises. Les frais de livraison s''ajoutent au prix des produits ; vous les voyez avant de valider votre commande. Vous payez le prix affiché au moment où vous commandez.

## 4. Commande

Pour commander, vous choisissez vos produits, vous indiquez vos coordonnées de livraison, vous choisissez un moyen de paiement, puis vous validez. Un numéro de commande (WX-…) s''affiche et vous recevez une confirmation par WhatsApp ou SMS.

Nous pouvons annuler une commande si les informations sont incomplètes, si un produit n''est plus disponible ou en cas de problème de paiement. Dans ce cas, nous vous remboursons intégralement.

## 5. Paiement

Nous acceptons MTN MoMo, Moov Money, Celtiis Cash et les cartes bancaires Visa ou Mastercard{{pay.codCgv}}. Les paiements en ligne passent par un prestataire de paiement agréé. Nous n''avons jamais accès à vos codes secrets ni à votre numéro de carte complet.

## 6. Livraison

Cotonou et Calavi (Livraison Express) : nous livrons tous les jours, dimanche compris. Une commande passée avant {{shipping.cutoff}} h (heure du Bénin) est livrée le jour même, sinon le lendemain. Si vous payez à la livraison, l''heure limite s''applique à l''heure à laquelle nous confirmons votre commande sur WhatsApp. La livraison coûte {{shipping.cotonou}} et elle est offerte dès {{shipping.freeFrom}} d''achat.

Autres villes du Bénin : livraison sous 48 à 72 h, pour {{shipping.autre}}.

Le livreur vous appelle avant de venir. Si vous n''êtes pas là, nous vous proposons une nouvelle livraison. Après deux tentatives sans succès, nous pouvons annuler la commande. Pour le moment, nous ne livrons pas hors du Bénin.

Ces délais s''appliquent hors force majeure (intempéries, grève, route coupée…). En cas de retard, nous vous prévenons sur WhatsApp ; vous pouvez alors annuler et être remboursé intégralement.

## 7. Échange et remboursement

Vous avez {{shipping.returnDays}} à partir de la réception pour demander un échange ou un remboursement, sans avoir à vous justifier. Le produit doit être non utilisé, complet et dans son emballage d''origine.

Les produits d''hygiène ou de soin descellés (par exemple une brosse visage, une tondeuse ou des pinceaux de maquillage) ne sont ni repris ni échangés, sauf s''ils ont un défaut.

Nous vous remboursons sous {{shipping.returnDays}} après avoir reçu le produit retourné, avec le moyen de paiement utilisé pour la commande. Si vous avez payé à la livraison, nous vous remboursons par Mobile Money. Pour un simple changement d''avis hors de Cotonou et Calavi, les frais de retour sont à votre charge. Toute la marche à suivre est sur la page [Livraison et retours](/livraison-retours).

## 8. Produit défectueux ou non conforme

Si un produit a un défaut ou ne correspond pas à votre commande, signalez-le dans les 48 h qui suivent la réception, avec une photo. Nous l''échangeons ou nous vous le remboursons, et les frais de retour sont à notre charge.

## 9. Données personnelles

Les données que vous nous donnez en commandant sont traitées comme expliqué dans notre [politique de confidentialité](/confidentialite).

## 10. Droit applicable et litiges

Ces conditions sont soumises au droit béninois. En cas de désaccord, contactez d''abord notre service client pour chercher ensemble une solution à l''amiable. Si aucune solution n''est trouvée, le litige sera porté devant les juridictions compétentes de Cotonou.', chr(13), '')
where slug = 'cgv' and locale = 'fr' and title = 'Conditions générales de vente'
  and replace(body_md, chr(13), '') = replace('## 1. Qui vend, qui achète

Ces conditions s''appliquent à tous les achats faits sur le site Wá xɔ. Le vendeur est {{legal.companyName}}, {{legal.legalForm}}, immatriculée au RCCM sous le numéro {{legal.rccm}}, IFU {{legal.ifu}}, dont le siège est situé {{legal.address}}, Cotonou (« Wá xɔ » ou « nous »). L''acheteur est toute personne qui passe commande (« vous » ou « le client »). En validant une commande, vous acceptez ces conditions.

## 2. Produits

Vous pouvez acheter les produits affichés sur le site, dans la limite du stock disponible. Nous stockons nous-mêmes nos produits à Cotonou, et le stock affiché se met à jour à chaque commande. Nos photos et descriptions sont aussi fidèles que possible. Une légère différence de teinte ou d''emballage ne rend pas le produit non conforme.

## 3. Prix

Les prix sont en francs CFA, toutes taxes comprises. Les frais de livraison s''ajoutent au prix des produits ; vous les voyez avant de valider votre commande. Vous payez le prix affiché au moment où vous commandez.

## 4. Commande

Pour commander, vous choisissez vos produits, vous indiquez vos coordonnées de livraison, vous choisissez un moyen de paiement, puis vous validez. Un numéro de commande (WX-…) s''affiche et vous recevez une confirmation par WhatsApp ou SMS.

Nous pouvons annuler une commande si les informations sont incomplètes, si un produit n''est plus disponible ou en cas de problème de paiement. Dans ce cas, nous vous remboursons intégralement.

## 5. Paiement

Nous acceptons MTN MoMo, Moov Money, Celtiis Cash et les cartes bancaires Visa ou Mastercard{{pay.codCgv}}. Les paiements en ligne passent par un prestataire de paiement agréé. Nous n''avons jamais accès à vos codes secrets ni à votre numéro de carte complet.

## 6. Livraison

Cotonou et Calavi : nous traitons les commandes et nous livrons du lundi au samedi. Une commande passée avant {{shipping.cutoff}} h est livrée le lendemain, et nous ne livrons pas le dimanche. La livraison coûte {{shipping.cotonou}} et elle est offerte dès {{shipping.freeFrom}} d''achat.

Autres villes du Bénin : livraison sous 48 à 72 h, pour {{shipping.autre}}.

Le livreur vous appelle avant de venir. Si vous n''êtes pas là, nous vous proposons une nouvelle livraison. Après deux tentatives sans succès, nous pouvons annuler la commande. Pour le moment, nous ne livrons pas hors du Bénin.

## 7. Échange et remboursement

Vous avez {{shipping.returnDays}} à partir de la réception pour demander un échange ou un remboursement, sans avoir à vous justifier. Le produit doit être non utilisé, complet et dans son emballage d''origine.

Les produits d''hygiène ou de soin descellés (par exemple une brosse visage, une tondeuse ou des pinceaux de maquillage) ne sont ni repris ni échangés, sauf s''ils ont un défaut.

Nous vous remboursons sous {{shipping.returnDays}} après avoir reçu le produit retourné, avec le moyen de paiement utilisé pour la commande. Si vous avez payé à la livraison, nous vous remboursons par Mobile Money. Pour un simple changement d''avis hors de Cotonou et Calavi, les frais de retour sont à votre charge. Toute la marche à suivre est sur la page [Livraison et retours](/livraison-retours).

## 8. Produit défectueux ou non conforme

Si un produit a un défaut ou ne correspond pas à votre commande, signalez-le dans les 48 h qui suivent la réception, avec une photo. Nous l''échangeons ou nous vous le remboursons, et les frais de retour sont à notre charge.

## 9. Données personnelles

Les données que vous nous donnez en commandant sont traitées comme expliqué dans notre [politique de confidentialité](/confidentialite).

## 10. Droit applicable et litiges

Ces conditions sont soumises au droit béninois. En cas de désaccord, contactez d''abord notre service client pour chercher ensemble une solution à l''amiable. Si aucune solution n''est trouvée, le litige sera porté devant les juridictions compétentes de Cotonou.', chr(13), '');

update public.pages set title = 'Terms of sale', body_md = replace('## 1. Who sells, who buys

These terms apply to every purchase made on the Wá xɔ website. The seller is {{legal.companyName}}, {{legal.legalForm}}, registered with the RCCM under number {{legal.rccm}}, IFU {{legal.ifu}}, with its registered office at {{legal.address}}, Cotonou (“Wá xɔ” or “we”). The buyer is anyone who places an order (“you” or “the customer”). By confirming an order, you accept these terms.

## 2. Products

You can buy the products shown on the site, while stocks last. We store our products ourselves in Cotonou, and the stock shown updates with every order. Our photos and descriptions are as accurate as we can make them. A slight difference in color or packaging does not make a product non-conforming.

## 3. Prices

Prices are in CFA francs, all taxes included. Delivery fees are added to the price of the products, and you see them before you confirm your order. You pay the price shown at the time you order.

## 4. Ordering

To order, you choose your products, enter your delivery details, pick a payment method and confirm. An order number (WX-…) appears and you receive a confirmation by WhatsApp or SMS.

We may cancel an order if the information is incomplete, if a product is no longer available or if there is a payment problem. In that case, we refund you in full.

## 5. Payment

We accept MTN MoMo, Moov Money, Celtiis Cash and Visa or Mastercard bank cards{{pay.codCgv}}. Online payments go through an approved payment provider. We never have access to your secret codes or your full card number.

## 6. Delivery

Cotonou and Calavi (Express Delivery): we deliver every day, Sundays included. An order placed before {{shipping.cutoff}}:00 (Benin time) is delivered the same day, otherwise the next day. If you pay on delivery, the cut-off time applies to the time we confirm your order on WhatsApp. Delivery costs {{shipping.cotonou}} and is free from {{shipping.freeFrom}} of purchases.

Other cities in Benin: delivery within 48 to 72 hours, for {{shipping.autre}}.

The courier calls you before coming. If you''re not there, we offer you a new delivery. After two unsuccessful attempts, we may cancel the order. For now, we don''t deliver outside Benin.

These lead times apply except in cases of force majeure (severe weather, strikes, road closures…). If there is a delay, we let you know on WhatsApp; you can then cancel and get a full refund.

## 7. Exchange and refund

You have {{shipping.returnDays}} from receipt to ask for an exchange or a refund, without having to give a reason. The product must be unused, complete and in its original packaging.

Unsealed hygiene or care products (for example a face brush, a trimmer or makeup brushes) are neither taken back nor exchanged, unless they''re faulty.

We refund you within {{shipping.returnDays}} of receiving the returned product, using the payment method you used for the order. If you paid on delivery, we refund you by Mobile Money. For a simple change of mind outside Cotonou and Calavi, the return costs are paid by you. All the steps are on the [Delivery and returns](/livraison-retours) page.

## 8. Faulty or non-conforming product

If a product is faulty or doesn''t match your order, let us know within 48 hours of receipt, with a photo. We exchange it or refund you, and we cover the return costs.

## 9. Personal data

The data you give us when you order is handled as explained in our [privacy policy](/confidentialite).

## 10. Governing law and disputes

These terms are governed by Beninese law. If there''s a disagreement, contact our customer service first so we can look for an amicable solution together. If no solution is found, the dispute will be brought before the competent courts of Cotonou.', chr(13), '')
where slug = 'cgv' and locale = 'en' and title = 'Terms of sale'
  and replace(body_md, chr(13), '') = replace('## 1. Who sells, who buys

These terms apply to every purchase made on the Wá xɔ website. The seller is {{legal.companyName}}, {{legal.legalForm}}, registered with the RCCM under number {{legal.rccm}}, IFU {{legal.ifu}}, with its registered office at {{legal.address}}, Cotonou (“Wá xɔ” or “we”). The buyer is anyone who places an order (“you” or “the customer”). By confirming an order, you accept these terms.

## 2. Products

You can buy the products shown on the site, while stocks last. We store our products ourselves in Cotonou, and the stock shown updates with every order. Our photos and descriptions are as accurate as we can make them. A slight difference in color or packaging does not make a product non-conforming.

## 3. Prices

Prices are in CFA francs, all taxes included. Delivery fees are added to the price of the products, and you see them before you confirm your order. You pay the price shown at the time you order.

## 4. Ordering

To order, you choose your products, enter your delivery details, pick a payment method and confirm. An order number (WX-…) appears and you receive a confirmation by WhatsApp or SMS.

We may cancel an order if the information is incomplete, if a product is no longer available or if there is a payment problem. In that case, we refund you in full.

## 5. Payment

We accept MTN MoMo, Moov Money, Celtiis Cash and Visa or Mastercard bank cards{{pay.codCgv}}. Online payments go through an approved payment provider. We never have access to your secret codes or your full card number.

## 6. Delivery

Cotonou and Calavi: we process orders and deliver Monday to Saturday. An order placed before {{shipping.cutoff}}:00 is delivered the next day, and we don''t deliver on Sundays. Delivery costs {{shipping.cotonou}} and is free from {{shipping.freeFrom}} of purchases.

Other cities in Benin: delivery within 48 to 72 hours, for {{shipping.autre}}.

The courier calls you before coming. If you''re not there, we offer you a new delivery. After two unsuccessful attempts, we may cancel the order. For now, we don''t deliver outside Benin.

## 7. Exchange and refund

You have {{shipping.returnDays}} from receipt to ask for an exchange or a refund, without having to give a reason. The product must be unused, complete and in its original packaging.

Unsealed hygiene or care products (for example a face brush, a trimmer or makeup brushes) are neither taken back nor exchanged, unless they''re faulty.

We refund you within {{shipping.returnDays}} of receiving the returned product, using the payment method you used for the order. If you paid on delivery, we refund you by Mobile Money. For a simple change of mind outside Cotonou and Calavi, the return costs are paid by you. All the steps are on the [Delivery and returns](/livraison-retours) page.

## 8. Faulty or non-conforming product

If a product is faulty or doesn''t match your order, let us know within 48 hours of receipt, with a photo. We exchange it or refund you, and we cover the return costs.

## 9. Personal data

The data you give us when you order is handled as explained in our [privacy policy](/confidentialite).

## 10. Governing law and disputes

These terms are governed by Beninese law. If there''s a disagreement, contact our customer service first so we can look for an amicable solution together. If no solution is found, the dispute will be brought before the competent courts of Cotonou.', chr(13), '');
