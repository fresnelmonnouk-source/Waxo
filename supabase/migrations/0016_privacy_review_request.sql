-- 0016_privacy_review_request.sql — politique de confidentialité : e-mail facultatif à la commande + demande d'avis après livraison (2026-10-11).
-- Ne remplace une page QUE si son titre ET son texte sont encore ceux d'origine : une page modifiée depuis l'admin
-- n'est jamais écrasée. Comparaison et écriture sans les retours chariot (chr(13)) : un copier-coller depuis Windows
-- ajoute des fins de ligne CRLF. Rejouable sans effet. Source : src/lib/pages/defaults.ts.

update public.pages set title = 'Politique de confidentialité', body_md = replace('## Qui est responsable de vos données

{{legal.companyName}}, {{legal.address}}, Cotonou. Contact : {{brand.email}}.

## Les données que nous collectons

- Quand vous commandez : votre nom, votre téléphone, votre adresse de livraison, votre e-mail si vous le donnez, les produits commandés et le moyen de paiement choisi.
- Si vous créez un compte : votre prénom, votre nom, votre téléphone, votre e-mail, votre mot de passe (enregistré sous forme chiffrée), l''historique de vos commandes et les avis que vous publiez.
- Pour la newsletter : votre e-mail ou votre numéro WhatsApp.
- Quand vous nous écrivez ou utilisez l''assistant : le contenu de vos messages.

Les paiements en ligne sont traités directement par notre prestataire de paiement. Nous ne conservons ni code secret ni numéro de carte complet.

## À quoi elles servent

Nous utilisons vos données pour préparer, livrer et suivre vos commandes, vous contacter au sujet d''une commande, gérer votre compte et vos avis, vous demander une seule fois votre avis par e-mail quelques jours après une livraison, vous envoyer la newsletter si vous l''avez demandée, répondre à vos messages et améliorer le site.

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
  and replace(body_md, chr(13), '') = replace('## Qui est responsable de vos données

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

Les échanges avec le site sont chiffrés (HTTPS). Seules les personnes habilitées peuvent accéder aux données.', chr(13), '');

update public.pages set title = 'Privacy policy', body_md = replace('## Who is responsible for your data

{{legal.companyName}}, {{legal.address}}, Cotonou. Contact: {{brand.email}}.

## The data we collect

- When you order: your name, phone number, delivery address, your email if you give it, the products you ordered and the payment method you chose.
- If you create an account: your first name, last name, phone number, email, password (stored in encrypted form), your order history and the reviews you post.
- For the newsletter: your email or WhatsApp number.
- When you write to us or use the assistant: the content of your messages.

Online payments are handled directly by our payment provider. We don''t keep secret codes or full card numbers.

## What we use it for

We use your data to prepare, deliver and track your orders, contact you about an order, manage your account and reviews, ask once by email for your review a few days after a delivery, send you the newsletter if you asked for it, reply to your messages and improve the site.

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
  and replace(body_md, chr(13), '') = replace('## Who is responsible for your data

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

Exchanges with the site are encrypted (HTTPS). Only authorized people can access the data.', chr(13), '');
