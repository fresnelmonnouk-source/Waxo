-- Waxo (Wá xɔ) — 0006 : 3 packs de démonstration (retirables : voir bas de fichier).
-- À exécuter APRÈS 0001 (schéma) et 0002 (produits de démonstration). Idempotent : peut être relancé sans effet.
-- Mêmes packs, mêmes identifiants et mêmes textes que le repli en code (src/lib/catalog/packs.ts) :
-- identifiant = md5('pack:<clé>') mis en forme comme scripts/gen-seed.mjs (voir tests/packs-demo.test.ts).
-- Les contenus sont retrouvés par le slug FR des produits ; un pack n'est inséré QUE si tous ses produits existent
-- (jamais de pack vide : place_order le vendrait sans décrémenter aucun stock).

do $$
declare
  d record;
  v_expected int;
  v_found int;
begin
  for d in
    select * from (values
      (
        '84625ba6-5cbc-470d-ad5f-2e3d3eaa87f7'::uuid, 8900,
        'pack-bureau-confort', 'Pack Bureau confort',
        'Tout pour un bureau agréable : un support téléphone pliable, un tapis de souris ergonomique, un carnet A5 pointillé et un lot de 6 surligneurs pastel. Prêt à travailler, à prix réduit.',
        'comfy-desk-pack', 'Comfy Desk Pack',
        'Everything for a pleasant desk: a foldable phone stand, an ergonomic mouse pad, a dotted A5 notebook and a set of 6 pastel highlighters. Ready to work, at a reduced price.',
        '{"support":1,"tapis":1,"carnet":1,"surligneurs":1}'::jsonb
      ),
      (
        '57d46e34-7b1b-4ddd-ac59-d3e47be10448'::uuid, 17900,
        'pack-voyage-leger', 'Pack Voyage léger',
        'Le kit du voyageur organisé : une gourde isotherme 750 ml, une trousse de toilette pliable, un masque de sommeil 3D et des organiseurs de valise. Tout dans le même colis.',
        'travel-light-pack', 'Travel Light Pack',
        'The organised traveller''s kit: a 750 ml insulated bottle, a foldable toiletry bag, a 3D sleep mask and suitcase organisers. Everything in the same parcel.',
        '{"gourde":1,"trousse":1,"masque":1,"organiseurs":1}'::jsonb
      ),
      (
        'b5e11703-2e20-484d-a3d8-21c94651fc3a'::uuid, 11900,
        'pack-beaute-douceur', 'Pack Beauté douceur',
        'Un rituel simple pour prendre soin de soi : une brosse nettoyante visage, un miroir LED de poche et un set de 10 pinceaux de maquillage. Trois essentiels, un seul prix.',
        'gentle-beauty-pack', 'Gentle Beauty Pack',
        'A simple routine to look after yourself: a facial cleansing brush, a pocket LED mirror and a set of 10 makeup brushes. Three essentials, one price.',
        '{"brosse":1,"miroir":1,"pinceaux":1}'::jsonb
      )
    ) as x(id, price, fr_slug, fr_name, fr_desc, en_slug, en_name, en_desc, items)
  loop
    select count(*) into v_expected from jsonb_each_text(d.items);
    select count(*) into v_found
      from jsonb_each_text(d.items) as e(slug, qty)
      join public.product_translations pt on pt.locale = 'fr' and pt.slug = e.slug;

    if v_found <> v_expected then
      raise notice 'Pack % ignoré : produits de démonstration manquants (% sur %)', d.fr_slug, v_found, v_expected;
      continue;
    end if;

    insert into public.packs (id, price, active) values (d.id, d.price, true)
      on conflict (id) do nothing;

    insert into public.pack_translations (pack_id, locale, name, slug, description) values
      (d.id, 'fr', d.fr_name, d.fr_slug, d.fr_desc),
      (d.id, 'en', d.en_name, d.en_slug, d.en_desc)
      on conflict do nothing;

    insert into public.pack_items (pack_id, product_id, qty)
      select d.id, pt.product_id, e.qty::int
      from jsonb_each_text(d.items) as e(slug, qty)
      join public.product_translations pt on pt.locale = 'fr' and pt.slug = e.slug
      on conflict (pack_id, product_id) do nothing;
  end loop;
end $$;

-- Pour retirer ces packs avant la mise en prod réelle (à lancer par Fresnel ; à faire AVANT de supprimer les produits
-- de démonstration, car pack_items référence products) :
-- delete from public.packs where id in (
--   '84625ba6-5cbc-470d-ad5f-2e3d3eaa87f7', '57d46e34-7b1b-4ddd-ac59-d3e47be10448', 'b5e11703-2e20-484d-a3d8-21c94651fc3a');
