-- 0020_site_reviews_columns.sql — Avis boutique : la clé publique ne lit plus que les colonnes affichées (audit Raphaël F6).
-- La politique site_reviews_read (0018) laisse anon / authenticated lire TOUTES les colonnes des avis publiés, dont
-- user_id, origin et consent (données de relecture). Privilèges par colonne : seules les colonnes servies par
-- src/lib/site-reviews/data.ts restent lisibles (+ status, nécessaire au filtre `status = 'published'`).
-- L'admin et la route /api/site-reviews passent par service_role : non concernés.
-- À appliquer APRÈS 0018. Rejouable (sans effet si la table n'existe pas encore).

do $$
begin
  if to_regclass('public.site_reviews') is null then
    raise notice '0020 : table site_reviews absente (0018 non appliquée), rien à faire';
    return;
  end if;
  revoke all on table public.site_reviews from anon, authenticated;
  grant select (id, author, city, rating, body, verified, published_at, status) on table public.site_reviews to anon, authenticated;
end $$;
