// Textes PAR DÉFAUT des 6 pages d'infos (markdown), un par langue : repli quand la table `pages` n'a pas la ligne
// (ou quand Supabase est indisponible) ET source de la migration 0005_pages_seed.sql.
// Contenu repris des messages J1 (namespaces Legal et About) ; les valeurs variables sont des marqueurs {{…}} (voir markers.ts).
// Ce sont des MODÈLES à faire valider par un professionnel du droit.
// Si tu modifies ce fichier, régénère la migration (le test tests/pages-seed.test.ts compare les deux).
import type { PageLocale, PageSlug } from "./types";

export type DefaultPage = { title: string; body: string };

export const DEFAULT_PAGES: Record<PageSlug, Record<PageLocale, DefaultPage>> = {
  "a-propos": {
    fr: {
      title: "Une boutique en ligne pour les petites choses utiles.",
      body: `Wá xɔ veut dire « venez acheter » en fon. Nous choisissons des objets du quotidien, nous les stockons nous-mêmes à Cotonou et nous les livrons chez vous, souvent dès le lendemain.

Nous n'avons pas de boutique physique. Quand vous commandez, le produit part directement de notre stock : c'est ce qui nous permet d'afficher un stock réel et de livrer vite.

## Tout est en stock chez nous

Ce que vous voyez sur le site est disponible. Le stock est mis à jour à chaque commande.

## Des objets du quotidien

Pour la maison, la cuisine, la beauté, le bureau, la tech et le voyage, à petits prix.

## Un service proche de vous

Confirmation sur WhatsApp, livraison à domicile et échange ou remboursement sous {{shipping.returnDays}}.`,
    },
    en: {
      title: "An online shop for small, useful things.",
      body: `Wá xɔ means “come and buy” in Fon. We pick everyday items, store them ourselves in Cotonou and deliver them to your door, often the very next day.

We have no physical store. When you order, the product leaves straight from our stock: that is what lets us show real stock levels and deliver fast.

## Everything is in stock with us

What you see on the site is available. Stock is updated with every order.

## Everyday items

For the home, kitchen, beauty, office, tech and travel, at small prices.

## A service close to you

Confirmation on WhatsApp, home delivery, and exchange or refund within {{shipping.returnDays}}.`,
    },
  },
  "livraison-retours": {
    fr: {
      title: "Livraison et retours",
      body: `| Zone | Délai | Frais |
|---|---|---|
| Cotonou et Calavi | Le lendemain, commande avant {{shipping.cutoff}} h, du lundi au samedi | {{shipping.cotonou}}, offerte dès {{shipping.freeFrom}} |
| Autres villes du Bénin | 48 à 72 h | {{shipping.autre}} |
| Hors du Bénin | Pas encore disponible | – |

## Le jour de la livraison

Vous recevez une confirmation par WhatsApp avec le créneau de livraison. Le livreur vous appelle avant d'arriver. {{pay.codShip}}

## Retourner un produit

1. Écrivez-nous dans les {{shipping.returnDays}} suivant la réception, par WhatsApp ou par le [formulaire de contact](/contact), avec votre numéro de commande.
2. À Cotonou et Calavi, notre livreur reprend le produit chez vous. Ailleurs au Bénin, nous vous indiquons comment nous l'envoyer.
3. Après vérification, nous échangeons le produit ou vous remboursons sous {{shipping.returnDays}}.

## Conditions

Produit non utilisé, complet et dans son emballage d'origine. Les produits d'hygiène descellés sont exclus, sauf défaut. Le retour est gratuit en cas de défaut ou d'erreur de notre part. {{todo:Préciser qui paie le retour pour un changement d'avis hors de Cotonou.}}

[Contacter le service client](/contact){button}`,
    },
    en: {
      title: "Delivery and returns",
      body: `| Zone | Lead time | Fee |
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

[Contact customer service](/contact){button}`,
    },
  },
  "cgv": {
    fr: {
      title: "Conditions générales de vente",
      body: `## 1. Objet

Les présentes conditions régissent les ventes conclues sur le site Wá xɔ entre {{legal.companyName}}, {{legal.legalForm}}, immatriculée au RCCM sous le numéro {{legal.rccm}}, IFU {{legal.ifu}}, dont le siège est situé {{legal.address}}, Cotonou (ci-après « Wá xɔ »), et toute personne qui passe commande (ci-après « le client »). Valider une commande vaut acceptation de ces conditions.

## 2. Produits

Les produits proposés sont ceux affichés sur le site, dans la limite des stocks disponibles. Wá xɔ stocke elle-même ses produits à Cotonou ; le stock affiché est mis à jour à chaque commande. Les photos et descriptions sont aussi fidèles que possible ; une légère différence de teinte ou d'emballage ne constitue pas une non-conformité.

## 3. Prix

Les prix sont indiqués en francs CFA, toutes taxes comprises. Les frais de livraison s'ajoutent au prix des produits et sont affichés avant la validation de la commande. Le prix facturé est celui affiché au moment de la commande.

## 4. Commande

Le client sélectionne ses produits, indique ses coordonnées de livraison, choisit un moyen de paiement puis valide sa commande. Un numéro de commande (WX-…) s'affiche et une confirmation est envoyée par WhatsApp ou SMS. Wá xɔ peut annuler une commande en cas d'informations incomplètes, de produit devenu indisponible ou d'incident de paiement ; le client est alors remboursé intégralement.

## 5. Paiement

Moyens acceptés : MTN MoMo, Moov Money, Celtiis Cash et carte bancaire Visa ou Mastercard{{pay.codCgv}}. Les paiements en ligne sont traités par un prestataire de paiement agréé ; Wá xɔ n'a jamais accès aux codes secrets ni aux numéros complets de carte.

## 6. Livraison

Cotonou et Calavi : livraison le lendemain pour toute commande passée avant {{shipping.cutoff}} h, du lundi au samedi, pour {{shipping.cotonou}}, offerte dès {{shipping.freeFrom}} d'achat. Autres villes du Bénin : sous 48 à 72 h, pour {{shipping.autre}}. Le livreur appelle le client avant son arrivée. En cas d'absence, une nouvelle livraison est proposée ; après deux tentatives sans succès, la commande peut être annulée. Pas de livraison hors du Bénin pour le moment.

## 7. Échange et remboursement

Le client dispose de {{shipping.returnDays}} à compter de la réception pour demander un échange ou un remboursement, sans avoir à se justifier, pour un produit non utilisé, complet et dans son emballage d'origine. Les produits d'hygiène ou de soin descellés (brosse visage, tondeuse, pinceaux de maquillage, par exemple) ne sont ni repris ni échangés, sauf défaut. Le remboursement est fait par le moyen de paiement initial, ou par Mobile Money pour un paiement à la livraison, sous {{shipping.returnDays}} après réception du produit retourné. La procédure figure sur la page [Livraison et retours](/livraison-retours).

## 8. Produit défectueux ou non conforme

Tout défaut ou erreur de produit est à signaler dans les 48 h suivant la réception, photo à l'appui. Wá xɔ échange ou rembourse le produit et prend en charge les frais de retour.

## 9. Données personnelles

Les données collectées lors de la commande sont traitées selon notre [politique de confidentialité](/confidentialite).

## 10. Droit applicable et litiges

Ces conditions sont soumises au droit béninois. En cas de différend, le client contacte d'abord le service client pour rechercher une solution amiable. À défaut, le litige est porté devant les juridictions compétentes de Cotonou.`,
    },
    en: {
      title: "Terms of sale",
      body: `## 1. Purpose

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

These terms are governed by Beninese law. In case of a dispute, the customer first contacts customer service to seek an amicable solution. Failing that, the dispute is brought before the competent courts of Cotonou.`,
    },
  },
  "cgu": {
    fr: {
      title: "Conditions générales d'utilisation",
      body: `## 1. Objet

Ces conditions encadrent l'accès au site Wá xɔ et l'utilisation de ses services : catalogue, assistant, compte client et avis. Elles complètent les [conditions générales de vente](/cgv), qui s'appliquent à toute commande.

## 2. Accès au site

Le site est accessible gratuitement. Wá xɔ peut en suspendre l'accès pour maintenance ou mise à jour.

## 3. Compte client

Le compte est facultatif pour commander. Il est nécessaire pour suivre ses commandes et publier un avis. Le client fournit des informations exactes et garde son mot de passe confidentiel. Il modifie ses informations depuis son espace et peut demander la suppression de son compte en écrivant au service client.

## 4. Avis clients

Seuls les clients inscrits peuvent publier un avis, à raison d'un avis par produit. L'avis porte sur une expérience réelle avec le produit. Sont interdits les propos injurieux, discriminatoires ou diffamatoires, la publicité et les données personnelles de tiers. Wá xɔ ne modifie jamais le contenu d'un avis ; elle peut masquer un avis qui ne respecte pas ces règles. Le badge « Achat vérifié » indique que l'auteur a reçu ce produit par une commande Wá xɔ. Les avis ne sont pas rémunérés.

## 5. Assistant

L'assistant est un outil automatisé fondé sur l'intelligence artificielle. Il aide à choisir un produit et répond aux questions courantes. Ses réponses peuvent comporter des erreurs : la fiche produit, le panier et les conditions générales de vente font foi. Ne communiquez jamais de mot de passe, de code Mobile Money ni de numéro de carte dans la conversation.

## 6. Propriété intellectuelle

Le nom Wá xɔ, le logo, les textes et les photos du site appartiennent à {{legal.companyName}} ou à leurs auteurs. Toute reproduction sans autorisation est interdite.

## 7. Responsabilité

Wá xɔ veille à l'exactitude des informations publiées sans pouvoir garantir l'absence totale d'erreur. Elle n'est pas responsable des dommages liés à une mauvaise utilisation du site ou à une interruption du service.

## 8. Modification

Ces conditions peuvent évoluer. La version applicable est celle publiée sur cette page.`,
    },
    en: {
      title: "Terms of use",
      body: `## 1. Purpose

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

These terms may change. The applicable version is the one published on this page.`,
    },
  },
  "confidentialite": {
    fr: {
      title: "Politique de confidentialité",
      body: `## Responsable du traitement

{{legal.companyName}}, {{legal.address}}, Cotonou. Contact : {{brand.email}}.

## Données collectées

Pour une commande : nom, téléphone, adresse de livraison, produits commandés et moyen de paiement choisi. Pour un compte : prénom, nom, téléphone, e-mail, mot de passe (enregistré sous forme chiffrée), historique des commandes et avis publiés. Pour la newsletter : e-mail ou numéro WhatsApp. Pour le contact et l'assistant : le contenu de vos messages. Les paiements en ligne sont traités directement par notre prestataire de paiement ; Wá xɔ ne conserve ni code secret ni numéro complet de carte.

## Utilisation

Préparer, livrer et suivre vos commandes ; vous contacter au sujet d'une commande ; gérer votre compte et vos avis ; vous envoyer la newsletter si vous l'avez demandée ; répondre à vos messages ; améliorer le site.

## Destinataires

L'équipe Wá xɔ, le livreur (nom, téléphone et adresse uniquement), le prestataire de paiement, l'hébergeur du site et le fournisseur de la technologie d'intelligence artificielle de l'assistant, pour générer les réponses. Vos données ne sont jamais vendues.

## Durée de conservation

Compte : jusqu'à sa suppression, ou 3 ans après votre dernière activité. Commandes et factures : pendant la durée imposée par la réglementation comptable. Newsletter : jusqu'à votre désinscription. Messages : 1 an.

## Vos droits

Vous pouvez accéder à vos données, les rectifier, vous opposer à leur utilisation ou demander leur suppression en écrivant à {{brand.email}}. Vous pouvez aussi saisir l'Autorité de Protection des Données à caractère Personnel (APDP, apdp.bj).

## Stockage sur votre appareil

Le site enregistre sur votre appareil votre panier, les produits consultés (pour la sélection personnalisée) et votre session de connexion. {{todo:Préciser ici l'outil de mesure d'audience, s'il y en a un.}}

## Sécurité

Les échanges avec le site sont chiffrés (HTTPS) et l'accès aux données est réservé aux personnes habilitées.`,
    },
    en: {
      title: "Privacy policy",
      body: `## Data controller

{{legal.companyName}}, {{legal.address}}, Cotonou. Contact: {{brand.email}}.

## Data collected

For an order: name, phone, delivery address, products ordered and chosen payment method. For an account: first name, last name, phone, email, password (stored in encrypted form), order history and published reviews. For the newsletter: email or WhatsApp number. For contact and the assistant: the content of your messages. Online payments are handled directly by our payment provider; Wá xɔ keeps neither secret codes nor full card numbers.

## Use

Preparing, delivering and tracking your orders; contacting you about an order; managing your account and reviews; sending you the newsletter if you asked for it; replying to your messages; improving the site.

## Recipients

The Wá xɔ team, the courier (name, phone and address only), the payment provider, the site host and the provider of the artificial intelligence technology behind the assistant, to generate answers. Your data is never sold.

## Retention period

Account: until deleted, or 3 years after your last activity. Orders and invoices: for the period required by accounting regulations. Newsletter: until you unsubscribe. Messages: 1 year.

## Your rights

You can access your data, correct it, object to its use or ask for its deletion by writing to {{brand.email}}. You can also contact the Personal Data Protection Authority (APDP, apdp.bj).

## Storage on your device

The site stores on your device your cart, the products you viewed (for the personalized selection) and your sign-in session. {{todo:State here the audience measurement tool, if any.}}

## Security

Exchanges with the site are encrypted (HTTPS) and access to data is restricted to authorized people.`,
    },
  },
  "mentions-legales": {
    fr: {
      title: "Mentions légales",
      body: `## Éditeur du site

{{legal.companyName}}, {{legal.legalForm}}
RCCM : {{legal.rccm}} · IFU : {{legal.ifu}}
Siège : {{legal.address}}, Cotonou, Bénin
WhatsApp : {{brand.whatsapp}} · E-mail : {{brand.email}}

## Directeur de la publication

{{legal.publicationDirector}}

## Hébergement

{{legal.hostName}}, {{legal.hostAddress}}

## Protection des données personnelles

Conformément à la loi n° 2017-20 du 20 avril 2018 portant code du numérique en République du Bénin, modifiée par la loi n° 2020-35 du 6 janvier 2021, le site fait l'objet d'une déclaration auprès de l'Autorité de Protection des Données à caractère Personnel (APDP) : récépissé n° {{legal.apdpReceipt}}. Vos droits sont détaillés dans la [politique de confidentialité](/confidentialite).

## Propriété intellectuelle

Les contenus du site sont protégés. Voir l'article 6 des [conditions générales d'utilisation](/cgu).`,
    },
    en: {
      title: "Legal notice",
      body: `## Site publisher

{{legal.companyName}}, {{legal.legalForm}}
RCCM: {{legal.rccm}} · IFU: {{legal.ifu}}
Registered office: {{legal.address}}, Cotonou, Benin
WhatsApp: {{brand.whatsapp}} · Email: {{brand.email}}

## Publication director

{{legal.publicationDirector}}

## Hosting

{{legal.hostName}}, {{legal.hostAddress}}

## Personal data protection

In accordance with Law No. 2017-20 of April 20, 2018 on the Digital Code in the Republic of Benin, as amended by Law No. 2020-35 of January 6, 2021, the site is declared to the Personal Data Protection Authority (APDP): receipt no. {{legal.apdpReceipt}}. Your rights are detailed in the [privacy policy](/confidentialite).

## Intellectual property

The site's content is protected. See article 6 of the [terms of use](/cgu).`,
    },
  },
};
