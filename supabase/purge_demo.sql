-- Waxo — NETTOYAGE DES DONNÉES DE DÉMONSTRATION avant l'ouverture publique.
-- N'EST PAS une migration : à exécuter UNE FOIS, à la main, dans l'éditeur SQL Supabase, par Fresnel,
-- quand les vrais produits sont prêts à être saisis (ou saisis) et juste avant la mise en ligne.
-- Raison (audit Helena B1/B2, Sofia) : les 48 avis marqués « vérifiés », les notes de départ, les compteurs
-- « vendus » et les stocks de démo ne doivent JAMAIS être présentés comme des données réelles à de vrais clients.
--
-- ORDRE : 1) lire les « Vérifications » en bas ; 2) exécuter ce script ; 3) saisir les vrais produits dans /admin/produits.
-- Le script s'arrête (exception) s'il existe des commandes qui référencent les produits de démo : annulez/supprimez
-- d'abord vos commandes de test (voir l'option commentée plus bas).

begin;

do $$
declare n int;
begin
  select count(*) into n from public.order_items oi join public.products p on p.id = oi.product_id
   where p.created_at < '2026-08-01';  -- produits de démo (dates 2026-04 → 2026-07 dans le seed)
  if n > 0 then
    raise exception 'Des commandes référencent des produits de démo (% lignes) : supprimez vos commandes de test avant de purger.', n;
  end if;
end $$;

-- Option : supprimer vos commandes de TEST (décommentez en connaissance de cause, c'est irréversible)
-- delete from public.orders;   -- cascade : order_items, payments

delete from public.reviews where seed;                         -- faux avis de démo
delete from public.pack_items;                                  -- contenus de packs (références produits)
delete from public.pack_translations;
delete from public.packs;                                       -- packs de démo (0006)
delete from public.product_costs;
delete from public.product_translations;
delete from public.products;                                    -- produits de démo (0002)
delete from public.ledger;                                      -- carnet de démonstration
delete from public.kb;                                          -- base de connaissances de démo : saisissez la vôtre dans /admin/reglages
-- Livreurs de démo : gardez-les seulement s'ils sont réels.
delete from public.couriers where name in ('Rachidi Alassane', 'Eustache Hounkpè', 'Transporteur interurbain');

-- Compteur de numéros de commande : repartir de zéro côté public (première vraie commande = WX-10263)
alter sequence public.order_seq restart with 10263;

commit;

-- ───────────── Vérifications à lancer APRÈS (toutes doivent renvoyer 0) ─────────────
-- select count(*) from public.products;
-- select count(*) from public.reviews where seed;
-- select count(*) from public.ledger;
-- select count(*) from public.packs;

-- ───────────── Avant l'ouverture, remplacez aussi (à la main, dans /admin/reglages) ─────────────
--  • WhatsApp et e-mail (valeurs factices : +229 01 00 00 00 00 / contact@waxo.bj)
--  • Mentions légales (raison sociale, IFU, RCCM, adresse, hébergeur, directeur de publication)
--  • Moyens de paiement actifs : ne laissez cochés que ceux réellement branchés (FedaPay en sandbox = non)
