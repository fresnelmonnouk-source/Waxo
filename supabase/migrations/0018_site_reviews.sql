-- 0018_site_reviews.sql — Avis sur la BOUTIQUE (pas sur un produit) : section de l'accueil avant la newsletter.
-- Sources : un client connecté ayant au moins une commande LIVRÉE (« client vérifié »), ou l'admin qui saisit un avis
-- reçu ailleurs (WhatsApp, Facebook…) AVEC l'accord du client. Tout avis est « à valider » : rien n'est publié sans
-- l'admin. Jamais d'avis fictif (décision 2026-10-12). Rejouable : if not exists / create or replace / drop … if exists.

create table if not exists public.site_reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  user_id uuid references auth.users(id) on delete set null,
  author text not null check (length(author) between 2 and 60),
  city text check (city is null or length(city) <= 40),
  rating int not null check (rating between 1 and 5),
  body text not null check (length(body) between 10 and 600),
  source text not null check (source in ('client', 'admin')),
  -- Admin : canal d'origine (WhatsApp, Facebook, oral…) et accord du client pour publier (obligatoire).
  origin text check (origin is null or length(origin) <= 40),
  consent boolean not null default false,
  -- Client vérifié : avis déposé par un compte ayant une commande livrée (calculé par le serveur, jamais par le client).
  verified boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'published', 'hidden')),
  constraint site_reviews_admin_consent check (source <> 'admin' or consent)
);
-- Un seul avis boutique par compte client.
create unique index if not exists site_reviews_one_per_user on public.site_reviews (user_id) where source = 'client' and user_id is not null;
create index if not exists site_reviews_published_idx on public.site_reviews (published_at desc) where status = 'published';

alter table public.site_reviews enable row level security;
drop policy if exists site_reviews_read on public.site_reviews;
create policy site_reviews_read on public.site_reviews for select using (status = 'published' or public.is_admin());
-- Écritures : service_role uniquement (route /api/site-reviews et actions admin), aucune policy d'écriture.
