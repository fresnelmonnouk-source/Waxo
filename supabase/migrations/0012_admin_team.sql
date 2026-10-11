-- 0012_admin_team.sql — équipe d'administration : historique des ajouts/retraits d'admins + garde « au moins un admin ».
-- Les rôles ne changent que via service_role (server actions /admin/equipe) ; profiles_guard_role (0001) bloque toujours
-- anon/authenticated. Rejouable : create … if not exists / create or replace / drop trigger if exists.

-- Historique : qui a donné ou retiré le rôle admin, à qui, quand. Lecture et écriture service_role uniquement (aucune policy).
create table if not exists public.admin_role_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_id uuid references auth.users(id) on delete set null,
  target_id uuid references auth.users(id) on delete set null,
  target_email text not null check (char_length(target_email) between 3 and 254),
  action text not null check (action in ('grant', 'invite', 'revoke'))
);
create index if not exists admin_role_events_created_at_idx on public.admin_role_events (created_at desc);
alter table public.admin_role_events enable row level security;
revoke all on table public.admin_role_events from anon, authenticated;

-- Garde : la boutique garde TOUJOURS au moins un admin (retrait de rôle ou suppression de compte).
-- Verrou transactionnel : deux retraits simultanés ne peuvent pas passer tous les deux en se croyant « pas le dernier ».
create or replace function public.profiles_keep_one_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role is distinct from 'admin') then
    perform pg_advisory_xact_lock(hashtext('waxo_admin_roles'));
    if not exists (select 1 from public.profiles where role = 'admin' and id <> old.id) then
      raise exception 'last_admin' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;
revoke execute on function public.profiles_keep_one_admin() from public, anon, authenticated;

drop trigger if exists profiles_keep_one_admin on public.profiles;
create trigger profiles_keep_one_admin before update of role or delete on public.profiles
  for each row execute function public.profiles_keep_one_admin();

-- Promotion d'un compte existant : on coupe TOUTES ses sessions (audit Raphaël : un compte pré-créé par un tiers qui en
-- connaît le mot de passe ne doit pas hériter de l'accès admin). Appelable par service_role uniquement.
create or replace function public.admin_revoke_user_sessions(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.refresh_tokens where user_id = p_user::text;
  delete from auth.sessions where user_id = p_user;
end $$;
revoke execute on function public.admin_revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.admin_revoke_user_sessions(uuid) to service_role;
