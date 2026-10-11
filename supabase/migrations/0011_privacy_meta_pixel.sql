-- 0011_privacy_meta_pixel.sql — politique de confidentialité : déclare le pixel Meta (actif par défaut, refusable).
-- Décision de Fresnel du 2026-10-11 (pixel en opt-out ; GA4 reste sur accord).
-- Ne touche QUE les pages encore au texte par défaut sur ces passages : chaque replace() ne fait rien si
-- l'admin a déjà réécrit la phrase. Rejouable sans effet (les anciens textes n'existent plus après le 1er passage).

update public.pages
set body_md = replace(replace(body_md,
  'le prestataire de paiement, l''hébergeur du site et le fournisseur de la technologie d''intelligence artificielle de l''assistant, pour générer les réponses. Vos données ne sont jamais vendues.',
  'le prestataire de paiement, l''hébergeur du site, le fournisseur de la technologie d''intelligence artificielle de l''assistant, pour générer les réponses, et Meta, pour la mesure de nos publicités. Vos données ne sont jamais vendues.'),
  '{{todo:Préciser ici l''outil de mesure d''audience, s''il y en a un.}}',
  'Le site utilise aussi le pixel de Meta (Meta Platforms Ireland Ltd, et Meta Platforms Inc. aux États-Unis) pour mesurer l''efficacité de nos publicités Facebook et Instagram : pages vues, ajouts au panier, commandes et leur montant, associés à un identifiant technique de votre navigateur. Aucun nom, e-mail ni téléphone n''est transmis. Ces données sont traitées par Meta, notamment aux États-Unis. Le pixel est actif dès votre arrivée sur le site ; vous pouvez le refuser à tout moment depuis « Gérer mes cookies » : l''envoi s''arrête alors et ses cookies sont effacés. La mesure d''audience (Google Analytics) n''est activée qu''avec votre accord.')
where slug = 'confidentialite' and locale = 'fr';

update public.pages
set body_md = replace(replace(body_md,
  'the payment provider, the site host and the provider of the artificial intelligence technology behind the assistant, to generate answers. Your data is never sold.',
  'the payment provider, the site host, the provider of the artificial intelligence technology behind the assistant, to generate answers, and Meta, to measure our ads. Your data is never sold.'),
  '{{todo:State here the audience measurement tool, if any.}}',
  'The site also uses the Meta pixel (Meta Platforms Ireland Ltd, and Meta Platforms Inc. in the United States) to measure the performance of our Facebook and Instagram ads: pages viewed, items added to cart, orders and their amount, linked to a technical identifier of your browser. No name, email or phone number is shared. This data is processed by Meta, including in the United States. The pixel is active as soon as you arrive on the site; you can refuse it at any time from "Manage my cookies": sending then stops and its cookies are deleted. Audience measurement (Google Analytics) is only turned on with your consent.')
where slug = 'confidentialite' and locale = 'en';
