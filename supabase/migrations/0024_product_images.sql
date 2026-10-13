-- 0024_product_images.sql — Plusieurs photos par produit (8 au plus). À exécuter APRÈS 0023, dans l'éditeur SQL Supabase.
--
-- `products.images` : liste ordonnée des photos, la PREMIÈRE est la photo principale (couverture).
-- `products.image_url` est CONSERVÉE et vaut toujours `images[1]` : panier, commandes, assistant, packs, Open Graph et tout
-- code déjà déployé continuent de lire une seule photo sans changement.
--
-- Pourquoi un trigger (et pas seulement l'écriture admin) : la migration peut être appliquée AVANT le déploiement du code
-- qui écrit `images`. L'ancien code n'écrit que `image_url` ; sans trigger, `images` garderait l'ancienne photo et la fiche
-- afficherait une photo périmée. Le trigger tient l'invariant pour TOUT écrivain (ancien code, nouveau code, éditeur SQL,
-- import futur) :
--   - `images` modifiée            → `image_url := images[1]` (nouveau code : la liste fait foi) ;
--   - seule `image_url` modifiée   → la couverture est remplacée (ou retirée) dans `images`, les autres photos restent ;
--   - insertion avec `images` vide → `images := array[image_url]` (ancien code).
-- Le nouveau code écrit quand même les deux colonnes (cohérent avec le trigger, et lisible sans lui).
--
-- Contrainte : 8 photos au plus, sans doublon ni valeur nulle, chacune une URL publique du bucket `products` (0003), sans
-- espace, guillemet, chevron ni « .. ». Le PROJET exact n'est pas figé ici (local, préproduction et production n'ont pas le
-- même domaine) : c'est la server action qui vérifie le domaine (isStorageImageUrl + NEXT_PUBLIC_SUPABASE_URL).
--
-- Reprise : `images = array[image_url]` quand `image_url` est renseignée, `images` vide et l'URL conforme. Une ancienne URL
-- non conforme reste dans `image_url` seule (la boutique l'affiche toujours : repli du code sur `image_url`).
-- RLS inchangée (la colonne suit la politique `products_read` de la table). Rejouable : if not exists / create or replace /
-- drop … if exists / contrainte ajoutée une seule fois.

alter table public.products add column if not exists images text[] not null default '{}';

-- Validité d'une liste de photos (pure : utilisable dans une contrainte CHECK).
create or replace function public.product_images_valid(imgs text[]) returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select imgs is not null
     and coalesce(array_ndims(imgs), 1) = 1
     and cardinality(imgs) <= 8
     and array_position(imgs, null) is null
     and not exists (
       select 1
         from unnest(imgs) as u(url)
        where length(url) > 500
           or strpos(url, '..') > 0
           or url !~ '^https?://[^[:space:]"''<>]+/storage/v1/object/public/products/[^[:space:]"''<>]+$'
     )
     and cardinality(imgs) = (select count(distinct url) from unnest(imgs) as u(url));
$$;

-- Synchronisation image_url <-> images (voir l'en-tête).
create or replace function public.products_sync_images() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if cardinality(new.images) = 0 and new.image_url is not null then
      new.images := array[new.image_url];
    else
      new.image_url := new.images[1];
    end if;
  elsif new.images is distinct from old.images then
    new.image_url := new.images[1];
  elsif new.image_url is distinct from old.image_url then
    if new.image_url is null then
      new.images := coalesce(old.images[2:], '{}');
    else
      new.images := array[new.image_url] || array_remove(coalesce(old.images[2:], '{}'), new.image_url);
    end if;
    new.image_url := new.images[1];
  end if;
  return new;
end;
$$;

drop trigger if exists products_sync_images on public.products;
create trigger products_sync_images
  before insert or update of images, image_url on public.products
  for each row execute function public.products_sync_images();

-- Reprise de la photo unique existante.
update public.products
   set images = array[image_url]
 where image_url is not null
   and cardinality(images) = 0
   and public.product_images_valid(array[image_url]);

-- Contrainte ajoutée une seule fois (validée sur les lignes existantes, déjà conformes après la reprise).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_images_valid' and conrelid = 'public.products'::regclass
  ) then
    alter table public.products add constraint products_images_valid check (public.product_images_valid(images));
  end if;
end;
$$;
