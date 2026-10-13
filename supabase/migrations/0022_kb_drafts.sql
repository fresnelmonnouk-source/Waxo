-- 0022_kb_drafts.sql : Brouillons de la base de connaissances (IA de l'admin, /admin/assistant-ia).
-- L'IA de l'admin ne publie jamais : elle crée des fiches `status = 'draft'`, que seul le clic « Publier » d'un admin
-- passe en `published`. Les lignes existantes restent publiées (valeurs par défaut).
--   status     : 'draft' | 'published'      (défaut 'published')
--   source     : 'manual' | 'ai'            (défaut 'manual' : fiche rédigée ou validée à la main)
--   created_at / updated_at                 (updated_at tenu par trigger)
-- Garde-fou en base : une fiche en brouillon est TOUJOURS inactive (trigger, jamais d'erreur) ; l'assistant client, qui
-- lit `active = true`, ne peut donc pas servir un brouillon, même avant d'ajouter le filtre `status = 'published'`.
-- Rejouable : if not exists / create or replace / drop … if exists.

alter table public.kb add column if not exists status text not null default 'published';
alter table public.kb add column if not exists source text not null default 'manual';
alter table public.kb add column if not exists created_at timestamptz not null default now();
alter table public.kb add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'kb_status_check' and conrelid = 'public.kb'::regclass) then
    alter table public.kb add constraint kb_status_check check (status in ('draft', 'published'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'kb_source_check' and conrelid = 'public.kb'::regclass) then
    alter table public.kb add constraint kb_source_check check (source in ('manual', 'ai'));
  end if;
end $$;

-- Brouillon = inactif, et date de modification à jour (sauf si la mise à jour fixe elle-même une autre date).
create or replace function public.kb_before_write() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'draft' then
    new.active := false;
  end if;
  if tg_op = 'UPDATE' and new.updated_at is not distinct from old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end;
$$;
-- Fonction de trigger uniquement : jamais appelable par l'API.
revoke all on function public.kb_before_write() from public, anon, authenticated;

drop trigger if exists kb_before_write on public.kb;
create trigger kb_before_write
  before insert or update on public.kb
  for each row execute function public.kb_before_write();

-- Défense en profondeur (déjà posé en 0001) : RLS active, lecture admin seulement, aucune écriture hors service_role.
alter table public.kb enable row level security;
revoke insert, update, delete on public.kb from anon, authenticated;

-- Liste admin triée par date de modification.
create index if not exists kb_updated_at_idx on public.kb (updated_at desc);
