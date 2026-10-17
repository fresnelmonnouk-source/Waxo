-- 0027_categories_more.sql : 11 nouveaux rayons (décision de Fresnel, 2026-10-17).
-- À exécuter dans l'éditeur SQL Supabase (ou déjà inséré par Kody à la demande de Fresnel : le fichier garde la trace).
-- Idempotent : on conflict do nothing, ne touche jamais un rayon existant ni ses produits.
-- Un rayon sans produit n'apparaît ni dans le menu, ni sur l'accueil, ni dans les filtres du catalogue ; il est seulement
-- proposé dans le formulaire produit de l'admin.
-- Retour arrière possible tant qu'aucun produit n'y est rangé : delete from public.categories where id in (voir la liste).

insert into public.categories (id, label_fr, label_en, bg, sort) values
  ('sport','Sport','Sports','#D3E4F0',7),
  ('jeux','Jeux','Games','#E3D9EF',8),
  ('jouets','Jouets enfants','Kids'' toys','#F7E1B5',9),
  ('auto-moto','Auto & moto','Car & motorbike','#DAD9D4',10),
  ('bebe','Bébé & puériculture','Baby','#F5DDE2',11),
  ('sante','Santé & bien-être','Health & wellness','#D9EBE4',12),
  ('mode','Mode & accessoires','Fashion & accessories','#EFD9E8',13),
  ('bricolage','Bricolage & outils','DIY & tools','#E6DCC8',14),
  ('jardin','Jardin & extérieur','Garden & outdoor','#DDE9C9',15),
  ('animaux','Animaux','Pets','#F1E2D0',16),
  ('cadeaux','Cadeaux & fêtes','Gifts & parties','#F4D9D2',17)
on conflict (id) do nothing;
