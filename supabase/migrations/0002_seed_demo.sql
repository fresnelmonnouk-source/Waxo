-- GÉNÉRÉ par scripts/gen-seed.mjs — données de démonstration (retirables : voir bas de fichier).
begin;

insert into public.products (id, category_id, price, compare_price, stock, sold, rating_seed, rating_seed_count, keyword, bg, active, created_at) values
  ('5b4e688a-1bb0-4e16-aeb8-a933014cd3ac', 'maison', 8900, null, 5, 412, 4.7, 188, 'lampe', '#F3E3A6', true, '2026-04-12'),
  ('463b673c-890e-4f78-a417-64d42558faf1', 'maison', 6000, null, 12, 236, 4.4, 77, 'air', '#D3E4E6', true, '2026-05-02'),
  ('9b451883-7805-4dca-aed7-09b0f90cc1a7', 'maison', 11500, null, 6, 41, 4.6, 21, 'parfum', '#E2DAE8', true, '2026-09-24'),
  ('c3f669a9-f4fb-45d4-a43d-2a99056788f6', 'maison', 4500, null, 28, 351, 4.6, 163, 'raquette', '#DDE6C8', true, '2026-03-20'),
  ('bdffaae6-440e-4d69-aa70-c5c50aebeddc', 'cuisine', 7500, null, 18, 274, 4.8, 121, 'boîtes', '#F2D9C4', true, '2026-04-28'),
  ('2422be56-c1fa-4e2c-a9d9-d6fb1b9b9948', 'cuisine', 2000, null, 35, 189, 4.3, 59, 'éplucher', '#E3E8C9', true, '2026-06-03'),
  ('5fd08878-7b1f-4ade-a648-ad278d34ad45', 'cuisine', 4900, null, 3, 102, 4.5, 47, 'citron', '#EDE7B4', true, '2026-07-15'),
  ('de599e76-4338-47b0-ad3b-62eeee8ac2fc', 'cuisine', 12500, 15000, 9, 38, 4.7, 18, 'smoothie', '#F0D3C9', true, '2026-09-30'),
  ('91834fbb-dd51-4efa-a5fb-ff363049a097', 'beaute', 4500, 5500, 9, 167, 4.5, 88, 'peau', '#F1DCD6', true, '2026-05-18'),
  ('634af67e-135a-4c59-a383-aa70b3f7e219', 'beaute', 3900, null, 11, 84, 4.4, 38, 'miroir', '#F0E1CF', true, '2026-06-21'),
  ('c4f9ba2a-3591-422d-a4e2-267ad8c92989', 'beaute', 6500, null, 15, 52, 4.8, 26, 'pinceaux', '#EBD5E0', true, '2026-09-18'),
  ('b9f86ee2-dab6-4bb4-acdf-4349557e11a3', 'beaute', 13900, null, 7, 133, 4.6, 92, 'barbe', '#D8DCE0', true, '2026-02-10'),
  ('607c0035-256a-4e39-acc3-9ac36ec549aa', 'tech', 5900, null, 31, 389, 4.6, 142, 'charge', '#DCDDE8', true, '2026-03-02'),
  ('e94015f7-0a25-4e92-a90a-556044d17e24', 'tech', 14900, 18500, 4, 211, 4.5, 96, 'son', '#E6D3DE', true, '2026-04-05'),
  ('5c1b3869-9249-403f-af2f-dc09478334db', 'tech', 2500, null, 40, 156, 4.6, 63, 'câbles', '#E9E2D3', true, '2026-06-12'),
  ('da752b90-3199-41ad-a851-57ebb3df31d1', 'tech', 9900, null, 14, 298, 4.7, 131, 'énergie', '#D5E0DA', true, '2026-01-20'),
  ('45307a21-6b3b-4780-ae97-d673d79ef871', 'bureau', 3000, null, 26, 92, 4.9, 41, 'notes', '#EDE4CF', true, '2026-07-01'),
  ('68c4f655-1ba6-4138-a020-5a318c963fcb', 'bureau', 2900, null, 22, 205, 4.5, 112, 'support', '#DCE3EA', true, '2026-05-09'),
  ('38d96651-58ef-4824-a215-9ca61adce610', 'bureau', 3500, null, 17, 23, 4.6, 9, 'souris', '#D9E2D0', true, '2026-09-27'),
  ('16ad1936-420d-4ecd-a307-18780d3a8617', 'bureau', 1500, null, 48, 118, 4.7, 34, 'pastel', '#F2E6C2', true, '2026-08-19'),
  ('b598e3fe-3497-43ab-a1b5-0d2f9559d092', 'voyage', 6500, 8000, 23, 445, 4.8, 214, 'gourde', '#D7E3D2', true, '2026-02-25'),
  ('86819328-d14e-4796-a89d-618c969ba309', 'voyage', 5500, null, 14, 74, 4.7, 54, 'trousse', '#D9DFCF', true, '2026-06-30'),
  ('03ab357c-6c21-4402-a5ae-6448153cf933', 'voyage', 2500, null, 19, 131, 4.6, 73, 'dodo', '#D6D9E6', true, '2026-07-22'),
  ('7cf73e1f-709d-4241-a1b5-4df13f3fae37', 'voyage', 7000, null, 10, 12, 4.8, 7, 'valise', '#E4DCCB', true, '2026-10-04')
on conflict (id) do nothing;

insert into public.product_costs (product_id, cost) values
  ('5b4e688a-1bb0-4e16-aeb8-a933014cd3ac', 4600),
  ('463b673c-890e-4f78-a417-64d42558faf1', 3100),
  ('9b451883-7805-4dca-aed7-09b0f90cc1a7', 6200),
  ('c3f669a9-f4fb-45d4-a43d-2a99056788f6', 2100),
  ('bdffaae6-440e-4d69-aa70-c5c50aebeddc', 3900),
  ('2422be56-c1fa-4e2c-a9d9-d6fb1b9b9948', 800),
  ('5fd08878-7b1f-4ade-a648-ad278d34ad45', 2400),
  ('de599e76-4338-47b0-ad3b-62eeee8ac2fc', 7400),
  ('91834fbb-dd51-4efa-a5fb-ff363049a097', 2000),
  ('634af67e-135a-4c59-a383-aa70b3f7e219', 1800),
  ('c4f9ba2a-3591-422d-a4e2-267ad8c92989', 2900),
  ('b9f86ee2-dab6-4bb4-acdf-4349557e11a3', 7800),
  ('607c0035-256a-4e39-acc3-9ac36ec549aa', 2700),
  ('e94015f7-0a25-4e92-a90a-556044d17e24', 8600),
  ('5c1b3869-9249-403f-af2f-dc09478334db', 900),
  ('da752b90-3199-41ad-a851-57ebb3df31d1', 5600),
  ('45307a21-6b3b-4780-ae97-d673d79ef871', 1300),
  ('68c4f655-1ba6-4138-a020-5a318c963fcb', 1100),
  ('38d96651-58ef-4824-a215-9ca61adce610', 1500),
  ('16ad1936-420d-4ecd-a307-18780d3a8617', 600),
  ('b598e3fe-3497-43ab-a1b5-0d2f9559d092', 3300),
  ('86819328-d14e-4796-a89d-618c969ba309', 2500),
  ('03ab357c-6c21-4402-a5ae-6448153cf933', 900),
  ('7cf73e1f-709d-4241-a1b5-4df13f3fae37', 3400)
on conflict (product_id) do nothing;

insert into public.product_translations (product_id, locale, name, slug, description) values
  ('5b4e688a-1bb0-4e16-aeb8-a933014cd3ac', 'fr', 'Lampe LED rechargeable', 'lampe', 'Jusqu''à 10 h d''autonomie, 3 intensités. Idéale pendant les coupures de courant. Se recharge en USB-C.'),
  ('463b673c-890e-4f78-a417-64d42558faf1', 'fr', 'Mini ventilateur USB', 'ventilo', 'Silencieux, 3 vitesses, batterie de 6 h. Se pose sur un bureau ou se tient à la main.'),
  ('9b451883-7805-4dca-aed7-09b0f90cc1a7', 'fr', 'Diffuseur d''huiles essentielles', 'diffuseur', 'Brume fine et lumière douce, réservoir de 300 ml, arrêt automatique. Parfume une chambre ou un salon pendant 8 h.'),
  ('c3f669a9-f4fb-45d4-a43d-2a99056788f6', 'fr', 'Raquette anti-moustiques rechargeable', 'raquette', 'Grille à trois couches, lampe LED intégrée, recharge USB. Des soirées tranquilles sans produit chimique.'),
  ('bdffaae6-440e-4d69-aa70-c5c50aebeddc', 'fr', 'Set de 3 boîtes hermétiques', 'boites', 'Verre borosilicate et couvercles à clips. Passent au micro-ondes et au congélateur. 400, 700 et 1 000 ml.'),
  ('2422be56-c1fa-4e2c-a9d9-d6fb1b9b9948', 'fr', 'Éplucheur multifonction', 'eplucheur', '3 lames : épluche, râpe en julienne, découpe. Inox, manche antidérapant. Passe au lave-vaisselle.'),
  ('5fd08878-7b1f-4ade-a648-ad278d34ad45', 'fr', 'Bouteille presse-agrumes', 'agrumes', 'Pressez une orange ou un citron directement dans la bouteille. 500 ml, sans BPA. Se démonte pour le lavage.'),
  ('de599e76-4338-47b0-ad3b-62eeee8ac2fc', 'fr', 'Blender portable USB', 'blender', 'Gobelet de 400 ml, 6 lames inox, recharge USB-C. Un jus de fruits frais au bureau ou en déplacement.'),
  ('91834fbb-dd51-4efa-a5fb-ff363049a097', 'fr', 'Brosse nettoyante visage', 'brosse', 'Silicone doux, étanche, rechargeable. Nettoie en profondeur sans irriter. 2 modes de vibration.'),
  ('634af67e-135a-4c59-a383-aa70b3f7e219', 'fr', 'Miroir LED de poche', 'miroir', 'Double face dont une grossissante x3, éclairage LED rechargeable. Tient dans un sac à main.'),
  ('c4f9ba2a-3591-422d-a4e2-267ad8c92989', 'fr', 'Set de 10 pinceaux de maquillage', 'pinceaux', 'Poils synthétiques doux, manches en bois et trousse de rangement. Pour le teint, les yeux et les sourcils.'),
  ('b9f86ee2-dab6-4bb4-acdf-4349557e11a3', 'fr', 'Tondeuse barbe rechargeable', 'tondeuse', '5 sabots de 1 à 10 mm, lames inox, 90 minutes d''autonomie. Étanche, se rince sous l''eau.'),
  ('607c0035-256a-4e39-acc3-9ac36ec549aa', 'fr', 'Chargeur rapide 20 W USB-C', 'chargeur', 'Recharge un smartphone à 50 % en 30 minutes. Compatible iPhone, Samsung, Tecno, Infinix. Câble inclus.'),
  ('e94015f7-0a25-4e92-a90a-556044d17e24', 'fr', 'Écouteurs sans fil', 'ecouteurs', 'Bluetooth 5.3, 24 h d''écoute avec le boîtier. Micro pour les appels. Résistants à la sueur.'),
  ('5c1b3869-9249-403f-af2f-dc09478334db', 'fr', 'Organisateur de câbles (x10)', 'cables', 'Attaches en silicone réutilisables pour ranger chargeurs et câbles. Un bureau net en deux minutes.'),
  ('da752b90-3199-41ad-a851-57ebb3df31d1', 'fr', 'Batterie externe 10 000 mAh', 'batterie', 'Recharge un smartphone 2 à 3 fois. Deux ports USB et un port USB-C, indicateur de niveau. Format poche.'),
  ('45307a21-6b3b-4780-ae97-d673d79ef871', 'fr', 'Carnet A5 pointillé', 'carnet', '160 pages en papier 100 g, couverture rigide, élastique et marque-page. Pour les listes, les cours, les idées.'),
  ('68c4f655-1ba6-4138-a020-5a318c963fcb', 'fr', 'Support téléphone pliable', 'support', 'Aluminium, angle réglable, compatible tablettes. Pour les appels vidéo, les recettes, les séries.'),
  ('38d96651-58ef-4824-a215-9ca61adce610', 'fr', 'Tapis de souris ergonomique', 'tapis', 'Repose-poignet en mousse à mémoire de forme, base antidérapante. Moins de fatigue après une longue journée.'),
  ('16ad1936-420d-4ecd-a307-18780d3a8617', 'fr', 'Lot de 6 surligneurs pastel', 'surligneurs', 'Pointe biseautée, encre qui ne traverse pas le papier. Six couleurs douces pour les cours et les réunions.'),
  ('b598e3fe-3497-43ab-a1b5-0d2f9559d092', 'fr', 'Gourde isotherme 750 ml', 'gourde', 'Acier inoxydable double paroi. Garde l''eau fraîche 24 h et le thé chaud 12 h. Bouchon étanche, ne coule pas dans le sac.'),
  ('86819328-d14e-4796-a89d-618c969ba309', 'fr', 'Trousse de toilette pliable', 'trousse', 'Crochet pour l''accrocher, 4 compartiments, tissu imperméable. Se plie à plat dans la valise.'),
  ('03ab357c-6c21-4402-a5ae-6448153cf933', 'fr', 'Masque de sommeil 3D', 'masque', 'Bloque la lumière sans appuyer sur les yeux. Mousse légère, sangle réglable.'),
  ('7cf73e1f-709d-4241-a1b5-4df13f3fae37', 'fr', 'Organiseurs de valise (x6)', 'organiseurs', 'Six pochettes de tailles différentes, tissu léger et fermetures solides. Une valise rangée, on retrouve tout.')
on conflict (product_id, locale) do nothing;

insert into public.reviews (id, product_id, author, rating, body, verified, seed, hidden, created_at) values
  ('9d583e38-8bdd-49eb-a63d-d9e3e41de4f8', '5b4e688a-1bb0-4e16-aeb8-a933014cd3ac', 'Nadège K.', 5, 'Elle a tenu toute une soirée de coupure sans faiblir. Je l''utilise aussi pour lire le soir.', true, true, false, '2026-09-29'),
  ('e935f055-09b8-4059-a147-2918f9bd8766', '5b4e688a-1bb0-4e16-aeb8-a933014cd3ac', 'Hermann Q.', 4, 'Très bonne lumière. La recharge complète prend environ 4 h, à prévoir.', true, true, false, '2026-09-02'),
  ('817beb4a-2f28-49d9-a422-83898e0786fc', '463b673c-890e-4f78-a417-64d42558faf1', 'Aïcha Y.', 4, 'Pratique au bureau quand la clim est en panne. Pas très puissant en vitesse 1.', true, true, false, '2026-08-30'),
  ('40d61403-2de5-4038-a1ef-b58847ea82f6', '463b673c-890e-4f78-a417-64d42558faf1', 'Brice L.', 5, 'Silencieux, je dors avec. La batterie tient la nuit en vitesse 2.', true, true, false, '2026-07-14'),
  ('f5d4f170-5268-4510-aa06-c6bb6e84ee68', '9b451883-7805-4dca-aed7-09b0f90cc1a7', 'Carine M.', 5, 'Joli objet, la lumière est douce. Je le mets 2 h avant de dormir.', true, true, false, '2026-10-03'),
  ('782ed332-2e8c-459e-af83-1bf979686bc5', '9b451883-7805-4dca-aed7-09b0f90cc1a7', 'Romaric H.', 4, 'Bon diffuseur. Les huiles ne sont pas fournies, il faut les acheter à part.', true, true, false, '2026-09-28'),
  ('be14b30e-8a95-4241-aced-7aa48af053c6', 'c3f669a9-f4fb-45d4-a43d-2a99056788f6', 'Gildas T.', 5, 'Redoutable. Mes enfants dorment enfin tranquilles.', true, true, false, '2026-09-15'),
  ('da4ebf3a-4fec-4680-a9cc-844991828545', 'c3f669a9-f4fb-45d4-a43d-2a99056788f6', 'Jocelyne D.', 4, 'Efficace, la lampe attire bien les moustiques. Le bouton demande un peu de force.', true, true, false, '2026-08-11'),
  ('b6dd5b4c-92b6-47ef-a7e0-5627499a4c07', 'bdffaae6-440e-4d69-aa70-c5c50aebeddc', 'Carine M.', 5, 'Le verre est épais et les couvercles ferment vraiment bien. Rien n''a coulé dans mon sac.', true, true, false, '2026-09-20'),
  ('178c534e-309a-4435-adaf-5405f6528441', 'bdffaae6-440e-4d69-aa70-c5c50aebeddc', 'Fabrice K.', 5, 'Parfait pour emporter mon déjeuner. Ça passe au micro-ondes sans souci.', true, true, false, '2026-08-25'),
  ('8a4442c2-d4d9-44ff-aa64-17b2d7f91004', '2422be56-c1fa-4e2c-a9d9-d6fb1b9b9948', 'Ornella S.', 4, 'La lame julienne est top pour les carottes. Un peu petit pour l''igname.', true, true, false, '2026-09-09'),
  ('85bab24f-eece-4d18-a22b-109d18ea1b62', '2422be56-c1fa-4e2c-a9d9-d6fb1b9b9948', 'Koffi A.', 4, 'Bon rapport qualité-prix, ça coupe bien.', true, true, false, '2026-07-30'),
  ('3d0dafbb-5e53-4e9f-ad05-31f4f6c9f8f3', '5fd08878-7b1f-4ade-a648-ad278d34ad45', 'Bénédicte A.', 5, 'Je fais mon jus de citron le matin directement dans la bouteille. Facile à laver.', true, true, false, '2026-09-26'),
  ('2eced18e-3761-43a4-a19e-41fab8195328', '5fd08878-7b1f-4ade-a648-ad278d34ad45', 'Ulrich Z.', 4, 'Pratique, il faut juste bien serrer le bouchon.', true, true, false, '2026-08-17'),
  ('54c56aa2-ddc5-4a8d-abc5-5f26329f43da', 'de599e76-4338-47b0-ad3b-62eeee8ac2fc', 'Mariam S.', 5, 'Smoothie mangue-banane en 30 secondes. La batterie tient plusieurs utilisations.', true, true, false, '2026-10-05'),
  ('d745acf8-6c7f-4fbc-a0e6-7e800728e1b7', 'de599e76-4338-47b0-ad3b-62eeee8ac2fc', 'Sènan T.', 4, 'Très pratique. Il faut couper les fruits en petits morceaux.', true, true, false, '2026-10-02'),
  ('6fbe5501-cbc2-4471-a1e4-34d50b8b1bd8', '91834fbb-dd51-4efa-a5fb-ff363049a097', 'Fifamè G.', 5, 'Ma peau est plus nette après deux semaines. Douce, même sur peau sensible.', true, true, false, '2026-09-18'),
  ('07eb8e92-d2bf-4ec4-a987-efd98e902177', '91834fbb-dd51-4efa-a5fb-ff363049a097', 'Grâce A.', 4, 'Bien, mais j''aurais aimé un troisième mode plus doux.', true, true, false, '2026-08-04'),
  ('219386eb-cc11-457c-a5d3-b72d7a60a860', '634af67e-135a-4c59-a383-aa70b3f7e219', 'Aïcha Y.', 4, 'Tient dans mon sac, la lumière aide beaucoup pour retoucher le maquillage.', true, true, false, '2026-09-07'),
  ('9f2b5036-e111-41a8-a327-491442157303', '634af67e-135a-4c59-a383-aa70b3f7e219', 'Carine M.', 4, 'Petit et pratique. Le côté grossissant est très utile.', true, true, false, '2026-07-21'),
  ('b22d63d3-d84c-443e-a8dc-ff06632c9c65', 'c4f9ba2a-3591-422d-a4e2-267ad8c92989', 'Ornella S.', 5, 'Les poils sont très doux et ne se perdent pas. La trousse est jolie.', true, true, false, '2026-10-01'),
  ('ae7ffdbd-d2cd-4758-a208-dbf6d5b7a1a1', 'c4f9ba2a-3591-422d-a4e2-267ad8c92989', 'Nadège K.', 5, 'Super qualité pour le prix. Le pinceau à fond de teint est parfait.', true, true, false, '2026-09-25'),
  ('2f04dc4b-b74a-43f3-ade9-efc3d11e3c19', 'b9f86ee2-dab6-4bb4-acdf-4349557e11a3', 'Romaric H.', 5, 'Coupe nette, les sabots tiennent bien. Je l''utilise tous les deux jours.', true, true, false, '2026-09-12'),
  ('f69f3317-adee-41bb-ad8a-4ca9ac2c06e6', 'b9f86ee2-dab6-4bb4-acdf-4349557e11a3', 'Brice L.', 4, 'Bonne autonomie. Le cordon de charge est un peu court.', true, true, false, '2026-08-02'),
  ('fd65599f-1bf3-430a-a971-b06ae3c8f1ca', '607c0035-256a-4e39-acc3-9ac36ec549aa', 'Hermann Q.', 5, 'Mon Tecno se recharge deux fois plus vite qu''avec l''ancien chargeur.', true, true, false, '2026-09-30'),
  ('168e182e-1054-4a49-a3c4-89718dac1791', '607c0035-256a-4e39-acc3-9ac36ec549aa', 'Abdou B.', 4, 'Fonctionne bien avec mon iPhone. Le câble fourni est un peu court.', true, true, false, '2026-09-03'),
  ('93a843ab-0067-4c65-a63b-f6d7690a2d46', 'e94015f7-0a25-4e92-a90a-556044d17e24', 'Gildas T.', 4, 'Bon son, bonne autonomie. Le micro est correct pour les appels.', true, true, false, '2026-09-22'),
  ('8f788af2-216d-43b2-ad79-c962afdd53e9', 'e94015f7-0a25-4e92-a90a-556044d17e24', 'Fabrice K.', 5, 'Légers et confortables, je les garde toute la journée.', true, true, false, '2026-08-28'),
  ('503ac19e-9c01-4124-a416-b9841679881f', '5c1b3869-9249-403f-af2f-dc09478334db', 'Fabrice K.', 5, 'Mon bureau est enfin rangé. Les attaches sont solides.', true, true, false, '2026-09-11'),
  ('06596717-4369-4fb5-a1b7-f8aeb2f2e251', '5c1b3869-9249-403f-af2f-dc09478334db', 'Jocelyne D.', 4, 'Simple et efficace, j''en ai mis dans mon sac aussi.', true, true, false, '2026-08-14'),
  ('a75a1938-03df-4001-a433-b70f63fa1a39', 'da752b90-3199-41ad-a851-57ebb3df31d1', 'Koffi A.', 5, 'Indispensable pendant les délestages. Elle recharge mon téléphone presque 3 fois.', true, true, false, '2026-10-04'),
  ('45da29e2-0d29-4bf4-a2b9-8c780a362ebd', 'da752b90-3199-41ad-a851-57ebb3df31d1', 'Sènan T.', 4, 'Bonne batterie, un peu lourde pour une poche de chemise.', true, true, false, '2026-09-16'),
  ('c6bce39e-b266-46e9-a95c-38a31278588e', '45307a21-6b3b-4780-ae97-d673d79ef871', 'Bénédicte A.', 5, 'Papier épais, l''encre ne traverse pas. Je l''adore.', true, true, false, '2026-09-27'),
  ('4fe311f4-488c-4440-ad1a-489050759b4f', '45307a21-6b3b-4780-ae97-d673d79ef871', 'Abdou B.', 5, 'Parfait pour mes cours. La couverture rigide protège bien.', true, true, false, '2026-09-01'),
  ('664d7b15-e72a-408f-ab1e-f2fd75f4be61', '68c4f655-1ba6-4138-a020-5a318c963fcb', 'Mariam S.', 5, 'Je regarde mes recettes dessus en cuisinant. Très stable.', true, true, false, '2026-09-19'),
  ('4097008b-c204-4f0c-a617-bade3a74b48b', '68c4f655-1ba6-4138-a020-5a318c963fcb', 'Ulrich Z.', 4, 'Solide et pliable. L''angle se règle facilement.', true, true, false, '2026-08-08'),
  ('12399f6e-9d64-42dc-a0cc-e5b07eb4ec9f', '38d96651-58ef-4824-a215-9ca61adce610', 'Fabrice K.', 5, 'Mon poignet ne me fait plus mal le soir.', true, true, false, '2026-10-03'),
  ('9c20d448-ec07-479f-a738-beb10e883bd0', '38d96651-58ef-4824-a215-9ca61adce610', 'Carine M.', 4, 'Confortable, il ne glisse pas sur le bureau.', true, true, false, '2026-09-30'),
  ('6aaf07fe-1bdf-4990-a840-84be04332b7a', '16ad1936-420d-4ecd-a307-18780d3a8617', 'Ornella S.', 5, 'Les couleurs sont douces et ne bavent pas.', true, true, false, '2026-09-14'),
  ('612506ac-85e5-49fa-a187-5c3aec84e5ee', '16ad1936-420d-4ecd-a307-18780d3a8617', 'Grâce A.', 4, 'Bons surligneurs, la pointe permet de souligner fin ou large.', true, true, false, '2026-08-21'),
  ('8e8bb397-0f05-40f2-ada4-805fe0e5ad39', 'b598e3fe-3497-43ab-a1b5-0d2f9559d092', 'Koffi A.', 5, 'L''eau reste fraîche toute la journée, même dans la voiture.', true, true, false, '2026-10-01'),
  ('78b33bbb-a9ac-4148-a12a-25ecc5784bc3', 'b598e3fe-3497-43ab-a1b5-0d2f9559d092', 'Fifamè G.', 5, 'Elle ne coule pas dans mon sac. Très bonne qualité.', true, true, false, '2026-09-13'),
  ('628d3f91-97af-4055-a4b7-9652e1839a15', '86819328-d14e-4796-a89d-618c969ba309', 'Hermann Q.', 5, 'Le crochet est très pratique à l''hôtel. Tout est bien rangé.', true, true, false, '2026-09-06'),
  ('e11379d2-ca1f-46ce-acab-1bc31c512bc7', '86819328-d14e-4796-a89d-618c969ba309', 'Aïcha Y.', 4, 'Bonne taille, tissu facile à nettoyer.', true, true, false, '2026-08-19'),
  ('1f4ff23d-5d61-4f75-aae5-ad33dec40efc', '03ab357c-6c21-4402-a5ae-6448153cf933', 'Afi H.', 5, 'Il ne touche pas les yeux, je dors beaucoup mieux.', true, true, false, '2026-09-15'),
  ('ededa88b-6db5-4481-a3be-08cac77ef615', '03ab357c-6c21-4402-a5ae-6448153cf933', 'Brice L.', 4, 'Bloque bien la lumière. La sangle pourrait être plus large.', true, true, false, '2026-08-09'),
  ('0d45bc05-b806-488f-aa31-501430970c30', '7cf73e1f-709d-4241-a1b5-4df13f3fae37', 'Grâce A.', 5, 'Ma valise n''a jamais été aussi bien rangée.', true, true, false, '2026-10-06'),
  ('607e6608-fb98-46b0-a626-202d2ebc0a46', '7cf73e1f-709d-4241-a1b5-4df13f3fae37', 'Romaric H.', 5, 'Tissu léger mais solide, fermetures de bonne qualité.', true, true, false, '2026-10-05')
on conflict (id) do nothing;

insert into public.kb (id, tag, title, text, keywords) values
  ('5fa77cf6-56aa-4a58-a84a-bd2e5744a8de', 'Livraison', 'Délais et frais de livraison', 'Cotonou et Calavi : livraison le lendemain pour toute commande passée avant 18 h, du lundi au samedi, 1 000 F, offerte dès 15 000 F d''achat. Autres villes du Bénin (Porto-Novo, Parakou, Bohicon, Abomey, Ouidah, Natitingou…) : 48 à 72 h, 2 500 F, par transporteur interurbain. Pas de livraison hors du Bénin pour le moment.', 'livrer livreur délai quand combien jours ville parakou porto-novo bohicon abomey ouidah natitingou lokossa expédition envoi frais'),
  ('48cd0d3a-0f11-4a39-acc2-91c6df84cb67', 'Livraison', 'Le jour de la livraison', 'Le client reçoit une confirmation WhatsApp avec le créneau. Le livreur appelle avant d''arriver. Si le client est absent, la livraison est reprogrammée le jour ouvré suivant sans frais. Après deux tentatives, la commande est annulée et remboursée.', 'absent créneau appel heure reporter reprogrammer tentative'),
  ('920d8fd7-8fc8-4d1c-a16f-bd2eed3c8735', 'Paiement', 'Moyens de paiement', 'Paiements acceptés : MTN MoMo, Moov Money, Celtiis Cash, carte Visa ou Mastercard, et paiement à la livraison en espèces ou Mobile Money. Aucun membre de l''équipe ne demande jamais de code secret.', 'payer paiement momo moov celtiis carte visa mastercard espèces cash livraison code'),
  ('bb86dd53-aebd-486c-a7ef-cd067081129b', 'Retours', 'Échange et remboursement', '7 jours après réception pour demander un échange ou un remboursement, pour un produit non utilisé, complet et dans son emballage d''origine. Produits d''hygiène descellés exclus sauf défaut. À Cotonou et Calavi le livreur reprend le produit. Remboursement sous 7 jours sur le moyen de paiement utilisé.', 'retour retourner rembourser remboursement échanger échange défaut cassé abîmé'),
  ('f394e02f-b437-4785-a8f5-2b03498b15ef', 'Retours', 'Produit défectueux ou erreur', 'Un défaut ou une erreur de produit est à signaler dans les 48 h avec une photo. Wá xɔ échange ou rembourse et prend en charge les frais de retour.', 'défectueux marche pas panne cassé erreur mauvais produit photo garantie'),
  ('fc6f60a9-2d5c-460d-ae54-031f12cbad96', 'Compte', 'Commander sans compte', 'On peut commander sans compte, tout est confirmé par WhatsApp. Un compte permet de suivre ses commandes et de publier un avis. En créant un compte avec le même numéro, les commandes passées s''y rattachent automatiquement.', 'compte inscription inscrire suivre commande avis connexion mot de passe'),
  ('53c5b575-5ee6-497f-a392-96e9f7b9d22d', 'Boutique', 'Qui sommes-nous', 'Wá xɔ (« venez acheter » en fon) est une boutique en ligne basée à Cotonou, sans magasin physique. Tout le stock est chez nous, à Cotonou : le stock affiché est réel. Service client par WhatsApp du lundi au samedi de 8 h à 19 h.', 'boutique magasin adresse passer récupérer retrait horaires contact whatsapp stock'),
  ('39cbace8-d88f-489a-a468-2067b52cb88d', 'Produit', 'Diffuseur : quelles huiles ?', 'Le diffuseur fonctionne avec toutes les huiles essentielles pures ou parfums hydrosolubles : 3 à 5 gouttes pour 300 ml d''eau. Les huiles ne sont pas fournies. Ne pas utiliser d''huiles végétales épaisses.', 'diffuseur huile essentielle parfum gouttes eau'),
  ('f15f2557-e1eb-400a-aa23-9b1821174370', 'Produit', 'Compatibilité des chargeurs et batteries', 'Le chargeur 20 W et la batterie externe sont compatibles avec iPhone, Samsung, Tecno, Infinix, Itel et la plupart des smartphones USB-C. Pour un iPhone ancien, il faut un câble Lightning (non fourni).', 'compatible iphone samsung tecno infinix itel câble lightning usb charge')
on conflict (id) do nothing;

insert into public.couriers (id, name, phone, zone, active) values
  ('9c62185e-4328-4330-a144-fda887da69b3', 'Rachidi Alassane', '0166112200', 'cotonou', true),
  ('8cd54e39-f3a2-4136-a67d-b56019c85c19', 'Eustache Hounkpè', '0197445566', 'cotonou', true),
  ('61232bf5-8be6-45ee-adff-86f4250d9a5a', 'Transporteur interurbain', '0161778899', 'autre', true)
on conflict (id) do nothing;

insert into public.ledger (id, date, cat, label, amount) values
  ('3be2c200-8a20-4252-aed0-e65e473e4e7a', '2026-07-15', 'stock', 'Réassort : lampes, batteries, chargeurs', 380000),
  ('a06c69fe-8fdb-4db6-a41a-519f5be60ef6', '2026-07-20', 'loyer', 'Loyer du dépôt, juillet', 40000),
  ('4ef3e426-1329-497c-a999-71826a1642ad', '2026-08-02', 'stock', 'Réassort cuisine et voyage', 290000),
  ('458a3d43-9a56-4b5c-a034-7df9e72f4723', '2026-08-05', 'loyer', 'Loyer du dépôt, août', 40000),
  ('72c379ec-9436-4b09-a581-4abb752afffe', '2026-08-10', 'pub', 'Publicité Facebook et Instagram', 35000),
  ('550adb9c-7b72-4f8a-a9ed-c45793fc1848', '2026-08-20', 'emballage', 'Sachets kraft et papier bulle', 14000),
  ('df3ff073-6d47-484b-a61e-8e96ffcee1e9', '2026-08-31', 'livraison', 'Livreurs, août', 26000),
  ('23e8965d-8098-4ba6-abce-4a85afcd6a86', '2026-09-01', 'stock', 'Réassort beauté et bureau', 310000),
  ('0682f0c4-390e-4b9b-a422-3a4cbce7b3a7', '2026-09-05', 'loyer', 'Loyer du dépôt, septembre', 40000),
  ('78034607-a411-46a7-a3fc-0cac2e475739', '2026-09-08', 'pub', 'Publicité Facebook et Instagram', 45000),
  ('ddfa0c93-8610-4c0e-ab49-07ba70062bd5', '2026-09-15', 'pub', 'Statuts WhatsApp sponsorisés (influenceuse)', 20000),
  ('65159ff5-d016-4715-a4ee-3b19440be91c', '2026-09-22', 'autre', 'Hébergement du site et nom de domaine', 15000),
  ('b7d90a42-a31e-465d-ab87-0e29867ea63e', '2026-09-30', 'livraison', 'Livreurs, septembre', 34000),
  ('283837f5-ae9b-4740-aa96-3daab6962512', '2026-10-01', 'stock', 'Nouveautés : blender, organiseurs, tapis', 265000),
  ('71a964c3-d2e7-4ee2-ae7a-e0307613da5f', '2026-10-03', 'pub', 'Publicité Facebook et Instagram', 30000),
  ('8f4af06c-870c-4673-ac08-5821bb5070f2', '2026-10-05', 'loyer', 'Loyer du dépôt, octobre', 40000),
  ('f2790ce0-7dc1-457f-a6af-beaa8f43c2aa', '2026-10-06', 'emballage', 'Cartons d''expédition', 12000)
on conflict (id) do nothing;

commit;

-- Pour repartir de zéro avant la mise en prod réelle (à lancer par Fresnel) :
-- delete from public.ledger; delete from public.reviews where seed; delete from public.products; delete from public.couriers; delete from public.kb;