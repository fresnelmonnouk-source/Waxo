-- 0013_pages_natural_rewrite.sql — pages d'infos réécrites en langage naturel (Marcus, relu par Helena, 2026-10-11).
-- Ne remplace une page QUE si son titre ET son texte sont encore ceux d'origine : une page modifiée depuis l'admin
-- n'est jamais écrasée. Comparaison et écriture sans les retours chariot (chr(13)) : un copier-coller depuis Windows
-- ajoute des fins de ligne CRLF. Rejouable sans effet. Source : src/lib/pages/defaults.ts.

update public.pages set title = 'Une boutique en ligne pour les petites choses utiles.', body_md = replace('Wá xɔ, en fon, ça veut dire « venez acheter ». Nous choisissons des objets du quotidien, nous les gardons dans notre propre stock à Cotonou et nous vous les livrons à domicile, souvent dès le lendemain.

Nous n''avons pas de boutique physique. Quand vous commandez, le produit part directement de notre stock. C''est pour ça que le stock affiché sur le site est le vrai, et que nous pouvons livrer vite.

## Tout est en stock chez nous

Si un produit est sur le site, il est disponible. Le stock se met à jour à chaque commande.

## Des objets du quotidien

Maison, cuisine, beauté, bureau, tech, voyage : des choses utiles, à petits prix.

## Un service proche de vous

Confirmation sur WhatsApp, livraison à domicile, et échange ou remboursement sous {{shipping.returnDays}}.', chr(13), '')
where slug = 'a-propos' and locale = 'fr' and title = 'Une boutique en ligne pour les petites choses utiles.'
  and replace(body_md, chr(13), '') = replace('Wá xɔ veut dire « venez acheter » en fon. Nous choisissons des objets du quotidien, nous les stockons nous-mêmes à Cotonou et nous les livrons chez vous, souvent dès le lendemain.

Nous n''avons pas de boutique physique. Quand vous commandez, le produit part directement de notre stock : c''est ce qui nous permet d''afficher un stock réel et de livrer vite.

## Tout est en stock chez nous

Ce que vous voyez sur le site est disponible. Le stock est mis à jour à chaque commande.

## Des objets du quotidien

Pour la maison, la cuisine, la beauté, le bureau, la tech et le voyage, à petits prix.

## Un service proche de vous

Confirmation sur WhatsApp, livraison à domicile et échange ou remboursement sous {{shipping.returnDays}}.', chr(13), '');

update public.pages set title = 'An online shop for small, useful things.', body_md = replace('Wá xɔ means “come and buy” in Fon. We pick everyday items, keep them in our own stock in Cotonou and bring them to your door, often the very next day.

We don''t have a physical shop. When you order, your item goes out straight from our stock. That''s why the stock you see on the site is real, and why we can deliver quickly.

## Everything is in stock with us

If it''s on the site, it''s available. Stock updates with every order.

## Everyday items

Home, kitchen, beauty, office, tech and travel: useful things at small prices.

## A service close to you

WhatsApp confirmation, home delivery, and an exchange or refund within {{shipping.returnDays}}.', chr(13), '')
where slug = 'a-propos' and locale = 'en' and title = 'An online shop for small, useful things.'
  and replace(body_md, chr(13), '') = replace('Wá xɔ means “come and buy” in Fon. We pick everyday items, store them ourselves in Cotonou and deliver them to your door, often the very next day.

We have no physical store. When you order, the product leaves straight from our stock: that is what lets us show real stock levels and deliver fast.

## Everything is in stock with us

What you see on the site is available. Stock is updated with every order.

## Everyday items

For the home, kitchen, beauty, office, tech and travel, at small prices.

## A service close to you

Confirmation on WhatsApp, home delivery, and exchange or refund within {{shipping.returnDays}}.', chr(13), '');

update public.pages set title = 'Livraison et retours', body_md = replace('| Zone | Délai | Frais |
|---|---|---|
| Cotonou et Calavi | Le lendemain si vous commandez avant {{shipping.cutoff}} h, du lundi au samedi | {{shipping.cotonou}}, offerte dès {{shipping.freeFrom}} |
| Autres villes du Bénin | 48 à 72 h | {{shipping.autre}} |
| Hors du Bénin | Pas encore disponible | – |

## Le jour de la livraison

Nous vous envoyons une confirmation sur WhatsApp avec le créneau de livraison. Le livreur vous appelle avant d''arriver. {{pay.codShip}}

## Retourner un produit

1. Écrivez-nous au plus tard {{shipping.returnDays}} après la réception, sur WhatsApp ou via le [formulaire de contact](/contact), en indiquant votre numéro de commande.
2. À Cotonou et Calavi, notre livreur passe reprendre le produit chez vous. Ailleurs au Bénin, nous vous expliquons comment nous l''envoyer.
3. Une fois le produit vérifié, nous l''échangeons ou nous vous remboursons sous {{shipping.returnDays}}.

## Conditions

Le produit doit être non utilisé, complet et dans son emballage d''origine. Les produits d''hygiène ne sont plus repris une fois descellés, sauf s''ils ont un défaut. Si le produit a un défaut ou si l''erreur vient de nous, le retour est gratuit. {{todo:Préciser qui paie le retour pour un changement d''avis hors de Cotonou.}}

[Écrire au service client](/contact){button}', chr(13), '')
where slug = 'livraison-retours' and locale = 'fr' and title = 'Livraison et retours'
  and replace(body_md, chr(13), '') = replace('| Zone | Délai | Frais |
|---|---|---|
| Cotonou et Calavi | Le lendemain, commande avant {{shipping.cutoff}} h, du lundi au samedi | {{shipping.cotonou}}, offerte dès {{shipping.freeFrom}} |
| Autres villes du Bénin | 48 à 72 h | {{shipping.autre}} |
| Hors du Bénin | Pas encore disponible | – |

## Le jour de la livraison

Vous recevez une confirmation par WhatsApp avec le créneau de livraison. Le livreur vous appelle avant d''arriver. {{pay.codShip}}

## Retourner un produit

1. Écrivez-nous dans les {{shipping.returnDays}} suivant la réception, par WhatsApp ou par le [formulaire de contact](/contact), avec votre numéro de commande.
2. À Cotonou et Calavi, notre livreur reprend le produit chez vous. Ailleurs au Bénin, nous vous indiquons comment nous l''envoyer.
3. Après vérification, nous échangeons le produit ou vous remboursons sous {{shipping.returnDays}}.

## Conditions

Produit non utilisé, complet et dans son emballage d''origine. Les produits d''hygiène descellés sont exclus, sauf défaut. Le retour est gratuit en cas de défaut ou d''erreur de notre part. {{todo:Préciser qui paie le retour pour un changement d''avis hors de Cotonou.}}

[Contacter le service client](/contact){button}', chr(13), '');

update public.pages set title = 'Delivery and returns', body_md = replace('| Zone | Lead time | Fee |
|---|---|---|
| Cotonou and Calavi | Next day if you order before {{shipping.cutoff}}:00, Monday to Saturday | {{shipping.cotonou}}, free from {{shipping.freeFrom}} |
| Other cities in Benin | 48 to 72 hours | {{shipping.autre}} |
| Outside Benin | Not available yet | – |

## On delivery day

We send you a WhatsApp confirmation with your delivery time slot. The courier calls you before arriving. {{pay.codShip}}

## Returning a product

1. Write to us no later than {{shipping.returnDays}} after you receive it, on WhatsApp or through the [contact form](/contact), and include your order number.
2. In Cotonou and Calavi, our courier comes to pick the product up from you. Elsewhere in Benin, we explain how to send it to us.
3. Once we''ve checked the product, we exchange it or refund you within {{shipping.returnDays}}.

## Conditions

The product must be unused, complete and in its original packaging. Hygiene products can''t be returned once unsealed, unless they''re faulty. If the product is faulty or the mistake is ours, the return is free. {{todo:State who pays for the return on a change of mind outside Cotonou.}}

[Write to customer service](/contact){button}', chr(13), '')
where slug = 'livraison-retours' and locale = 'en' and title = 'Delivery and returns'
  and replace(body_md, chr(13), '') = replace('| Zone | Lead time | Fee |
|---|---|---|
| Cotonou and Calavi | Next day, order before {{shipping.cutoff}}:00, Monday to Saturday | {{shipping.cotonou}}, free from {{shipping.freeFrom}} |
| Other cities in Benin | 48 to 72 hours | {{shipping.autre}} |
| Outside Benin | Not available yet | – |

## On delivery day

You receive a WhatsApp confirmation with the delivery time slot. The courier calls you before arriving. {{pay.codShip}}

## Returning a product

1. Write to us within {{shipping.returnDays}} of receipt, on WhatsApp or via the [contact form](/contact), with your order number.
2. In Cotonou and Calavi, our courier collects the product from you. Elsewhere in Benin, we tell you how to send it to us.
3. After checking, we exchange the product or refund you within {{shipping.returnDays}}.

## Conditions

Unused product, complete and in its original packaging. Unsealed hygiene products are excluded, unless faulty. The return is free in case of a defect or an error on our side. {{todo:State who pays for the return on a change of mind outside Cotonou.}}

[Contact customer service](/contact){button}', chr(13), '');

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

Cotonou et Calavi : livraison le lendemain pour toute commande passée avant {{shipping.cutoff}} h, du lundi au samedi. Elle coûte {{shipping.cotonou}} et elle est offerte dès {{shipping.freeFrom}} d''achat.

Autres villes du Bénin : livraison sous 48 à 72 h, pour {{shipping.autre}}.

Le livreur vous appelle avant de venir. Si vous n''êtes pas là, nous vous proposons une nouvelle livraison. Après deux tentatives sans succès, nous pouvons annuler la commande. Pour le moment, nous ne livrons pas hors du Bénin.

## 7. Échange et remboursement

Vous avez {{shipping.returnDays}} à partir de la réception pour demander un échange ou un remboursement, sans avoir à vous justifier. Le produit doit être non utilisé, complet et dans son emballage d''origine.

Les produits d''hygiène ou de soin descellés (par exemple une brosse visage, une tondeuse ou des pinceaux de maquillage) ne sont ni repris ni échangés, sauf s''ils ont un défaut.

Nous vous remboursons sous {{shipping.returnDays}} après avoir reçu le produit retourné, avec le moyen de paiement utilisé pour la commande. Si vous avez payé à la livraison, nous vous remboursons par Mobile Money. Toute la marche à suivre est sur la page [Livraison et retours](/livraison-retours).

## 8. Produit défectueux ou non conforme

Si un produit a un défaut ou ne correspond pas à votre commande, signalez-le dans les 48 h qui suivent la réception, avec une photo. Nous l''échangeons ou nous vous le remboursons, et les frais de retour sont à notre charge.

## 9. Données personnelles

Les données que vous nous donnez en commandant sont traitées comme expliqué dans notre [politique de confidentialité](/confidentialite).

## 10. Droit applicable et litiges

Ces conditions sont soumises au droit béninois. En cas de désaccord, contactez d''abord notre service client pour chercher ensemble une solution à l''amiable. Si aucune solution n''est trouvée, le litige sera porté devant les juridictions compétentes de Cotonou.', chr(13), '')
where slug = 'cgv' and locale = 'fr' and title = 'Conditions générales de vente'
  and replace(body_md, chr(13), '') = replace('## 1. Objet

Les présentes conditions régissent les ventes conclues sur le site Wá xɔ entre {{legal.companyName}}, {{legal.legalForm}}, immatriculée au RCCM sous le numéro {{legal.rccm}}, IFU {{legal.ifu}}, dont le siège est situé {{legal.address}}, Cotonou (ci-après « Wá xɔ »), et toute personne qui passe commande (ci-après « le client »). Valider une commande vaut acceptation de ces conditions.

## 2. Produits

Les produits proposés sont ceux affichés sur le site, dans la limite des stocks disponibles. Wá xɔ stocke elle-même ses produits à Cotonou ; le stock affiché est mis à jour à chaque commande. Les photos et descriptions sont aussi fidèles que possible ; une légère différence de teinte ou d''emballage ne constitue pas une non-conformité.

## 3. Prix

Les prix sont indiqués en francs CFA, toutes taxes comprises. Les frais de livraison s''ajoutent au prix des produits et sont affichés avant la validation de la commande. Le prix facturé est celui affiché au moment de la commande.

## 4. Commande

Le client sélectionne ses produits, indique ses coordonnées de livraison, choisit un moyen de paiement puis valide sa commande. Un numéro de commande (WX-…) s''affiche et une confirmation est envoyée par WhatsApp ou SMS. Wá xɔ peut annuler une commande en cas d''informations incomplètes, de produit devenu indisponible ou d''incident de paiement ; le client est alors remboursé intégralement.

## 5. Paiement

Moyens acceptés : MTN MoMo, Moov Money, Celtiis Cash et carte bancaire Visa ou Mastercard{{pay.codCgv}}. Les paiements en ligne sont traités par un prestataire de paiement agréé ; Wá xɔ n''a jamais accès aux codes secrets ni aux numéros complets de carte.

## 6. Livraison

Cotonou et Calavi : livraison le lendemain pour toute commande passée avant {{shipping.cutoff}} h, du lundi au samedi, pour {{shipping.cotonou}}, offerte dès {{shipping.freeFrom}} d''achat. Autres villes du Bénin : sous 48 à 72 h, pour {{shipping.autre}}. Le livreur appelle le client avant son arrivée. En cas d''absence, une nouvelle livraison est proposée ; après deux tentatives sans succès, la commande peut être annulée. Pas de livraison hors du Bénin pour le moment.

## 7. Échange et remboursement

Le client dispose de {{shipping.returnDays}} à compter de la réception pour demander un échange ou un remboursement, sans avoir à se justifier, pour un produit non utilisé, complet et dans son emballage d''origine. Les produits d''hygiène ou de soin descellés (brosse visage, tondeuse, pinceaux de maquillage, par exemple) ne sont ni repris ni échangés, sauf défaut. Le remboursement est fait par le moyen de paiement initial, ou par Mobile Money pour un paiement à la livraison, sous {{shipping.returnDays}} après réception du produit retourné. La procédure figure sur la page [Livraison et retours](/livraison-retours).

## 8. Produit défectueux ou non conforme

Tout défaut ou erreur de produit est à signaler dans les 48 h suivant la réception, photo à l''appui. Wá xɔ échange ou rembourse le produit et prend en charge les frais de retour.

## 9. Données personnelles

Les données collectées lors de la commande sont traitées selon notre [politique de confidentialité](/confidentialite).

## 10. Droit applicable et litiges

Ces conditions sont soumises au droit béninois. En cas de différend, le client contacte d''abord le service client pour rechercher une solution amiable. À défaut, le litige est porté devant les juridictions compétentes de Cotonou.', chr(13), '');

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

Cotonou and Calavi: next-day delivery for any order placed before {{shipping.cutoff}}:00, Monday to Saturday. It costs {{shipping.cotonou}} and is free from {{shipping.freeFrom}} of purchases.

Other cities in Benin: delivery within 48 to 72 hours, for {{shipping.autre}}.

The courier calls you before coming. If you''re not there, we offer you a new delivery. After two unsuccessful attempts, we may cancel the order. For now, we don''t deliver outside Benin.

## 7. Exchange and refund

You have {{shipping.returnDays}} from receipt to ask for an exchange or a refund, without having to give a reason. The product must be unused, complete and in its original packaging.

Unsealed hygiene or care products (for example a face brush, a trimmer or makeup brushes) are neither taken back nor exchanged, unless they''re faulty.

We refund you within {{shipping.returnDays}} of receiving the returned product, using the payment method you used for the order. If you paid on delivery, we refund you by Mobile Money. All the steps are on the [Delivery and returns](/livraison-retours) page.

## 8. Faulty or non-conforming product

If a product is faulty or doesn''t match your order, let us know within 48 hours of receipt, with a photo. We exchange it or refund you, and we cover the return costs.

## 9. Personal data

The data you give us when you order is handled as explained in our [privacy policy](/confidentialite).

## 10. Governing law and disputes

These terms are governed by Beninese law. If there''s a disagreement, contact our customer service first so we can look for an amicable solution together. If no solution is found, the dispute will be brought before the competent courts of Cotonou.', chr(13), '')
where slug = 'cgv' and locale = 'en' and title = 'Terms of sale'
  and replace(body_md, chr(13), '') = replace('## 1. Purpose

These terms govern sales made on the Wá xɔ website between {{legal.companyName}}, {{legal.legalForm}}, registered in the RCCM under number {{legal.rccm}}, IFU {{legal.ifu}}, whose registered office is at {{legal.address}}, Cotonou (“Wá xɔ”), and anyone who places an order (“the customer”). Confirming an order constitutes acceptance of these terms.

## 2. Products

The products offered are those displayed on the site, while stocks last. Wá xɔ stores its products itself in Cotonou; the stock shown is updated with every order. Photos and descriptions are as accurate as possible; a slight difference in color or packaging is not a non-conformity.

## 3. Prices

Prices are shown in CFA francs, all taxes included. Delivery fees are added to the price of the products and are shown before the order is confirmed. The price charged is the one displayed at the time of the order.

## 4. Ordering

The customer selects products, provides delivery details, chooses a payment method and confirms the order. An order number (WX-…) is displayed and a confirmation is sent by WhatsApp or SMS. Wá xɔ may cancel an order in case of incomplete information, a product that has become unavailable or a payment incident; the customer is then fully refunded.

## 5. Payment

Accepted methods: MTN MoMo, Moov Money, Celtiis Cash and Visa or Mastercard bank cards{{pay.codCgv}}. Online payments are handled by an approved payment provider; Wá xɔ never has access to secret codes or full card numbers.

## 6. Delivery

Cotonou and Calavi: next-day delivery for any order placed before {{shipping.cutoff}}:00, Monday to Saturday, for {{shipping.cotonou}}, free from {{shipping.freeFrom}} of purchases. Other cities in Benin: within 48 to 72 hours, for {{shipping.autre}}. The courier calls the customer before arriving. If the customer is absent, a new delivery is offered; after two unsuccessful attempts, the order may be cancelled. No delivery outside Benin for now.

## 7. Exchange and refund

The customer has {{shipping.returnDays}} from receipt to request an exchange or a refund, without having to give a reason, for an unused, complete product in its original packaging. Unsealed hygiene or care products (face brush, trimmer, makeup brushes, for example) are neither taken back nor exchanged, unless faulty. The refund is made to the original payment method, or by Mobile Money for a payment on delivery, within {{shipping.returnDays}} of receiving the returned product. The procedure is on the [Delivery and returns](/livraison-retours) page.

## 8. Faulty or non-conforming product

Any defect or product error must be reported within 48 hours of receipt, with a photo. Wá xɔ exchanges or refunds the product and covers the return costs.

## 9. Personal data

Data collected when ordering is processed in accordance with our [privacy policy](/confidentialite).

## 10. Governing law and disputes

These terms are governed by Beninese law. In case of a dispute, the customer first contacts customer service to seek an amicable solution. Failing that, the dispute is brought before the competent courts of Cotonou.', chr(13), '');

update public.pages set title = 'Conditions générales d''utilisation', body_md = replace('## 1. À quoi servent ces conditions

Ces conditions fixent les règles d''accès au site Wá xɔ et d''utilisation de ses services : le catalogue, l''assistant, le compte client et les avis. Elles s''ajoutent aux [conditions générales de vente](/cgv), qui s''appliquent à chaque commande.

## 2. Accès au site

L''accès au site est gratuit. Nous pouvons le suspendre pour une maintenance ou une mise à jour.

## 3. Compte client

Vous n''avez pas besoin de compte pour commander. Il vous en faut un pour suivre vos commandes et publier un avis. Vous devez donner des informations exactes et garder votre mot de passe pour vous. Vous pouvez modifier vos informations depuis votre espace. Pour demander la suppression de votre compte, écrivez au service client.

## 4. Avis clients

Seuls les clients inscrits peuvent publier un avis, et un seul par produit. Votre avis doit porter sur une expérience réelle avec le produit.

Sont interdits : les insultes, les propos discriminatoires ou diffamatoires, la publicité et les données personnelles d''autres personnes.

Nous ne modifions jamais le contenu d''un avis. Nous pouvons en revanche masquer un avis qui ne respecte pas ces règles. Le badge « Achat vérifié » signifie que l''auteur a bien reçu ce produit par une commande Wá xɔ. Les avis ne sont pas rémunérés.

## 5. Assistant

L''assistant est un outil automatique qui fonctionne avec l''intelligence artificielle. Il vous aide à choisir un produit et répond aux questions courantes. Il peut se tromper : si sa réponse diffère de la fiche produit, du panier ou des conditions générales de vente, ce sont ces derniers qui font foi. Ne donnez jamais votre mot de passe, votre code Mobile Money ou votre numéro de carte dans la conversation.

## 6. Propriété intellectuelle

Le nom Wá xɔ, le logo, les textes et les photos du site appartiennent à {{legal.companyName}} ou à leurs auteurs. Vous ne pouvez pas les reproduire sans autorisation.

## 7. Responsabilité

Nous faisons attention à ce que les informations publiées soient exactes, mais nous ne pouvons pas garantir qu''il n''y ait jamais aucune erreur. Nous ne sommes pas responsables des dommages causés par une mauvaise utilisation du site ou par une interruption du service.

## 8. Modifications

Ces conditions peuvent changer. La version qui s''applique est celle publiée sur cette page.', chr(13), '')
where slug = 'cgu' and locale = 'fr' and title = 'Conditions générales d''utilisation'
  and replace(body_md, chr(13), '') = replace('## 1. Objet

Ces conditions encadrent l''accès au site Wá xɔ et l''utilisation de ses services : catalogue, assistant, compte client et avis. Elles complètent les [conditions générales de vente](/cgv), qui s''appliquent à toute commande.

## 2. Accès au site

Le site est accessible gratuitement. Wá xɔ peut en suspendre l''accès pour maintenance ou mise à jour.

## 3. Compte client

Le compte est facultatif pour commander. Il est nécessaire pour suivre ses commandes et publier un avis. Le client fournit des informations exactes et garde son mot de passe confidentiel. Il modifie ses informations depuis son espace et peut demander la suppression de son compte en écrivant au service client.

## 4. Avis clients

Seuls les clients inscrits peuvent publier un avis, à raison d''un avis par produit. L''avis porte sur une expérience réelle avec le produit. Sont interdits les propos injurieux, discriminatoires ou diffamatoires, la publicité et les données personnelles de tiers. Wá xɔ ne modifie jamais le contenu d''un avis ; elle peut masquer un avis qui ne respecte pas ces règles. Le badge « Achat vérifié » indique que l''auteur a reçu ce produit par une commande Wá xɔ. Les avis ne sont pas rémunérés.

## 5. Assistant

L''assistant est un outil automatisé fondé sur l''intelligence artificielle. Il aide à choisir un produit et répond aux questions courantes. Ses réponses peuvent comporter des erreurs : la fiche produit, le panier et les conditions générales de vente font foi. Ne communiquez jamais de mot de passe, de code Mobile Money ni de numéro de carte dans la conversation.

## 6. Propriété intellectuelle

Le nom Wá xɔ, le logo, les textes et les photos du site appartiennent à {{legal.companyName}} ou à leurs auteurs. Toute reproduction sans autorisation est interdite.

## 7. Responsabilité

Wá xɔ veille à l''exactitude des informations publiées sans pouvoir garantir l''absence totale d''erreur. Elle n''est pas responsable des dommages liés à une mauvaise utilisation du site ou à une interruption du service.

## 8. Modification

Ces conditions peuvent évoluer. La version applicable est celle publiée sur cette page.', chr(13), '');

update public.pages set title = 'Terms of use', body_md = replace('## 1. What these terms cover

These terms set the rules for accessing the Wá xɔ website and using its services: the catalog, the assistant, customer accounts and reviews. They come on top of the [terms of sale](/cgv), which apply to every order.

## 2. Access to the site

The site is free to use. We may suspend access for maintenance or an update.

## 3. Customer account

You don''t need an account to order. You do need one to track your orders and post a review. You must give accurate information and keep your password to yourself. You can update your details from your account area. To ask for your account to be deleted, write to customer service.

## 4. Customer reviews

Only registered customers can post a review, and only one per product. Your review must be about a real experience with the product.

Not allowed: insults, discriminatory or defamatory remarks, advertising, and other people''s personal data.

We never edit what a review says. We may, however, hide a review that breaks these rules. The “Verified purchase” badge means the author received this product through a Wá xɔ order. Reviews are not paid for.

## 5. Assistant

The assistant is an automated tool powered by artificial intelligence. It helps you choose a product and answers common questions. It can make mistakes: if what it says differs from the product page, the cart or the terms of sale, those take precedence. Never share your password, Mobile Money code or card number in the chat.

## 6. Intellectual property

The Wá xɔ name, the logo, and the texts and photos on the site belong to {{legal.companyName}} or to their authors. You may not reproduce them without permission.

## 7. Liability

We take care to keep the information on the site accurate, but we can''t guarantee it will never contain an error. We are not liable for damage caused by misuse of the site or by a service interruption.

## 8. Changes

These terms may change. The version that applies is the one published on this page.', chr(13), '')
where slug = 'cgu' and locale = 'en' and title = 'Terms of use'
  and replace(body_md, chr(13), '') = replace('## 1. Purpose

These terms govern access to the Wá xɔ website and the use of its services: catalog, assistant, customer account and reviews. They supplement the [terms of sale](/cgv), which apply to every order.

## 2. Access to the site

The site is free to access. Wá xɔ may suspend access for maintenance or updates.

## 3. Customer account

An account is optional for ordering. It is required to track orders and publish a review. The customer provides accurate information and keeps their password confidential. They can edit their details from their area and may ask for their account to be deleted by writing to customer service.

## 4. Customer reviews

Only registered customers can publish a review, one review per product. A review must reflect a real experience with the product. Insulting, discriminatory or defamatory remarks, advertising and third-party personal data are prohibited. Wá xɔ never edits the content of a review; it may hide a review that does not follow these rules. The “Verified purchase” badge indicates that the author received this product through a Wá xɔ order. Reviews are not paid for.

## 5. Assistant

The assistant is an automated tool based on artificial intelligence. It helps you choose a product and answers common questions. Its answers may contain errors: the product page, the cart and the terms of sale prevail. Never share a password, Mobile Money code or card number in the conversation.

## 6. Intellectual property

The Wá xɔ name, the logo, the texts and the photos on the site belong to {{legal.companyName}} or to their authors. Any reproduction without permission is prohibited.

## 7. Liability

Wá xɔ strives for the accuracy of the information published but cannot guarantee the total absence of errors. It is not liable for damage caused by misuse of the site or an interruption of the service.

## 8. Changes

These terms may change. The applicable version is the one published on this page.', chr(13), '');

update public.pages set title = 'Politique de confidentialité', body_md = replace('## Qui est responsable de vos données

{{legal.companyName}}, {{legal.address}}, Cotonou. Contact : {{brand.email}}.

## Les données que nous collectons

- Quand vous commandez : votre nom, votre téléphone, votre adresse de livraison, les produits commandés et le moyen de paiement choisi.
- Si vous créez un compte : votre prénom, votre nom, votre téléphone, votre e-mail, votre mot de passe (enregistré sous forme chiffrée), l''historique de vos commandes et les avis que vous publiez.
- Pour la newsletter : votre e-mail ou votre numéro WhatsApp.
- Quand vous nous écrivez ou utilisez l''assistant : le contenu de vos messages.

Les paiements en ligne sont traités directement par notre prestataire de paiement. Nous ne conservons ni code secret ni numéro de carte complet.

## À quoi elles servent

Nous utilisons vos données pour préparer, livrer et suivre vos commandes, vous contacter au sujet d''une commande, gérer votre compte et vos avis, vous envoyer la newsletter si vous l''avez demandée, répondre à vos messages et améliorer le site.

## Qui les reçoit

- L''équipe Wá xɔ.
- Le livreur, qui reçoit seulement votre nom, votre téléphone et votre adresse.
- Notre prestataire de paiement.
- L''hébergeur du site.
- Le fournisseur de la technologie d''intelligence artificielle de l''assistant, pour générer ses réponses.
- Meta, pour mesurer nos publicités.

Vos données ne sont jamais vendues.

## Combien de temps nous les gardons

- Compte : jusqu''à sa suppression, ou 3 ans après votre dernière activité.
- Commandes et factures : pendant la durée imposée par la réglementation comptable.
- Newsletter : jusqu''à votre désinscription.
- Messages : 1 an.

## Vos droits

Vous pouvez accéder à vos données, les corriger, vous opposer à leur utilisation ou demander leur suppression. Il suffit d''écrire à {{brand.email}}. Vous pouvez aussi déposer une réclamation auprès de l''Autorité de Protection des Données à caractère Personnel (APDP, apdp.bj).

## Ce qui est enregistré sur votre appareil

Le site garde sur votre appareil votre panier, les produits que vous avez consultés (pour la sélection personnalisée) et votre session de connexion.

Le site utilise aussi le pixel de Meta (Meta Platforms Ireland Ltd, et Meta Platforms Inc. aux États-Unis) pour mesurer l''efficacité de nos publicités Facebook et Instagram. Il transmet à Meta les pages vues, les ajouts au panier, les commandes et leur montant, associés à un identifiant technique de votre navigateur. Aucun nom, e-mail ni numéro de téléphone n''est transmis. Ces données sont traitées par Meta, notamment aux États-Unis.

Le pixel est actif dès votre arrivée sur le site. Vous pouvez le refuser à tout moment depuis « Gérer mes cookies » : l''envoi s''arrête alors et ses cookies sont effacés.

La mesure d''audience (Google Analytics) ne s''active qu''avec votre accord.

## Sécurité

Les échanges avec le site sont chiffrés (HTTPS). Seules les personnes habilitées peuvent accéder aux données.', chr(13), '')
where slug = 'confidentialite' and locale = 'fr' and title = 'Politique de confidentialité'
  and replace(body_md, chr(13), '') = replace('## Responsable du traitement

{{legal.companyName}}, {{legal.address}}, Cotonou. Contact : {{brand.email}}.

## Données collectées

Pour une commande : nom, téléphone, adresse de livraison, produits commandés et moyen de paiement choisi. Pour un compte : prénom, nom, téléphone, e-mail, mot de passe (enregistré sous forme chiffrée), historique des commandes et avis publiés. Pour la newsletter : e-mail ou numéro WhatsApp. Pour le contact et l''assistant : le contenu de vos messages. Les paiements en ligne sont traités directement par notre prestataire de paiement ; Wá xɔ ne conserve ni code secret ni numéro complet de carte.

## Utilisation

Préparer, livrer et suivre vos commandes ; vous contacter au sujet d''une commande ; gérer votre compte et vos avis ; vous envoyer la newsletter si vous l''avez demandée ; répondre à vos messages ; améliorer le site.

## Destinataires

L''équipe Wá xɔ, le livreur (nom, téléphone et adresse uniquement), le prestataire de paiement, l''hébergeur du site, le fournisseur de la technologie d''intelligence artificielle de l''assistant, pour générer les réponses, et Meta, pour la mesure de nos publicités. Vos données ne sont jamais vendues.

## Durée de conservation

Compte : jusqu''à sa suppression, ou 3 ans après votre dernière activité. Commandes et factures : pendant la durée imposée par la réglementation comptable. Newsletter : jusqu''à votre désinscription. Messages : 1 an.

## Vos droits

Vous pouvez accéder à vos données, les rectifier, vous opposer à leur utilisation ou demander leur suppression en écrivant à {{brand.email}}. Vous pouvez aussi saisir l''Autorité de Protection des Données à caractère Personnel (APDP, apdp.bj).

## Stockage sur votre appareil

Le site enregistre sur votre appareil votre panier, les produits consultés (pour la sélection personnalisée) et votre session de connexion. Le site utilise aussi le pixel de Meta (Meta Platforms Ireland Ltd, et Meta Platforms Inc. aux États-Unis) pour mesurer l''efficacité de nos publicités Facebook et Instagram : pages vues, ajouts au panier, commandes et leur montant, associés à un identifiant technique de votre navigateur. Aucun nom, e-mail ni téléphone n''est transmis. Ces données sont traitées par Meta, notamment aux États-Unis. Le pixel est actif dès votre arrivée sur le site ; vous pouvez le refuser à tout moment depuis « Gérer mes cookies » : l''envoi s''arrête alors et ses cookies sont effacés. La mesure d''audience (Google Analytics) n''est activée qu''avec votre accord.

## Sécurité

Les échanges avec le site sont chiffrés (HTTPS) et l''accès aux données est réservé aux personnes habilitées.', chr(13), '');

update public.pages set title = 'Privacy policy', body_md = replace('## Who is responsible for your data

{{legal.companyName}}, {{legal.address}}, Cotonou. Contact: {{brand.email}}.

## The data we collect

- When you order: your name, phone number, delivery address, the products you ordered and the payment method you chose.
- If you create an account: your first name, last name, phone number, email, password (stored in encrypted form), your order history and the reviews you post.
- For the newsletter: your email or WhatsApp number.
- When you write to us or use the assistant: the content of your messages.

Online payments are handled directly by our payment provider. We don''t keep secret codes or full card numbers.

## What we use it for

We use your data to prepare, deliver and track your orders, contact you about an order, manage your account and reviews, send you the newsletter if you asked for it, reply to your messages and improve the site.

## Who receives it

- The Wá xɔ team.
- The courier, who only gets your name, phone number and address.
- Our payment provider.
- The company that hosts the site.
- The provider of the artificial intelligence technology behind the assistant, to generate its answers.
- Meta, to measure our ads.

Your data is never sold.

## How long we keep it

- Account: until it''s deleted, or 3 years after your last activity.
- Orders and invoices: for as long as accounting rules require.
- Newsletter: until you unsubscribe.
- Messages: 1 year.

## Your rights

You can access your data, correct it, object to its use or ask for it to be deleted. Just write to {{brand.email}}. You can also file a complaint with the Personal Data Protection Authority (APDP, apdp.bj).

## What is stored on your device

The site stores your cart, the products you viewed (for the personalized selection) and your sign-in session on your device.

The site also uses the Meta pixel (Meta Platforms Ireland Ltd, and Meta Platforms Inc. in the United States) to measure how well our Facebook and Instagram ads perform. It sends Meta the pages you view, the items you add to your cart, your orders and their amount, linked to a technical identifier of your browser. No name, email or phone number is shared. This data is processed by Meta, including in the United States.

The pixel is active as soon as you arrive on the site. You can refuse it at any time from "Manage my cookies": sending then stops and its cookies are deleted.

Audience measurement (Google Analytics) is only turned on with your consent.

## Security

Exchanges with the site are encrypted (HTTPS). Only authorized people can access the data.', chr(13), '')
where slug = 'confidentialite' and locale = 'en' and title = 'Privacy policy'
  and replace(body_md, chr(13), '') = replace('## Data controller

{{legal.companyName}}, {{legal.address}}, Cotonou. Contact: {{brand.email}}.

## Data collected

For an order: name, phone, delivery address, products ordered and chosen payment method. For an account: first name, last name, phone, email, password (stored in encrypted form), order history and published reviews. For the newsletter: email or WhatsApp number. For contact and the assistant: the content of your messages. Online payments are handled directly by our payment provider; Wá xɔ keeps neither secret codes nor full card numbers.

## Use

Preparing, delivering and tracking your orders; contacting you about an order; managing your account and reviews; sending you the newsletter if you asked for it; replying to your messages; improving the site.

## Recipients

The Wá xɔ team, the courier (name, phone and address only), the payment provider, the site host, the provider of the artificial intelligence technology behind the assistant, to generate answers, and Meta, to measure our ads. Your data is never sold.

## Retention period

Account: until deleted, or 3 years after your last activity. Orders and invoices: for the period required by accounting regulations. Newsletter: until you unsubscribe. Messages: 1 year.

## Your rights

You can access your data, correct it, object to its use or ask for its deletion by writing to {{brand.email}}. You can also contact the Personal Data Protection Authority (APDP, apdp.bj).

## Storage on your device

The site stores on your device your cart, the products you viewed (for the personalized selection) and your sign-in session. The site also uses the Meta pixel (Meta Platforms Ireland Ltd, and Meta Platforms Inc. in the United States) to measure the performance of our Facebook and Instagram ads: pages viewed, items added to cart, orders and their amount, linked to a technical identifier of your browser. No name, email or phone number is shared. This data is processed by Meta, including in the United States. The pixel is active as soon as you arrive on the site; you can refuse it at any time from "Manage my cookies": sending then stops and its cookies are deleted. Audience measurement (Google Analytics) is only turned on with your consent.

## Security

Exchanges with the site are encrypted (HTTPS) and access to data is restricted to authorized people.', chr(13), '');

update public.pages set title = 'Mentions légales', body_md = replace('## Éditeur du site

{{legal.companyName}}, {{legal.legalForm}}
RCCM : {{legal.rccm}} · IFU : {{legal.ifu}}
Siège : {{legal.address}}, Cotonou, Bénin
WhatsApp : {{brand.whatsapp}} · E-mail : {{brand.email}}

## Directeur de la publication

{{legal.publicationDirector}}

## Hébergement

{{legal.hostName}}, {{legal.hostAddress}}

## Protection des données personnelles

Le site traite des données personnelles en respectant la réglementation applicable au Bénin. {{todo:Indiquer ici la formalité APDP (déclaration et récépissé) une fois accomplie.}} Vos droits sont expliqués en détail dans la [politique de confidentialité](/confidentialite).

## Propriété intellectuelle

Les contenus du site sont protégés. Pour en savoir plus, voyez l''article 6 des [conditions générales d''utilisation](/cgu).', chr(13), '')
where slug = 'mentions-legales' and locale = 'fr' and title = 'Mentions légales'
  and replace(body_md, chr(13), '') = replace('## Éditeur du site

{{legal.companyName}}, {{legal.legalForm}}
RCCM : {{legal.rccm}} · IFU : {{legal.ifu}}
Siège : {{legal.address}}, Cotonou, Bénin
WhatsApp : {{brand.whatsapp}} · E-mail : {{brand.email}}

## Directeur de la publication

{{legal.publicationDirector}}

## Hébergement

{{legal.hostName}}, {{legal.hostAddress}}

## Protection des données personnelles

Le site traite des données personnelles dans le respect de la réglementation applicable au Bénin. {{todo:Indiquer ici la formalité APDP (déclaration et récépissé) une fois accomplie.}} Vos droits sont détaillés dans la [politique de confidentialité](/confidentialite).

## Propriété intellectuelle

Les contenus du site sont protégés. Voir l''article 6 des [conditions générales d''utilisation](/cgu).', chr(13), '');

update public.pages set title = 'Legal notice', body_md = replace('## Site publisher

{{legal.companyName}}, {{legal.legalForm}}
RCCM: {{legal.rccm}} · IFU: {{legal.ifu}}
Registered office: {{legal.address}}, Cotonou, Benin
WhatsApp: {{brand.whatsapp}} · Email: {{brand.email}}

## Publication director

{{legal.publicationDirector}}

## Hosting

{{legal.hostName}}, {{legal.hostAddress}}

## Personal data protection

The site processes personal data in line with the regulations that apply in Benin. {{todo:State here the APDP formality (declaration and receipt) once completed.}} Your rights are explained in full in the [privacy policy](/confidentialite).

## Intellectual property

The site''s content is protected. For details, see article 6 of the [terms of use](/cgu).', chr(13), '')
where slug = 'mentions-legales' and locale = 'en' and title = 'Legal notice'
  and replace(body_md, chr(13), '') = replace('## Site publisher

{{legal.companyName}}, {{legal.legalForm}}
RCCM: {{legal.rccm}} · IFU: {{legal.ifu}}
Registered office: {{legal.address}}, Cotonou, Benin
WhatsApp: {{brand.whatsapp}} · Email: {{brand.email}}

## Publication director

{{legal.publicationDirector}}

## Hosting

{{legal.hostName}}, {{legal.hostAddress}}

## Personal data protection

The site processes personal data in line with the regulations applicable in Benin. {{todo:State here the APDP formality (declaration and receipt) once completed.}} Your rights are detailed in the [privacy policy](/confidentialite).

## Intellectual property

The site''s content is protected. See article 6 of the [terms of use](/cgu).', chr(13), '');
