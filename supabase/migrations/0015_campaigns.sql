-- 0015_campaigns.sql — Campagnes promotionnelles (Black Friday, Noël, Tabaski…) + demande d'avis après livraison.
-- Une campagne a des dates : pendant [starts_at, ends_at[ et si active, ses produits sont vendus au prix de campagne.
-- Le prix facturé reste calculé PAR LA BASE (place_order, reprise à l'identique de 0008 + 2 changements marqués « 0015 »).
-- Prix barré affiché = prix normal du produit (jamais un prix inventé). Rejouable : if not exists / create or replace.

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 60),
  name_fr text not null check (length(name_fr) between 2 and 60),
  name_en text not null check (length(name_en) between 2 and 60),
  tagline_fr text not null default '' check (length(tagline_fr) <= 160),
  tagline_en text not null default '' check (length(tagline_en) <= 160),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  active boolean not null default true,
  show_menu boolean not null default true,
  show_banner boolean not null default true,
  show_countdown boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaigns_dates_check check (ends_at > starts_at)
);
create index if not exists campaigns_window_idx on public.campaigns (starts_at, ends_at) where active;

create table if not exists public.campaign_items (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sale_price int not null check (sale_price > 0),
  primary key (campaign_id, product_id)
);
create index if not exists campaign_items_product_idx on public.campaign_items (product_id);

alter table public.campaigns enable row level security;
alter table public.campaign_items enable row level security;
drop policy if exists campaigns_read on public.campaigns;
create policy campaigns_read on public.campaigns for select using (active or public.is_admin());
drop policy if exists campaign_items_read on public.campaign_items;
-- Prix de campagne lisibles seulement une fois la campagne commencée (pas de fuite des prix du Black Friday avant l'heure).
create policy campaign_items_read on public.campaign_items for select
  using (public.is_admin() or exists (select 1 from public.campaigns c where c.id = campaign_id and c.active and now() >= c.starts_at));
-- Écritures : service_role uniquement (server actions /admin/campagnes), aucune policy d'écriture.

-- Ligne de commande → campagne qui a fixé son prix (suivi des ventes par campagne ; null = prix normal).
alter table public.order_items add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;
create index if not exists order_items_campaign_idx on public.order_items (campaign_id) where campaign_id is not null;

-- Demande d'avis après livraison : date d'envoi (une seule fois par commande).
alter table public.orders add column if not exists review_requested_at timestamptz;

-- Campagne en cours la plus avantageuse pour un produit (si plusieurs se chevauchent).
create or replace function public.campaign_for(p_product uuid)
returns table (campaign_id uuid, sale_price int)
language sql stable security definer set search_path = public as $$
  select c.id, ci.sale_price
  from public.campaign_items ci
  join public.campaigns c on c.id = ci.campaign_id
  where ci.product_id = p_product and c.active and now() >= c.starts_at and now() < c.ends_at
  order by ci.sale_price asc, c.starts_at asc
  limit 1
$$;
revoke execute on function public.campaign_for(uuid) from public, anon, authenticated;
grant execute on function public.campaign_for(uuid) to service_role;

-- Remplacement des produits d'une campagne en UNE transaction (admin) : jamais d'instant où la campagne est vide,
-- et un échec d'insertion annule aussi la suppression. p_items = [{ "product_id": uuid, "sale_price": int }, …].
create or replace function public.replace_campaign_items(p_campaign uuid, p_items jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'campaign_items_empty';
  end if;
  delete from public.campaign_items where campaign_id = p_campaign;
  insert into public.campaign_items (campaign_id, product_id, sale_price)
  select p_campaign, x.product_id, x.sale_price
  from jsonb_to_recordset(p_items) as x(product_id uuid, sale_price int);
end $$;
revoke execute on function public.replace_campaign_items(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_campaign_items(uuid, jsonb) to service_role;

-- Enregistrement COMPLET d'une campagne (champs + produits) en une transaction (audit Tariq) : jamais une campagne en
-- ligne avec de nouvelles dates et d'anciens prix. p_id null = création. Renvoie l'id.
create or replace function public.save_campaign(p_id uuid, p_row jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_id is null then
    insert into public.campaigns (slug, name_fr, name_en, tagline_fr, tagline_en, starts_at, ends_at, active, show_menu, show_banner, show_countdown)
    values (p_row ->> 'slug', p_row ->> 'name_fr', p_row ->> 'name_en', coalesce(p_row ->> 'tagline_fr', ''), coalesce(p_row ->> 'tagline_en', ''),
            (p_row ->> 'starts_at')::timestamptz, (p_row ->> 'ends_at')::timestamptz, (p_row ->> 'active')::boolean,
            (p_row ->> 'show_menu')::boolean, (p_row ->> 'show_banner')::boolean, (p_row ->> 'show_countdown')::boolean)
    returning id into v_id;
  else
    update public.campaigns set
      slug = p_row ->> 'slug', name_fr = p_row ->> 'name_fr', name_en = p_row ->> 'name_en',
      tagline_fr = coalesce(p_row ->> 'tagline_fr', ''), tagline_en = coalesce(p_row ->> 'tagline_en', ''),
      starts_at = (p_row ->> 'starts_at')::timestamptz, ends_at = (p_row ->> 'ends_at')::timestamptz,
      active = (p_row ->> 'active')::boolean, show_menu = (p_row ->> 'show_menu')::boolean,
      show_banner = (p_row ->> 'show_banner')::boolean, show_countdown = (p_row ->> 'show_countdown')::boolean,
      updated_at = now()
    where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'campaign_not_found'; end if;
  end if;
  perform public.replace_campaign_items(v_id, p_items);
  return v_id;
end $$;
revoke execute on function public.save_campaign(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_campaign(uuid, jsonb, jsonb) to service_role;

-- place_order : identique à 0008, sauf les lignes marquées « 0015 ».
create or replace function public.place_order(
  p_items jsonb, p_customer jsonb, p_zone text, p_pay text, p_user uuid default null
) returns table (order_id uuid, order_number text, subtotal int, shipping_fee int, total int)
language plpgsql security definer set search_path = public as $$
declare
  v_ship jsonb; v_pay jsonb; v_free int; v_fee int;
  v_ord uuid; v_num text; v_sub int := 0;
  l record; c record; v_price int; v_name text; v_n int; v_item uuid; v_phone text;
  v_camp uuid; v_cprice int; -- 0015 : prix de campagne en cours (jamais au-dessus du prix normal)
  v_units int; v_expanded int; v_maxline int;
  c_max_line     constant int := 10; -- unités max par ligne (= MAX_QTY_PER_LINE de guard.ts)
  c_max_units    constant int := 20; -- articles max par commande, un pack compte pour qty (= MAX_UNITS_PER_ORDER)
  c_max_expanded constant int := 60; -- unités physiques max une fois les packs dépliés
  c_max_open     constant int := 3;  -- commandes ouvertes non payées par téléphone sur 24 h
begin
  if p_zone not in ('cotonou','autre') then raise exception 'invalid_zone'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'invalid_items'; end if;

  select value into v_pay from public.settings where key = 'pay';
  if coalesce((v_pay ->> p_pay)::boolean, false) is not true then raise exception 'payment_method_disabled'; end if;
  select value into v_ship from public.settings where key = 'shipping';
  if v_ship is null then raise exception 'shipping_not_configured'; end if;

  -- Plafonds (avant tout verrou)
  if exists (
    select 1 from (select x.kind, x.id, sum(x.qty)::int as qty
                   from jsonb_to_recordset(p_items) as x(kind text, id uuid, qty int) group by x.kind, x.id) a
    where a.qty is null or a.qty < 1
  ) then raise exception 'invalid_qty'; end if;

  select coalesce(sum(a.qty), 0)::int,
         coalesce(sum(case when a.kind = 'pack'
                           then a.qty * coalesce((select sum(pi.qty) from public.pack_items pi where pi.pack_id = a.id), 0)
                           else a.qty end), 0)::int,
         coalesce(max(a.qty), 0)::int
    into v_units, v_expanded, v_maxline
  from (select x.kind, x.id, sum(x.qty)::int as qty
        from jsonb_to_recordset(p_items) as x(kind text, id uuid, qty int) group by x.kind, x.id) a;
  if v_maxline > c_max_line or v_units > c_max_units or v_expanded > c_max_expanded then raise exception 'quantity_limit'; end if;

  -- Plafond de commandes ouvertes par téléphone (verrou consultatif : pas de contournement par requêtes parallèles)
  v_phone := trim(p_customer ->> 'phone');
  perform pg_advisory_xact_lock(hashtext('wx_open:' || coalesce(v_phone, '')));
  select count(*) into v_n from public.orders
    where phone = v_phone and status = 'nouvelle' and paid = false and created_at > now() - interval '24 hours';
  if v_n >= c_max_open then raise exception 'too_many_open_orders'; end if;

  -- UN SEUL verrou, dans l'ordre croissant de product_id, pour tous les produits touchés (produits + packs dépliés)
  perform 1 from public.products p
   where p.id in (
     select x.id from jsonb_to_recordset(p_items) as x(kind text, id uuid, qty int) where x.kind = 'product'
     union
     select pi.product_id from jsonb_to_recordset(p_items) as x(kind text, id uuid, qty int)
       join public.pack_items pi on pi.pack_id = x.id where x.kind = 'pack')
   order by p.id for update;

  insert into public.orders (user_id, name, phone, email, address, note, zone, pay)
  values (p_user, trim(p_customer ->> 'name'), v_phone, nullif(trim(p_customer ->> 'email'), ''),
          trim(p_customer ->> 'address'), nullif(trim(p_customer ->> 'note'), ''), p_zone, p_pay)
  returning id, number into v_ord, v_num;

  for l in
    select x.kind, x.id, sum(x.qty)::int as qty
    from jsonb_to_recordset(p_items) as x(kind text, id uuid, qty int)
    group by x.kind, x.id order by x.kind, x.id
  loop
    if l.kind = 'product' then
      select p.price, t.name into v_price, v_name
      from public.products p join public.product_translations t on t.product_id = p.id and t.locale = 'fr'
      where p.id = l.id and p.active;
      if not found then raise exception 'product_unavailable'; end if;
      -- 0015 : campagne en cours sur ce produit → prix de campagne, et la ligne retient la campagne (suivi des ventes).
      v_camp := null; v_cprice := null;
      select cf.campaign_id, cf.sale_price into v_camp, v_cprice from public.campaign_for(l.id) cf;
      if v_camp is not null and v_cprice is not null and v_cprice > 0 and v_cprice < v_price then
        v_price := v_cprice;
      else
        v_camp := null;
      end if;
      update public.products set stock = stock - l.qty, sold = sold + l.qty where id = l.id and stock >= l.qty;
      get diagnostics v_n = row_count;
      if v_n = 0 then raise exception 'out_of_stock'; end if;
      insert into public.order_items (order_id, product_id, name, unit_price, qty, campaign_id) values (v_ord, l.id, v_name, v_price, l.qty, v_camp);

    elsif l.kind = 'pack' then
      select p.price, t.name into v_price, v_name
      from public.packs p join public.pack_translations t on t.pack_id = p.id and t.locale = 'fr'
      where p.id = l.id and p.active;
      if not found then raise exception 'pack_unavailable'; end if;
      if not exists (select 1 from public.pack_items where pack_id = l.id) then raise exception 'pack_unavailable'; end if;
      insert into public.order_items (order_id, pack_id, name, unit_price, qty) values (v_ord, l.id, v_name, v_price, l.qty)
        returning id into v_item;
      for c in select product_id, qty from public.pack_items where pack_id = l.id order by product_id loop
        update public.products set stock = stock - c.qty * l.qty, sold = sold + c.qty * l.qty
          where id = c.product_id and active and stock >= c.qty * l.qty;
        get diagnostics v_n = row_count;
        if v_n = 0 then raise exception 'out_of_stock'; end if;
        insert into public.order_item_components (order_item_id, product_id, qty) values (v_item, c.product_id, c.qty * l.qty);
      end loop;
    else
      raise exception 'invalid_kind';
    end if;
    v_sub := v_sub + v_price * l.qty;
  end loop;

  v_free := coalesce((v_ship ->> 'freeFrom')::int, 0);
  v_fee := case when p_zone = 'cotonou' and v_free > 0 and v_sub >= v_free then 0
                when p_zone = 'cotonou' then coalesce((v_ship ->> 'cotonou')::int, 0)
                else coalesce((v_ship ->> 'autre')::int, 0) end;

  update public.orders set subtotal = v_sub, shipping_fee = v_fee, total = v_sub + v_fee where id = v_ord;
  return query select v_ord, v_num, v_sub, v_fee, v_sub + v_fee;
end $$;

revoke execute on function public.place_order(jsonb, jsonb, text, text, uuid) from public, anon, authenticated;
grant execute on function public.place_order(jsonb, jsonb, text, text, uuid) to service_role;
