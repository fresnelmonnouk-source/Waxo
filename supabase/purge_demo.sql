-- Waxo — NETTOYAGE COMPLET DES DONNÉES DE DÉMONSTRATION avant l'ouverture publique (révision du 2026-10-11).
-- N'EST PAS une migration : à exécuter UNE FOIS, à la main, dans l'éditeur SQL Supabase (copier TOUT le fichier : Ctrl+A).
-- Retire TOUT le contenu fictif : 24 produits de démo (et leurs traductions, coûts, avis, favoris, lignes de campagne),
-- 3 packs de démo, tous les avis de démo, la base de connaissances de démo, les 3 livreurs fictifs, le carnet
-- de comptes de démo, et VOS 4 COMMANDES DE TEST (WX-10263 à WX-10266).
-- Ciblage par IDENTIFIANTS de la démo (fichiers 0002 et 0006), jamais par date : vos vrais produits, packs, fiches et
-- dépenses saisis entre-temps sont CONSERVÉS. Rejouable sans effet. Tout ou rien (transaction).
-- Conservé : catégories, réglages, pages d'infos, comptes clients et admins, newsletter, campagnes.

begin;

-- Identifiants de la démo écrits DANS chaque instruction, sans table temporaire : l'éditeur SQL de Supabase ne la
-- conserve pas d'une instruction à l'autre (erreur 42P01 rencontrée le 2026-10-12).



-- 1) Garde-fou : une VRAIE commande (autre que vos 4 tests) qui contient un article de démo bloque tout.
do $$
declare n int;
begin
  select count(distinct o.id) into n
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  where o.number not in ('WX-10263', 'WX-10264', 'WX-10265', 'WX-10266')
    and (oi.product_id in (select unnest(array[
    '5b4e688a-1bb0-4e16-aeb8-a933014cd3ac',
    '463b673c-890e-4f78-a417-64d42558faf1',
    '9b451883-7805-4dca-aed7-09b0f90cc1a7',
    'c3f669a9-f4fb-45d4-a43d-2a99056788f6',
    'bdffaae6-440e-4d69-aa70-c5c50aebeddc',
    '2422be56-c1fa-4e2c-a9d9-d6fb1b9b9948',
    '5fd08878-7b1f-4ade-a648-ad278d34ad45',
    'de599e76-4338-47b0-ad3b-62eeee8ac2fc',
    '91834fbb-dd51-4efa-a5fb-ff363049a097',
    '634af67e-135a-4c59-a383-aa70b3f7e219',
    'c4f9ba2a-3591-422d-a4e2-267ad8c92989',
    'b9f86ee2-dab6-4bb4-acdf-4349557e11a3',
    '607c0035-256a-4e39-acc3-9ac36ec549aa',
    'e94015f7-0a25-4e92-a90a-556044d17e24',
    '5c1b3869-9249-403f-af2f-dc09478334db',
    'da752b90-3199-41ad-a851-57ebb3df31d1',
    '45307a21-6b3b-4780-ae97-d673d79ef871',
    '68c4f655-1ba6-4138-a020-5a318c963fcb',
    '38d96651-58ef-4824-a215-9ca61adce610',
    '16ad1936-420d-4ecd-a307-18780d3a8617',
    'b598e3fe-3497-43ab-a1b5-0d2f9559d092',
    '86819328-d14e-4796-a89d-618c969ba309',
    '03ab357c-6c21-4402-a5ae-6448153cf933',
    '7cf73e1f-709d-4241-a1b5-4df13f3fae37'
  ]::uuid[])) or oi.pack_id in (select unnest(array[
    '84625ba6-5cbc-470d-ad5f-2e3d3eaa87f7',
    '57d46e34-7b1b-4ddd-ac59-d3e47be10448',
    'b5e11703-2e20-484d-a3d8-21c94651fc3a'
  ]::uuid[])));
  if n > 0 then
    raise exception 'Purge annulée : % commande(s) réelle(s) contiennent des articles de démo. Contactez KODY avant de purger.', n;
  end if;
end $$;

-- 2) Vos commandes de test (cascade : lignes, composants de packs, paiements).
delete from public.orders where number in ('WX-10263', 'WX-10264', 'WX-10265', 'WX-10266');

-- 3) Avis : tous les avis de démo, et tout avis posé sur un produit de démo.
delete from public.reviews where seed or product_id in (select unnest(array[
    '5b4e688a-1bb0-4e16-aeb8-a933014cd3ac',
    '463b673c-890e-4f78-a417-64d42558faf1',
    '9b451883-7805-4dca-aed7-09b0f90cc1a7',
    'c3f669a9-f4fb-45d4-a43d-2a99056788f6',
    'bdffaae6-440e-4d69-aa70-c5c50aebeddc',
    '2422be56-c1fa-4e2c-a9d9-d6fb1b9b9948',
    '5fd08878-7b1f-4ade-a648-ad278d34ad45',
    'de599e76-4338-47b0-ad3b-62eeee8ac2fc',
    '91834fbb-dd51-4efa-a5fb-ff363049a097',
    '634af67e-135a-4c59-a383-aa70b3f7e219',
    'c4f9ba2a-3591-422d-a4e2-267ad8c92989',
    'b9f86ee2-dab6-4bb4-acdf-4349557e11a3',
    '607c0035-256a-4e39-acc3-9ac36ec549aa',
    'e94015f7-0a25-4e92-a90a-556044d17e24',
    '5c1b3869-9249-403f-af2f-dc09478334db',
    'da752b90-3199-41ad-a851-57ebb3df31d1',
    '45307a21-6b3b-4780-ae97-d673d79ef871',
    '68c4f655-1ba6-4138-a020-5a318c963fcb',
    '38d96651-58ef-4824-a215-9ca61adce610',
    '16ad1936-420d-4ecd-a307-18780d3a8617',
    'b598e3fe-3497-43ab-a1b5-0d2f9559d092',
    '86819328-d14e-4796-a89d-618c969ba309',
    '03ab357c-6c21-4402-a5ae-6448153cf933',
    '7cf73e1f-709d-4241-a1b5-4df13f3fae37'
  ]::uuid[]));

-- 4) Packs de démo (contenu, traductions, packs).
delete from public.pack_items where pack_id in (select unnest(array[
    '84625ba6-5cbc-470d-ad5f-2e3d3eaa87f7',
    '57d46e34-7b1b-4ddd-ac59-d3e47be10448',
    'b5e11703-2e20-484d-a3d8-21c94651fc3a'
  ]::uuid[]));
delete from public.pack_translations where pack_id in (select unnest(array[
    '84625ba6-5cbc-470d-ad5f-2e3d3eaa87f7',
    '57d46e34-7b1b-4ddd-ac59-d3e47be10448',
    'b5e11703-2e20-484d-a3d8-21c94651fc3a'
  ]::uuid[]));
delete from public.packs where id in (select unnest(array[
    '84625ba6-5cbc-470d-ad5f-2e3d3eaa87f7',
    '57d46e34-7b1b-4ddd-ac59-d3e47be10448',
    'b5e11703-2e20-484d-a3d8-21c94651fc3a'
  ]::uuid[]));
-- Un de VOS packs qui contiendrait un produit de démo perd seulement cette ligne.
delete from public.pack_items where product_id in (select unnest(array[
    '5b4e688a-1bb0-4e16-aeb8-a933014cd3ac',
    '463b673c-890e-4f78-a417-64d42558faf1',
    '9b451883-7805-4dca-aed7-09b0f90cc1a7',
    'c3f669a9-f4fb-45d4-a43d-2a99056788f6',
    'bdffaae6-440e-4d69-aa70-c5c50aebeddc',
    '2422be56-c1fa-4e2c-a9d9-d6fb1b9b9948',
    '5fd08878-7b1f-4ade-a648-ad278d34ad45',
    'de599e76-4338-47b0-ad3b-62eeee8ac2fc',
    '91834fbb-dd51-4efa-a5fb-ff363049a097',
    '634af67e-135a-4c59-a383-aa70b3f7e219',
    'c4f9ba2a-3591-422d-a4e2-267ad8c92989',
    'b9f86ee2-dab6-4bb4-acdf-4349557e11a3',
    '607c0035-256a-4e39-acc3-9ac36ec549aa',
    'e94015f7-0a25-4e92-a90a-556044d17e24',
    '5c1b3869-9249-403f-af2f-dc09478334db',
    'da752b90-3199-41ad-a851-57ebb3df31d1',
    '45307a21-6b3b-4780-ae97-d673d79ef871',
    '68c4f655-1ba6-4138-a020-5a318c963fcb',
    '38d96651-58ef-4824-a215-9ca61adce610',
    '16ad1936-420d-4ecd-a307-18780d3a8617',
    'b598e3fe-3497-43ab-a1b5-0d2f9559d092',
    '86819328-d14e-4796-a89d-618c969ba309',
    '03ab357c-6c21-4402-a5ae-6448153cf933',
    '7cf73e1f-709d-4241-a1b5-4df13f3fae37'
  ]::uuid[]));

-- 5) Produits de démo (favoris et lignes de campagne partent en cascade).
delete from public.product_costs where product_id in (select unnest(array[
    '5b4e688a-1bb0-4e16-aeb8-a933014cd3ac',
    '463b673c-890e-4f78-a417-64d42558faf1',
    '9b451883-7805-4dca-aed7-09b0f90cc1a7',
    'c3f669a9-f4fb-45d4-a43d-2a99056788f6',
    'bdffaae6-440e-4d69-aa70-c5c50aebeddc',
    '2422be56-c1fa-4e2c-a9d9-d6fb1b9b9948',
    '5fd08878-7b1f-4ade-a648-ad278d34ad45',
    'de599e76-4338-47b0-ad3b-62eeee8ac2fc',
    '91834fbb-dd51-4efa-a5fb-ff363049a097',
    '634af67e-135a-4c59-a383-aa70b3f7e219',
    'c4f9ba2a-3591-422d-a4e2-267ad8c92989',
    'b9f86ee2-dab6-4bb4-acdf-4349557e11a3',
    '607c0035-256a-4e39-acc3-9ac36ec549aa',
    'e94015f7-0a25-4e92-a90a-556044d17e24',
    '5c1b3869-9249-403f-af2f-dc09478334db',
    'da752b90-3199-41ad-a851-57ebb3df31d1',
    '45307a21-6b3b-4780-ae97-d673d79ef871',
    '68c4f655-1ba6-4138-a020-5a318c963fcb',
    '38d96651-58ef-4824-a215-9ca61adce610',
    '16ad1936-420d-4ecd-a307-18780d3a8617',
    'b598e3fe-3497-43ab-a1b5-0d2f9559d092',
    '86819328-d14e-4796-a89d-618c969ba309',
    '03ab357c-6c21-4402-a5ae-6448153cf933',
    '7cf73e1f-709d-4241-a1b5-4df13f3fae37'
  ]::uuid[]));
delete from public.product_translations where product_id in (select unnest(array[
    '5b4e688a-1bb0-4e16-aeb8-a933014cd3ac',
    '463b673c-890e-4f78-a417-64d42558faf1',
    '9b451883-7805-4dca-aed7-09b0f90cc1a7',
    'c3f669a9-f4fb-45d4-a43d-2a99056788f6',
    'bdffaae6-440e-4d69-aa70-c5c50aebeddc',
    '2422be56-c1fa-4e2c-a9d9-d6fb1b9b9948',
    '5fd08878-7b1f-4ade-a648-ad278d34ad45',
    'de599e76-4338-47b0-ad3b-62eeee8ac2fc',
    '91834fbb-dd51-4efa-a5fb-ff363049a097',
    '634af67e-135a-4c59-a383-aa70b3f7e219',
    'c4f9ba2a-3591-422d-a4e2-267ad8c92989',
    'b9f86ee2-dab6-4bb4-acdf-4349557e11a3',
    '607c0035-256a-4e39-acc3-9ac36ec549aa',
    'e94015f7-0a25-4e92-a90a-556044d17e24',
    '5c1b3869-9249-403f-af2f-dc09478334db',
    'da752b90-3199-41ad-a851-57ebb3df31d1',
    '45307a21-6b3b-4780-ae97-d673d79ef871',
    '68c4f655-1ba6-4138-a020-5a318c963fcb',
    '38d96651-58ef-4824-a215-9ca61adce610',
    '16ad1936-420d-4ecd-a307-18780d3a8617',
    'b598e3fe-3497-43ab-a1b5-0d2f9559d092',
    '86819328-d14e-4796-a89d-618c969ba309',
    '03ab357c-6c21-4402-a5ae-6448153cf933',
    '7cf73e1f-709d-4241-a1b5-4df13f3fae37'
  ]::uuid[]));
delete from public.products where id in (select unnest(array[
    '5b4e688a-1bb0-4e16-aeb8-a933014cd3ac',
    '463b673c-890e-4f78-a417-64d42558faf1',
    '9b451883-7805-4dca-aed7-09b0f90cc1a7',
    'c3f669a9-f4fb-45d4-a43d-2a99056788f6',
    'bdffaae6-440e-4d69-aa70-c5c50aebeddc',
    '2422be56-c1fa-4e2c-a9d9-d6fb1b9b9948',
    '5fd08878-7b1f-4ade-a648-ad278d34ad45',
    'de599e76-4338-47b0-ad3b-62eeee8ac2fc',
    '91834fbb-dd51-4efa-a5fb-ff363049a097',
    '634af67e-135a-4c59-a383-aa70b3f7e219',
    'c4f9ba2a-3591-422d-a4e2-267ad8c92989',
    'b9f86ee2-dab6-4bb4-acdf-4349557e11a3',
    '607c0035-256a-4e39-acc3-9ac36ec549aa',
    'e94015f7-0a25-4e92-a90a-556044d17e24',
    '5c1b3869-9249-403f-af2f-dc09478334db',
    'da752b90-3199-41ad-a851-57ebb3df31d1',
    '45307a21-6b3b-4780-ae97-d673d79ef871',
    '68c4f655-1ba6-4138-a020-5a318c963fcb',
    '38d96651-58ef-4824-a215-9ca61adce610',
    '16ad1936-420d-4ecd-a307-18780d3a8617',
    'b598e3fe-3497-43ab-a1b5-0d2f9559d092',
    '86819328-d14e-4796-a89d-618c969ba309',
    '03ab357c-6c21-4402-a5ae-6448153cf933',
    '7cf73e1f-709d-4241-a1b5-4df13f3fae37'
  ]::uuid[]));

-- 6) Base de connaissances, livreurs et carnet de comptes de démo.
delete from public.kb where id in (
  '5fa77cf6-56aa-4a58-a84a-bd2e5744a8de',
  '48cd0d3a-0f11-4a39-acc2-91c6df84cb67',
  '920d8fd7-8fc8-4d1c-a16f-bd2eed3c8735',
  'bb86dd53-aebd-486c-a7ef-cd067081129b',
  'f394e02f-b437-4785-a8f5-2b03498b15ef',
  'fc6f60a9-2d5c-460d-ae54-031f12cbad96',
  '53c5b575-5ee6-497f-a392-96e9f7b9d22d',
  '39cbace8-d88f-489a-a468-2067b52cb88d',
  'f15f2557-e1eb-400a-aa23-9b1821174370'
);
delete from public.couriers where id in (
  '9c62185e-4328-4330-a144-fda887da69b3',
  '8cd54e39-f3a2-4136-a67d-b56019c85c19',
  '61232bf5-8be6-45ee-adff-86f4250d9a5a'
);
delete from public.ledger where id in (
  '3be2c200-8a20-4252-aed0-e65e473e4e7a',
  'a06c69fe-8fdb-4db6-a41a-519f5be60ef6',
  '4ef3e426-1329-497c-a999-71826a1642ad',
  '458a3d43-9a56-4b5c-a034-7df9e72f4723',
  '72c379ec-9436-4b09-a581-4abb752afffe',
  '550adb9c-7b72-4f8a-a9ed-c45793fc1848',
  'df3ff073-6d47-484b-a61e-8e96ffcee1e9',
  '23e8965d-8098-4ba6-abce-4a85afcd6a86',
  '0682f0c4-390e-4b9b-a422-3a4cbce7b3a7',
  '78034607-a411-46a7-a3fc-0cac2e475739',
  'ddfa0c93-8610-4c0e-ab49-07ba70062bd5',
  '65159ff5-d016-4715-a4ee-3b19440be91c',
  'b7d90a42-a31e-465d-ab87-0e29867ea63e',
  '283837f5-ae9b-4740-aa96-3daab6962512',
  '71a964c3-d2e7-4ee2-ae7a-e0307613da5f',
  '8f4af06c-870c-4673-ac08-5821bb5070f2',
  'f2790ce0-7dc1-457f-a6af-beaa8f43c2aa'
);

-- 7) Numéros de commande : si plus aucune commande, la première vraie sera WX-10263.
do $$
begin
  if not exists (select 1 from public.orders) then
    perform setval('public.order_seq', 10263, false);
  end if;
end $$;

commit;

-- ───────────── Vérifications à lancer APRÈS (attendu : 0 partout) ─────────────
-- select count(*) from public.reviews where seed;
-- select count(*) from public.products where id in ('5b4e688a-1bb0-4e16-aeb8-a933014cd3ac', '463b673c-890e-4f78-a417-64d42558faf1', …);  -- produits de démo
-- select count(*) from public.orders where number in ('WX-10263','WX-10264','WX-10265','WX-10266');
-- select count(*) from public.kb;  select count(*) from public.ledger;  select count(*) from public.couriers;

-- ───────────── Ensuite ─────────────
--  • Saisir vos vrais produits (Admin → Produits), votre base de connaissances (Admin → Réglages) et vos livreurs (Admin → Livraisons).
--  • Vérifier les réglages : WhatsApp, e-mail, mentions légales, moyens de paiement réellement branchés.
