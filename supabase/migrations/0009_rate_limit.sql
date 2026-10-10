-- Waxo 0009 (PROPOSITION Tariq, non appliquée) : limiteur de débit partagé (remplace les Map en mémoire).
-- Fenêtre fixe, un seul aller-retour, atomique (upsert). Table UNLOGGED : pas de WAL, perdue au crash (acceptable).
begin;
create unlogged table if not exists public.rate_limits (
  key text primary key,
  hits int not null,
  window_start timestamptz not null default now()
);
alter table public.rate_limits enable row level security;   -- aucune politique : service_role uniquement
revoke all on public.rate_limits from anon, authenticated;
create index if not exists rate_limits_window_idx on public.rate_limits(window_start);

-- true = appel autorisé ; false = limite atteinte.
create or replace function public.rate_hit(p_key text, p_max int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_hits int;
begin
  insert into public.rate_limits as r (key, hits, window_start) values (left(p_key, 200), 1, now())
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;
revoke execute on function public.rate_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_hit(text, int, int) to service_role;

-- Purge (à planifier avec pg_cron, voir plus bas) : delete from public.rate_limits where window_start < now() - interval '1 day';
commit;
-- Retour arrière : drop function if exists public.rate_hit(text, int, int); drop table if exists public.rate_limits;
