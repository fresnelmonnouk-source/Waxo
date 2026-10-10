-- Waxo 0010 · unicités manquantes (audits QA-9 et QA-11 / Raphaël O3)
--  1) un client = un avis par produit (double-tap / deux onglets ne créent plus de doublon) ;
--  2) un téléphone = un seul profil (le téléphone sert d'identifiant de connexion : deux comptes → connexion impossible pour les deux).
-- Idempotent. Les « dédoublonnages » ne touchent que des données invalides au regard de la nouvelle règle (base neuve : 0 ligne).
begin;

-- 1) Avis : on garde le plus ancien de chaque couple (produit, client) ; les avis « maison » (user_id null) ne sont pas concernés.
delete from public.reviews r
 using public.reviews k
 where r.user_id is not null
   and r.product_id = k.product_id
   and r.user_id = k.user_id
   and (r.created_at, r.id) > (k.created_at, k.id);
create unique index if not exists reviews_one_per_user_idx on public.reviews (product_id, user_id) where user_id is not null;

-- 2) Téléphones : le plus ancien profil garde le numéro, les autres le perdent (le compte reste utilisable par e-mail ;
--    le client peut ressaisir un numéro depuis « Mes informations »). Le vide ('') n'est jamais unique.
update public.profiles p
   set phone = ''
 where p.phone <> ''
   and exists (
     select 1 from public.profiles k
      where k.phone = p.phone and (k.created_at, k.id) < (p.created_at, p.id)
   );
create unique index if not exists profiles_phone_uidx on public.profiles (phone) where phone <> '';

-- Création du profil à l'inscription : un numéro déjà pris ne doit JAMAIS faire échouer l'inscription
-- (et ne révèle pas qu'il est pris : le compte est créé sans numéro). Course entre deux inscriptions : même repli.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_first text := left(coalesce(new.raw_user_meta_data->>'first_name',''), 80);
  v_last  text := left(coalesce(new.raw_user_meta_data->>'last_name',''), 80);
  v_phone text := left(coalesce(new.raw_user_meta_data->>'phone',''), 30);
begin
  begin
    insert into public.profiles (id, role, first_name, last_name, phone)
    values (new.id, 'client', v_first, v_last, v_phone)
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, role, first_name, last_name, phone)
    values (new.id, 'client', v_first, v_last, '')
    on conflict (id) do nothing;
  end;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

commit;
-- Retour arrière : drop index if exists public.reviews_one_per_user_idx; drop index if exists public.profiles_phone_uidx;
--                  (la fonction handle_new_user reste valable sans l'index.)
