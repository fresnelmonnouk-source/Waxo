-- Waxo (Wá xɔ) — 0007 : paiement en ligne (FedaPay) et e-mails transactionnels. Idempotent.
-- À exécuter dans l'éditeur SQL Supabase APRÈS 0001. Le code a un repli si ces colonnes/index manquent.

-- Langue de la commande : e-mails FR/EN. place_order ne la renseigne pas ; /api/checkout la met à jour juste après.
alter table public.orders add column if not exists locale text not null default 'fr';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orders_locale_check') then
    alter table public.orders add constraint orders_locale_check check (locale in ('fr','en'));
  end if;
end $$;

-- Idempotence de la commande : /api/checkout enregistre ici la clé (UUID) envoyée par le navigateur ; un second envoi
-- avec la même clé (coupure réseau, double onglet) renvoie la commande existante. Unicité partielle (clé facultative).
alter table public.orders add column if not exists idem_key text;
create unique index if not exists orders_idem_key_uidx on public.orders(idem_key) where idem_key is not null;

-- Recherche des paiements d'une commande / d'une transaction (webhook, cron de réconciliation).
create index if not exists payments_order_idx on public.payments(order_id);
create index if not exists payments_provider_ref_idx on public.payments(provider, provider_ref);

-- Candidates à l'expiration (cron) : commandes en ligne non payées, par date.
create index if not exists orders_unpaid_online_idx on public.orders(created_at)
  where status = 'nouvelle' and paid = false and pay <> 'cod';

-- RLS : déjà activée par 0001 sur payments / webhook_events (lecture admin seulement, écritures service_role).
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;
