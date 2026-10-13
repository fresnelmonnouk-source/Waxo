-- 0019_products_updated_at.sql — Date de dernière modification des produits (sitemap `lastmod`, audit SEO S11/S13).
-- `products.updated_at` : remplie à `now()` pour les lignes existantes, tenue à jour par un trigger à chaque modification
-- du produit (prix, stock, photo, activation…) ET de ses textes (`product_translations` : nom, slug, description).
-- Le code lit cette colonne à part et la tolère absente : la migration peut être appliquée avant ou après le déploiement.
-- Rejouable : if not exists / create or replace / drop … if exists.

alter table public.products add column if not exists updated_at timestamptz not null default now();

-- Produit modifié : nouvelle date (sauf si la mise à jour fixe elle-même une date différente, ex. import).
create or replace function public.products_touch_updated_at() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.products_touch_updated_at();

-- Texte du produit ajouté, modifié ou supprimé : le produit change aussi pour les moteurs.
create or replace function public.product_translations_touch_product() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products set updated_at = now()
   where id = coalesce(new.product_id, old.product_id);
  return null;
end;
$$;
-- Fonction de trigger uniquement : jamais appelable par l'API (SECURITY DEFINER exposé sinon).
revoke all on function public.product_translations_touch_product() from public, anon, authenticated;

drop trigger if exists product_translations_touch_product on public.product_translations;
create trigger product_translations_touch_product
  after insert or update or delete on public.product_translations
  for each row execute function public.product_translations_touch_product();

-- Sitemap : lecture des produits actifs par date.
create index if not exists products_updated_at_idx on public.products (updated_at desc) where active;
