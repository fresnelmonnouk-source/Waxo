-- Waxo (Wá xɔ) — 0001 : schéma cœur, RLS, fonctions SQL.
-- À exécuter dans l'éditeur SQL Supabase (par Fresnel). Idempotent autant que possible.
-- Montants = entiers XOF. Les écritures passent par service_role (API / server actions) ;
-- les politiques RLS n'ouvrent que la LECTURE publique/propriétaire et peu d'écritures client.

-- ───────────────────────── Profils ─────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('client','admin')),
  first_name text not null default '',
  last_name text not null default '',
  phone text not null default '',
  address text not null default '',
  news boolean not null default false,
  created_at timestamptz not null default now()
);

-- Helper RLS (créé après profiles : la fonction SQL est validée à la création)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Création auto du profil : rôle TOUJOURS 'client' (jamais lu depuis les metadata d'inscription).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, first_name, last_name, phone)
  values (
    new.id, 'client',
    left(coalesce(new.raw_user_meta_data->>'first_name',''), 80),
    left(coalesce(new.raw_user_meta_data->>'last_name',''), 80),
    left(coalesce(new.raw_user_meta_data->>'phone',''), 30)
  ) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Garde-fou : un utilisateur connecté ne peut jamais changer son rôle (fermeture de la 2e voie d'escalade).
create or replace function public.profiles_guard_role() returns trigger
language plpgsql as $$
begin
  if new.role is distinct from old.role and current_user in ('anon','authenticated') then
    raise exception 'role_change_forbidden';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.profiles_guard_role();

alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from anon, authenticated;
grant update (first_name, last_name, phone, address, news) on public.profiles to authenticated;

-- ───────────────────────── Catalogue ─────────────────────────
create table if not exists public.categories (
  id text primary key,
  label_fr text not null,
  label_en text not null,
  bg text not null,
  sort int not null default 0
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id text not null references public.categories(id),
  price int not null check (price >= 0),
  compare_price int check (compare_price is null or compare_price > price),
  stock int not null default 0 check (stock >= 0),
  sold int not null default 0 check (sold >= 0),
  rating_seed numeric(2,1) not null default 0 check (rating_seed between 0 and 5),
  rating_seed_count int not null default 0 check (rating_seed_count >= 0),
  keyword text not null default '',
  bg text,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products(category_id) where active;

-- Prix d'achat : table séparée, ADMIN SEULEMENT (ne doit jamais fuiter via un select * public).
create table if not exists public.product_costs (
  product_id uuid primary key references public.products(id) on delete cascade,
  cost int not null default 0 check (cost >= 0)
);

create table if not exists public.product_translations (
  product_id uuid not null references public.products(id) on delete cascade,
  locale text not null check (locale in ('fr','en')),
  name text not null,
  slug text not null,
  description text not null default '',
  primary key (product_id, locale),
  unique (locale, slug)
);

create table if not exists public.packs (
  id uuid primary key default gen_random_uuid(),
  price int not null check (price >= 0),
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.pack_translations (
  pack_id uuid not null references public.packs(id) on delete cascade,
  locale text not null check (locale in ('fr','en')),
  name text not null,
  slug text not null,
  description text not null default '',
  primary key (pack_id, locale),
  unique (locale, slug)
);
create table if not exists public.pack_items (
  pack_id uuid not null references public.packs(id) on delete cascade,
  product_id uuid not null references public.products(id),
  qty int not null default 1 check (qty between 1 and 50),
  primary key (pack_id, product_id)
);

-- ───────────────────────── Livraison ─────────────────────────
create table if not exists public.couriers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  zone text not null check (zone in ('cotonou','autre')),
  active boolean not null default true
);

-- ───────────────────────── Commandes ─────────────────────────
create sequence if not exists public.order_seq start 10263;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('WX-' || nextval('public.order_seq')),
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (length(name) between 2 and 120),
  phone text not null check (length(phone) between 8 and 20),
  email text check (email is null or length(email) <= 200),
  address text not null check (length(address) between 5 and 400),
  note text check (note is null or length(note) <= 500),
  zone text not null check (zone in ('cotonou','autre')),
  pay text not null check (pay in ('momo','moov','celtiis','carte','cod')),
  status text not null default 'nouvelle' check (status in ('nouvelle','preparation','livraison','livree','annulee')),
  subtotal int not null default 0 check (subtotal >= 0),
  shipping_fee int not null default 0 check (shipping_fee >= 0),
  total int not null default 0 check (total >= 0),
  paid boolean not null default false,
  paid_at timestamptz,
  courier_id uuid references public.couriers(id) on delete set null,
  cod_verified boolean not null default false,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);
create index if not exists orders_user_idx on public.orders(user_id);
create index if not exists orders_status_idx on public.orders(status, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  pack_id uuid references public.packs(id) on delete set null,
  name text not null,
  unit_price int not null check (unit_price >= 0),
  qty int not null check (qty between 1 and 99)
);
create index if not exists order_items_order_idx on public.order_items(order_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null,
  provider_ref text,
  status text not null check (status in ('pending','paid','amount_mismatch','needs_refund','failed')),
  amount int not null,
  raw jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.webhook_events (
  id text primary key,            -- '<provider>:<event_id>' → idempotence
  created_at timestamptz not null default now()
);

-- ───────────────────────── Clients / contenu ─────────────────────────
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  author text not null check (length(author) between 1 and 80),
  rating int not null check (rating between 1 and 5),
  body text not null check (length(body) between 1 and 1500),
  verified boolean not null default false,
  seed boolean not null default false,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists reviews_product_idx on public.reviews(product_id) where not hidden;

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  contact text not null check (length(contact) between 3 and 200),
  subject text not null default '',
  order_number text,
  body text not null check (length(body) between 1 and 3000),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.newsletter_subs (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email','whatsapp')),
  value text not null check (length(value) between 3 and 200),
  consent boolean not null default true,
  created_at timestamptz not null default now(),
  unique (channel, value)
);

create table if not exists public.pages (
  slug text not null,
  locale text not null check (locale in ('fr','en')),
  title text not null,
  body_md text not null default '',
  updated_at timestamptz not null default now(),
  primary key (slug, locale)
);

-- Réglages : is_public=true → lisible par tout le monde (jamais de secret ici).
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false
);

create table if not exists public.kb (
  id uuid primary key default gen_random_uuid(),
  tag text not null,
  title text not null,
  text text not null,
  keywords text not null default '',
  active boolean not null default true
);

create table if not exists public.ledger (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  cat text not null check (cat in ('stock','pub','livraison','emballage','loyer','salaire','autre')),
  label text not null,
  amount int not null check (amount >= 0)
);

create table if not exists public.fx_rates (
  currency text primary key check (currency in ('EUR','USD')),
  per_xof numeric(14,10) not null check (per_xof > 0),   -- 1 XOF = per_xof devise
  updated_at timestamptz not null default now()
);

-- ───────────────────────── RLS ─────────────────────────
do $$ declare t text; begin
  foreach t in array array['categories','products','product_costs','product_translations','packs','pack_translations','pack_items',
    'couriers','orders','order_items','payments','webhook_events','reviews','favorites','messages','newsletter_subs','pages',
    'settings','kb','ledger','fx_rates']
  loop execute format('alter table public.%I enable row level security', t); end loop;
end $$;

-- Lecture publique
drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select using (true);
drop policy if exists products_read on public.products;
create policy products_read on public.products for select using (active or public.is_admin());
drop policy if exists product_tr_read on public.product_translations;
create policy product_tr_read on public.product_translations for select
  using (exists (select 1 from public.products p where p.id = product_id and (p.active or public.is_admin())));
drop policy if exists packs_read on public.packs;
create policy packs_read on public.packs for select using (active or public.is_admin());
drop policy if exists pack_tr_read on public.pack_translations;
create policy pack_tr_read on public.pack_translations for select
  using (exists (select 1 from public.packs p where p.id = pack_id and (p.active or public.is_admin())));
drop policy if exists pack_items_read on public.pack_items;
create policy pack_items_read on public.pack_items for select
  using (exists (select 1 from public.packs p where p.id = pack_id and (p.active or public.is_admin())));
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select using (not hidden or public.is_admin());
drop policy if exists pages_read on public.pages;
create policy pages_read on public.pages for select using (true);
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (is_public or public.is_admin());
drop policy if exists fx_read on public.fx_rates;
create policy fx_read on public.fx_rates for select using (true);

-- Propriétaire / admin
drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists order_items_read on public.order_items;
create policy order_items_read on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));
drop policy if exists favorites_own on public.favorites;
create policy favorites_own on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Admin seulement (lecture) — toute écriture passe par service_role
drop policy if exists product_costs_admin on public.product_costs;
create policy product_costs_admin on public.product_costs for select using (public.is_admin());
drop policy if exists couriers_admin on public.couriers;
create policy couriers_admin on public.couriers for select using (public.is_admin());
drop policy if exists payments_admin on public.payments;
create policy payments_admin on public.payments for select using (public.is_admin());
drop policy if exists messages_admin on public.messages;
create policy messages_admin on public.messages for select using (public.is_admin());
drop policy if exists newsletter_admin on public.newsletter_subs;
create policy newsletter_admin on public.newsletter_subs for select using (public.is_admin());
drop policy if exists kb_admin on public.kb;
create policy kb_admin on public.kb for select using (public.is_admin());
drop policy if exists ledger_admin on public.ledger;
create policy ledger_admin on public.ledger for select using (public.is_admin());
-- webhook_events : aucune politique → inaccessible hors service_role.

-- Défense en profondeur : aucune écriture directe pour anon/authenticated (hors favoris + profil, ci-dessus)
revoke insert, update, delete on
  public.categories, public.products, public.product_costs, public.product_translations, public.packs,
  public.pack_translations, public.pack_items, public.couriers, public.orders, public.order_items,
  public.payments, public.webhook_events, public.reviews, public.messages, public.newsletter_subs,
  public.pages, public.settings, public.kb, public.ledger, public.fx_rates
  from anon, authenticated;
revoke insert, update, delete on public.favorites from anon;
revoke all on public.webhook_events from anon, authenticated;

-- ───────────────────────── Fonctions métier ─────────────────────────
-- Restitue le stock d'une commande (produits + contenu des packs).
create or replace function public._restock_order(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select product_id, qty from public.order_items where order_id = p_order and product_id is not null loop
    update public.products set stock = stock + r.qty, sold = greatest(sold - r.qty, 0) where id = r.product_id;
  end loop;
  for r in
    select pi.product_id, (oi.qty * pi.qty) as q
    from public.order_items oi join public.pack_items pi on pi.pack_id = oi.pack_id
    where oi.order_id = p_order and oi.pack_id is not null
  loop
    update public.products set stock = stock + r.q, sold = greatest(sold - r.q, 0) where id = r.product_id;
  end loop;
end $$;

-- Création de commande : recalcul serveur des prix, stock décrémenté de façon atomique.
-- p_items : [{"kind":"product"|"pack","id":"<uuid>","qty":2}]
-- p_customer : {"name","phone","email","address","note"}
create or replace function public.place_order(
  p_items jsonb, p_customer jsonb, p_zone text, p_pay text, p_user uuid default null
) returns table (order_id uuid, order_number text, subtotal int, shipping_fee int, total int)
language plpgsql security definer set search_path = public as $$
declare
  v_ship jsonb; v_pay jsonb; v_free int; v_fee int;
  v_ord uuid; v_num text; v_sub int := 0;
  l record; pi record; v_price int; v_name text; v_n int;
begin
  if p_zone not in ('cotonou','autre') then raise exception 'invalid_zone'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'invalid_items'; end if;

  select value into v_pay from public.settings where key = 'pay';
  if coalesce((v_pay ->> p_pay)::boolean, false) is not true then raise exception 'payment_method_disabled'; end if;
  select value into v_ship from public.settings where key = 'shipping';
  if v_ship is null then raise exception 'shipping_not_configured'; end if;

  insert into public.orders (user_id, name, phone, email, address, note, zone, pay)
  values (p_user, trim(p_customer ->> 'name'), trim(p_customer ->> 'phone'), nullif(trim(p_customer ->> 'email'), ''),
          trim(p_customer ->> 'address'), nullif(trim(p_customer ->> 'note'), ''), p_zone, p_pay)
  returning id, number into v_ord, v_num;

  -- Lignes agrégées et triées (ordre stable → pas de deadlock entre commandes concurrentes)
  for l in
    select x.kind, x.id, sum(x.qty)::int as qty
    from jsonb_to_recordset(p_items) as x(kind text, id uuid, qty int)
    group by x.kind, x.id order by x.kind, x.id
  loop
    if l.qty is null or l.qty < 1 or l.qty > 99 then raise exception 'invalid_qty'; end if;

    if l.kind = 'product' then
      select p.price, t.name into v_price, v_name
      from public.products p join public.product_translations t on t.product_id = p.id and t.locale = 'fr'
      where p.id = l.id and p.active for update of p;
      if not found then raise exception 'product_unavailable'; end if;
      update public.products set stock = stock - l.qty, sold = sold + l.qty where id = l.id and stock >= l.qty;
      get diagnostics v_n = row_count;
      if v_n = 0 then raise exception 'out_of_stock'; end if;
      insert into public.order_items (order_id, product_id, name, unit_price, qty) values (v_ord, l.id, v_name, v_price, l.qty);

    elsif l.kind = 'pack' then
      select p.price, t.name into v_price, v_name
      from public.packs p join public.pack_translations t on t.pack_id = p.id and t.locale = 'fr'
      where p.id = l.id and p.active;
      if not found then raise exception 'pack_unavailable'; end if;
      for pi in select product_id, qty from public.pack_items where pack_id = l.id order by product_id loop
        update public.products set stock = stock - pi.qty * l.qty, sold = sold + pi.qty * l.qty
          where id = pi.product_id and active and stock >= pi.qty * l.qty;
        get diagnostics v_n = row_count;
        if v_n = 0 then raise exception 'out_of_stock'; end if;
      end loop;
      insert into public.order_items (order_id, pack_id, name, unit_price, qty) values (v_ord, l.id, v_name, v_price, l.qty);
    else
      raise exception 'invalid_kind';
    end if;
    v_sub := v_sub + v_price * l.qty;
  end loop;

  v_free := coalesce((v_ship ->> 'freeFrom')::int, 0);
  -- Franco : Cotonou & Calavi seulement (règle de la maquette) ; autres villes = tarif plein.
  v_fee := case when p_zone = 'cotonou' and v_free > 0 and v_sub >= v_free then 0
                when p_zone = 'cotonou' then coalesce((v_ship ->> 'cotonou')::int, 0)
                else coalesce((v_ship ->> 'autre')::int, 0) end;

  update public.orders set subtotal = v_sub, shipping_fee = v_fee, total = v_sub + v_fee where id = v_ord;
  return query select v_ord, v_num, v_sub, v_fee, v_sub + v_fee;
end $$;

-- Paiement confirmé par le webhook (idempotent, montant vérifié).
-- Retourne : paid | duplicate | not_found | amount_mismatch | order_cancelled
create or replace function public.mark_paid(
  p_order uuid, p_provider text, p_event_id text, p_ref text, p_amount int, p_raw jsonb default null
) returns text
language plpgsql security definer set search_path = public as $$
declare v_n int; o record;
begin
  insert into public.webhook_events (id) values (p_provider || ':' || p_event_id) on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then return 'duplicate'; end if;

  select id, total, status, paid into o from public.orders where id = p_order for update;
  if not found then return 'not_found'; end if;
  if o.paid then return 'duplicate'; end if;

  if p_amount <> o.total then
    insert into public.payments (order_id, provider, provider_ref, status, amount, raw) values (o.id, p_provider, p_ref, 'amount_mismatch', p_amount, p_raw);
    return 'amount_mismatch';
  end if;
  if o.status = 'annulee' then
    insert into public.payments (order_id, provider, provider_ref, status, amount, raw) values (o.id, p_provider, p_ref, 'needs_refund', p_amount, p_raw);
    return 'order_cancelled';
  end if;

  update public.orders set paid = true, paid_at = now() where id = o.id;
  insert into public.payments (order_id, provider, provider_ref, status, amount, raw) values (o.id, p_provider, p_ref, 'paid', p_amount, p_raw);
  return 'paid';
end $$;

-- Annulation (admin / expiration) : statut + restitution du stock, une seule fois.
create or replace function public.cancel_order(p_order uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare o record;
begin
  select id, status into o from public.orders where id = p_order for update;
  if not found or o.status in ('annulee','livree') then return false; end if;
  update public.orders set status = 'annulee' where id = o.id;
  perform public._restock_order(o.id);
  return true;
end $$;

-- Libère le stock des commandes en ligne jamais payées.
create or replace function public.expire_stale_orders(p_minutes int default 60) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from public.orders
    where status = 'nouvelle' and paid = false and pay <> 'cod'
      and created_at < now() - make_interval(mins => p_minutes)
  loop
    if public.cancel_order(r.id) then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- Aucune de ces fonctions n'est appelable par anon/authenticated : uniquement service_role (API serveur).
revoke execute on function public._restock_order(uuid) from public, anon, authenticated;
revoke execute on function public.place_order(jsonb, jsonb, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.mark_paid(uuid, text, text, text, int, jsonb) from public, anon, authenticated;
revoke execute on function public.cancel_order(uuid) from public, anon, authenticated;
revoke execute on function public.expire_stale_orders(int) from public, anon, authenticated;
grant execute on function public._restock_order(uuid) to service_role;
grant execute on function public.place_order(jsonb, jsonb, text, text, uuid) to service_role;
grant execute on function public.mark_paid(uuid, text, text, text, int, jsonb) to service_role;
grant execute on function public.cancel_order(uuid) to service_role;
grant execute on function public.expire_stale_orders(int) to service_role;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
-- is_admin() reste exécutable : utilisée par les politiques RLS (ne révèle que le rôle de l'appelant).

-- ───────────────────────── Données de référence ─────────────────────────
insert into public.categories (id, label_fr, label_en, bg, sort) values
  ('maison','Maison','Home','#F3E3A6',1),
  ('cuisine','Cuisine','Kitchen','#F2D9C4',2),
  ('beaute','Beauté','Beauty','#F1DCD6',3),
  ('tech','Tech','Tech','#DCDDE8',4),
  ('bureau','Bureau','Office','#EDE4CF',5),
  ('voyage','Voyage','Travel','#D7E3D2',6)
on conflict (id) do nothing;

insert into public.settings (key, value, is_public) values
  ('brand', '{"shopName":"Wá xɔ","whatsapp":"+229 01 00 00 00 00","waNumber":"2290100000000","email":"contact@waxo.bj","hours":"Du lundi au samedi, de 8 h à 19 h","aiSign":"L''équipe Wá xɔ"}', true),
  ('shipping', '{"cotonou":1000,"autre":2500,"freeFrom":15000,"cutoff":18,"returnDays":7}', true),
  ('pay', '{"momo":true,"moov":true,"celtiis":true,"carte":true,"cod":true}', true),
  ('flags', '{"autoDraft":true}', false)
on conflict (key) do nothing;

insert into public.fx_rates (currency, per_xof) values ('EUR', 0.0015244901), ('USD', 0.0017800000)
on conflict (currency) do nothing;
