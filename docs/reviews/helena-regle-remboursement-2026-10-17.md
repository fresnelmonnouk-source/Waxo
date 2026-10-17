# Règle "défaut ou erreur : qui paie" : textes FINAUX Helena (2026-10-17)

Risque résiduel à rappeler au propriétaire avant validation :
- ROUGE : frais de retour ET de livraison à sa charge pour une erreur de la boutique, un défaut visible découvert plus tard et un défaut apparu à l'usage. Exposé aux vices cachés (Code civil, art. 1641 et suivants, dont l'art. 1646 sur les frais occasionnés par la vente), à la délivrance conforme (art. 1604 et suivants) et aux clauses abusives (loi 2007-21, à confirmer). La phrase de sauvegarde réduit le risque sans le supprimer ; un litige peut aboutir à devoir rembourser ces frais.
- ORANGE : le client doit être informé AVANT qu'il peut ouvrir le colis devant le livreur (sinon la règle 1 est un piège) ; les livreurs n'ont pas reçu de consigne ; un éventuel droit de rétractation légal n'est pas vérifié ; les commandes passées avant la mise en ligne restent sous les anciennes conditions (dater les CGV). Faire relire l'art. 8 par un juriste béninois.

Statut : textes finaux issus de la décision du propriétaire du 2026-10-17. Aucun fichier de code ni de base modifié. Le propriétaire valide le texte EXACT avant mise en ligne. Évaluation de risque, pas un avis juridique formel.

## Décisions appliquées

1. Défaut ou erreur remarqué devant le livreur : reprise, échange ou remboursement, frais de livraison payés compris.
2. Défaut ou erreur découvert plus tard, signalé sous 48 h avec photo : produit échangé ou remboursé, frais de retour et de livraison à la charge du client.
3. Défaut qui n'apparaît qu'à l'usage : l'équipe examine, frais à la charge du client. Aucune promesse d'échange ou de remboursement n'est faite dans ce cas.
4. Les frais sont visés, pas le prix : le produit défectueux reste échangé ou remboursé (règles 1 et 2).
5. Changement d'avis : textes actuels conservés (reprise par le livreur à Cotonou et Calavi, retour hors zone à la charge du client).
6. Rien n'est écrit sur ce que le propriétaire n'a pas tranché : livraison offerte et retour, retour partiel, commande de plusieurs produits, échange pour changement d'avis, livreurs, plafond de délai pour un défaut à l'usage.

Phrase de sauvegarde conservée dans les CGV et la page : « Ces règles ne limitent pas les droits que la loi vous reconnaît » (point à valider par le propriétaire).

## Où vit chaque texte

| # | Texte | Vit dans | Action |
|---|---|---|---|
| A | CGV art. 8 (art. 7 inchangé) | BASE (page `cgv`, prime) ; repli code : `src/lib/pages/defaults.ts` et `account.json › Legal.cgv.s7/s8` | Admin, Pages, CGV (même session que l'art. 5 en attente). Code : `defaults.ts`, régénérer la migration de seed (`tests/pages-seed.test.ts`), `account.json` |
| B | Page Livraison et retours | BASE (page `livraison-retours`, prime) ; repli : `defaults.ts` et `account.json › Legal.shipping` (nouvelles clés `dayCheck`, `defH`, `def1` à `def3`, `defLaw`, `condP` modifiée ; `ShippingDoc.tsx` à compléter) | Admin, Pages |
| C | Fiche KB 0010 "Retours et échanges" | BASE | Aucun changement |
| D | Fiche KB 0011 "Produit défectueux ou erreur de commande" | BASE | Remplacer le texte (admin, base de connaissances) |
| E | Fiche KB 0004 "Le jour de la livraison" | BASE | Ajouter une phrase |
| F | `Reply.returns` (réponse directe de l'assistant) | Code `assistant.json` FR/EN | Kody |
| G | FAQ `Faq.a6` | Code `account.json` | Aucun changement |
| H | Panier `checkout.returns` | Code | Aucun changement |

Fiches KB : 900 caractères maximum, espaces compris. Recomptage fiche par fiche, mot par mot : 0011 proposée = 756 caractères ; 0004 proposée = 694 caractères (de 543 à 694 avec la phrase ajoutée). Le champ de l'admin fait foi ; si le compteur affiche un écart de quelques caractères, il reste une marge de plus de 140.

## A. CGV

### A1. Article 7 : aucun changement

Le dernier paragraphe actuel reste tel quel ("Pour un simple changement d'avis hors de Cotonou et Calavi, les frais de retour sont à votre charge.").

Seule correction d'incohérence dans le repli `account.json › Legal.cgv.s7.p` (qui n'a pas cette phrase alors que `defaults.ts` l'a) : insérer avant "La procédure figure sur la page" / "The procedure is on" :
- FR : `Pour un simple changement d'avis hors de Cotonou et Calavi, les frais de retour sont à la charge du client. `
- EN : `For a simple change of mind outside Cotonou and Calavi, the return costs are paid by the customer. `

### A2. Article 8 (page `cgv`, `defaults.ts`)

ACTUEL FR :
> Si un produit a un défaut ou ne correspond pas à votre commande, signalez-le dans les 48 h qui suivent la réception, avec une photo. Nous l'échangeons ou nous vous le remboursons, et les frais de retour sont à notre charge.

PROPOSÉ FR :
```
À la réception, vous pouvez ouvrir le colis et vérifier vos produits devant le livreur. Si un produit est abîmé, défectueux ou ne correspond pas à votre commande, dites-le au livreur avant qu'il ne parte. Il reprend le produit et nous l'échangeons ou nous vous remboursons, frais de livraison payés compris. Écrivez-nous aussi sur WhatsApp le jour même, avec une photo si possible.

Si vous vous en apercevez seulement après le départ du livreur, signalez-le dans les 48 h qui suivent la réception, avec une photo et votre numéro de commande. Nous échangeons le produit ou nous vous remboursons son prix, mais les frais de retour et de livraison restent à votre charge.

Un défaut qui n'apparaît qu'à l'usage peut aussi nous être signalé, dès que vous le constatez, avec une photo ou une vidéo. L'équipe examine votre demande ; les frais de retour et de livraison restent à votre charge.

Ces règles ne limitent pas les droits que la loi vous reconnaît.
```

ACTUEL EN :
> If a product is faulty or doesn't match your order, let us know within 48 hours of receipt, with a photo. We exchange it or refund you, and we cover the return costs.

PROPOSÉ EN :
```
When you receive your order, you can open the parcel and check your products in front of the courier. If a product is damaged, faulty or does not match your order, tell the courier before they leave. The courier takes the product back and we exchange it or refund you, delivery fees you paid included. Please also write to us on WhatsApp the same day, with a photo if possible.

If you only notice it after the courier has left, report it within 48 hours of receipt, with a photo and your order number. We exchange the product or refund its price, but the return and delivery fees remain at your charge.

A defect that only appears with use can also be reported to us, as soon as you notice it, with a photo or a video. The team will look at your request; the return and delivery fees remain at your charge.

These rules do not limit the rights the law gives you.
```

### A3. Repli `account.json › Legal.cgv.s8.p` (3e personne)

ACTUEL FR : `Tout défaut ou erreur de produit est à signaler dans les 48 h suivant la réception, photo à l'appui. Wá xɔ échange ou rembourse le produit et prend en charge les frais de retour.`
PROPOSÉ FR : `À la réception, le client peut ouvrir le colis devant le livreur. Un produit abîmé, défectueux ou erroné signalé au livreur à la remise est repris, et Wá xɔ l'échange ou le rembourse, frais de livraison payés compris ; le client le confirme aussi sur WhatsApp le jour même. Si le défaut ou l'erreur n'est constaté qu'après le départ du livreur, il est à signaler dans les 48 h suivant la réception, photo à l'appui : Wá xɔ échange le produit ou en rembourse le prix, mais les frais de retour et de livraison restent à la charge du client. Un défaut qui n'apparaît qu'à l'usage peut aussi être signalé dès sa découverte ; l'équipe examine la demande et les frais de retour et de livraison restent à la charge du client. Ces règles ne limitent pas les droits que la loi reconnaît au client.`

ACTUEL EN : `Any defect or product error must be reported within 48 hours of receipt, with a photo. Wá xɔ exchanges or refunds the product and covers the return costs.`
PROPOSÉ EN : `On receipt, the customer can open the parcel in front of the courier. A damaged, faulty or wrong product reported to the courier on handover is taken back, and Wá xɔ exchanges or refunds it, delivery fees paid included; the customer also confirms it on WhatsApp the same day. If the defect or error is only noticed after the courier has left, it must be reported within 48 hours of receipt, with a photo: Wá xɔ exchanges the product or refunds its price, but the return and delivery fees remain at the customer's charge. A defect that only appears with use can also be reported as soon as it is discovered; the team examines the request and the return and delivery fees remain at the customer's charge. These rules do not limit the rights the law gives the customer.`

## B. Page "Livraison et retours"

### B1. "Le jour de la livraison" : paragraphe à ajouter APRÈS le paragraphe actuel (qui se termine par {{pay.codShip}})

PROPOSÉ FR :
> Vous pouvez ouvrir le colis et vérifier vos produits devant le livreur. Si un produit est abîmé, défectueux ou n'est pas le bon, dites-le-lui avant qu'il ne parte. Écrivez-nous aussi sur WhatsApp le jour même, avec une photo si possible. Voir « Un défaut ou une erreur ? » plus bas.

PROPOSÉ EN :
> You can open the parcel and check your products in front of the courier. If a product is damaged, faulty or is not the right one, tell the courier before they leave. Please also write to us on WhatsApp the same day, with a photo if possible. See “A defect or a mistake?” below.

Repli : clé `dayCheck`, mêmes textes.

### B2. "Conditions" remplacé + nouvelle section

ACTUEL FR :
> Le produit doit être non utilisé, complet et dans son emballage d'origine. Les produits d'hygiène ne sont plus repris une fois descellés, sauf s'ils ont un défaut. Si le produit a un défaut ou si l'erreur vient de nous, le retour est gratuit. Pour un simple changement d'avis hors de Cotonou et Calavi, les frais de retour sont à votre charge.

PROPOSÉ FR (Markdown, entre "## Conditions" et le bouton) :
```
Le produit doit être non utilisé, complet et dans son emballage d'origine. Les produits d'hygiène ne sont plus repris une fois descellés, sauf s'ils ont un défaut. Pour un simple changement d'avis hors de Cotonou et Calavi, les frais de retour sont à votre charge.

## Un défaut ou une erreur ?

Remarqué devant le livreur : nous reprenons le produit et nous l'échangeons ou nous vous remboursons, frais de livraison payés compris.

Découvert après le départ du livreur : écrivez-nous dans les 48 h qui suivent la réception, avec une photo et votre numéro de commande. Nous échangeons le produit ou nous vous remboursons son prix, mais les frais de retour et de livraison restent à votre charge.

Défaut qui n'apparaît qu'à l'usage : écrivez-nous dès que vous le constatez, avec une photo ou une vidéo. L'équipe examine votre demande ; les frais de retour et de livraison restent à votre charge.

Ces règles ne limitent pas les droits que la loi vous reconnaît.
```

ACTUEL EN :
> The product must be unused, complete and in its original packaging. Hygiene products can't be returned once unsealed, unless they're faulty. If the product is faulty or the mistake is ours, the return is free. For a simple change of mind outside Cotonou and Calavi, the return costs are paid by you.

PROPOSÉ EN :
```
The product must be unused, complete and in its original packaging. Hygiene products can't be returned once unsealed, unless they're faulty. For a simple change of mind outside Cotonou and Calavi, the return costs are paid by you.

## A defect or a mistake?

Noticed in front of the courier: we take the product back and we exchange it or refund you, delivery fees you paid included.

Found after the courier has left: write to us within 48 hours of receipt, with a photo and your order number. We exchange the product or refund its price, but the return and delivery fees remain at your charge.

Defect that only appears with use: write to us as soon as you notice it, with a photo or a video. The team will look at your request; the return and delivery fees remain at your charge.

These rules do not limit the rights the law gives you.
```

### B3. Repli `account.json › Legal.shipping`

- `condP` FR : `Produit non utilisé, complet et dans son emballage d'origine. Les produits d'hygiène descellés sont exclus, sauf défaut. Pour un simple changement d'avis hors de Cotonou et Calavi, les frais de retour sont à votre charge.`
- `condP` EN : `Unused product, complete and in its original packaging. Unsealed hygiene products are excluded, unless faulty. For a simple change of mind outside Cotonou and Calavi, the return costs are paid by you.`
(Supprime le marqueur `<tbc>` et la phrase "le retour est gratuit en cas de défaut ou d'erreur de notre part".)
- `defH` : `Un défaut ou une erreur ?` / `A defect or a mistake?`
- `def1`, `def2`, `def3`, `defLaw` : les trois paragraphes et la phrase finale de B2, dans l'ordre, FR et EN.

## C. Fiche KB 0010 : aucun changement

Elle ne parle que du changement d'avis, conforme à la décision (renvoi hors zone à la charge du client). Ne pas y ajouter les règles de défaut : elles sont dans la fiche 0011.

## D. Fiche KB 0011 "Produit défectueux ou erreur de commande" (base)

ACTUEL (migration 0021) :
> Si un produit a un défaut ou ne correspond pas à votre commande, écrivez-nous sur WhatsApp ou via le formulaire de contact, avec une photo et votre numéro de commande (WX-…) ; pour un défaut visible ou une erreur de produit, faites-le dans les 48 h qui suivent la réception. Nous l'échangeons ou nous vous le remboursons, et les frais de retour sont à notre charge, où que vous soyez au Bénin. Si un défaut apparaît plus tard, à l'usage, écrivez-nous aussi : l'équipe examine votre demande. Un produit d'hygiène descellé est lui aussi repris s'il a un défaut.

PROPOSÉ FR (756 caractères ; les deux premières phrases forment une réponse directe valable après la livraison) :
> Si un produit a un défaut, est abîmé ou ne correspond pas à votre commande, écrivez-nous sur WhatsApp ou via le formulaire de contact, avec une photo et votre numéro de commande (WX-…), dans les 48 h qui suivent la réception. Nous échangeons le produit ou nous vous remboursons son prix, mais les frais de retour et de livraison restent à votre charge. Si vous le remarquez devant le livreur à la remise (vous pouvez ouvrir le colis devant lui), dites-le-lui : il reprend le produit et les frais de livraison payés sont remboursés. Si un défaut n'apparaît qu'à l'usage, écrivez-nous aussi : l'équipe examine votre demande, et les frais de retour et de livraison restent à votre charge. Un produit d'hygiène descellé est lui aussi repris s'il a un défaut.

PROPOSÉ EN (démo / référence) :
> If a product is faulty, damaged or does not match your order, write to us on WhatsApp or through the contact form, with a photo and your order number (WX-…), within 48 hours of receipt. We exchange the product or refund its price, but the return and delivery fees remain at your charge. If you notice it in front of the courier on delivery (you can open the parcel in front of them), tell them: they take the product back and the delivery fees you paid are refunded. If a defect only appears with use, write to us too: the team will look at your request, and the return and delivery fees remain at your charge. An unsealed hygiene product is also taken back if it is faulty.

Mots-clés à ajouter à la fin de la liste actuelle : ` frais de livraison remboursés devant le livreur ouvrir le colis qui paie`.

## E. Fiche KB 0004 "Le jour de la livraison" : une phrase (base)

Texte actuel inchangé (543 caractères). Insérer après "puis le livreur vous appelle avant d'arriver." (total 694 caractères) :
- FR : ` Vous pouvez ouvrir le colis et vérifier vos produits devant lui ; si un produit est abîmé, défectueux ou n'est pas le bon, dites-le-lui tout de suite.`
- EN : ` You can open the parcel and check your products in front of the courier; if a product is damaged, faulty or not the right one, tell them right away.`

## F. `Reply.returns` (code, `assistant.json`)

ACTUEL FR :
> Vous avez {days} jours après réception pour demander un échange ou un remboursement, pour un produit non utilisé, complet et dans son emballage d'origine (produits d'hygiène descellés exclus, sauf défaut). Hors de Cotonou et Calavi, le renvoi est à votre charge pour un simple changement d'avis ; il est à nos frais en cas de défaut ou d'erreur de notre part.

PROPOSÉ FR :
> Vous avez {days} jours après réception pour demander un échange ou un remboursement, pour un produit non utilisé, complet et dans son emballage d'origine (produits d'hygiène descellés exclus, sauf défaut). Hors de Cotonou et Calavi, le renvoi est à votre charge pour un simple changement d'avis. En cas de défaut ou d'erreur, dites-le au livreur à la remise : le produit est repris et les frais de livraison payés sont remboursés. Si vous le découvrez après, signalez-le sous 48 h avec une photo : les frais de retour et de livraison restent à votre charge.

ACTUEL EN :
> You have {days} days after delivery to ask for an exchange or a refund, for an unused, complete product in its original packaging (opened hygiene products excluded, unless faulty). Outside Cotonou and Calavi, you pay the return cost for a simple change of mind; we pay it if the product is faulty or the mistake is ours.

PROPOSÉ EN :
> You have {days} days after delivery to ask for an exchange or a refund, for an unused, complete product in its original packaging (opened hygiene products excluded, unless faulty). Outside Cotonou and Calavi, you pay the return cost for a simple change of mind. For a defect or a mistake, tell the courier on delivery: the product is taken back and the delivery fees you paid are refunded. If you find it afterwards, report it within 48 hours with a photo: the return and delivery fees remain at your charge.

## G. FAQ `a6` et H. Panier : aucun changement

La FAQ ne parle que du changement d'avis et de l'exception "sauf défaut" pour l'hygiène : toujours exacte. La ligne du panier "Échange ou remboursement sous {days} jours." reste telle quelle ; ajouter un lien vers `/livraison-retours` reste une amélioration facultative (changement de code).

## Points non tranchés, textes laissés silencieux

Livraison offerte et retour d'un article, retour partiel et commande de plusieurs produits, échange pour changement d'avis (nouvelle livraison), consigne et statut des livreurs, plafond de délai pour un défaut à l'usage, date de mise en ligne. Les textes ci-dessus ne disent rien sur ces points : si un client pose la question, l'équipe tranche au cas par cas.

## Procédure

1. Le propriétaire valide les textes exacts, dont la phrase de sauvegarde.
2. Publier A à F dans la même passe (CGV avec l'art. 5 en attente, page, fiches 0011 et 0004, `Reply.returns`) : sinon l'assistant, la page et les CGV se contredisent.
3. Informer les livreurs avant la mise en ligne de la règle 1 et dater les CGV.
4. Relire après mise en ligne une réponse de l'assistant sur "mon produit est cassé, qui paie" et "puis-je retourner un produit".

Disclaimer : évaluation de risque, pas un conseil juridique formel. Pour un point à fort enjeu (CGV, vices cachés, rétractation), consulter un juriste béninois qualifié.
