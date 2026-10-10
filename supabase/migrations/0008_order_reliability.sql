-- Waxo 0008 (PROPOSITION Tariq, non appliquée) : fiabilité commandes/stock.
-- Corrige : plafonds de quantité, ordre de verrouillage unique, snapshot de composition des packs,
-- expiration des COD non vérifiés, annulation d'une commande payée (needs_refund), course expiration/paiement,
-- politiques RLS en initplan, index de clés étrangères. Idempotent. Retour arrière : 0008_down.sql.
-- À passer APRÈS 0001..0007 (0007 fournit déjà payments_order_idx et orders.idem_key).
begin;

-- 1. Snapshot du contenu des packs au moment de la commande (le restock ne dépend plus de pack_items actuel)
create table if not exists public.order_item_components (
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  qty int not null check (qty >= 1),
  primary key (order_item_id, product_id)
);
create index if not exists order_item_components_product_idx on public.order_item_components(product_id);
alter table public.order_item_components enable row level security;
revoke all on public.order_item_components from anon, authenticated;

-- 2. Restitution du stock : agrégée et verrouillée dans l'ordre croissant de product_id
create or replace function public._restock_order(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select s.product_id, sum(s.q)::int as q from (
      select oi.product_id, oi.qty as q
        from public.order_items oi where oi.order_id = p_order and oi.product_id is not null
      union all
      select c.product_id, c.qty
        from public.order_item_components c join public.order_items oi on oi.id = c.order_item_id
        where oi.order_id = p_order
      union all  -- commandes antérieures à 0003 (pas de snapshot) : composition actuelle du pack
      select pi.product_id, oi.qty * pi.qty
        from public.order_items oi join public.pack_items pi on pi.pack_id = oi.pack_id
        where oi.order_id = p_order and oi.pack_id is not null
          and not exists (select 1 from public.order_item_components c where c.order_item_id = oi.id)
    ) s
    group by s.product_id
    order by s.product_id
  loop
    update public.products set stock = stock + r.q, sold = greatest(sold - r.q, 0) where id = r.product_id;
  end loop;
end $$;

-- 3. place_order : plafonds, verrou unique ordonné, snapshot packs, plafond de commandes ouvertes par téléphone
create or replace function public.place_order(
  p_items jsonb, p_customer jsonb, p_zone text, p_pay text, p_user uuid default null
) returns table (order_id uuid, order_number text, subtotal int, shipping_fee int, total int)
language plpgsql security definer set search_path = public as $$
declare
  v_ship jsonb; v_pay jsonb; v_free int; v_fee int;
  v_ord uuid; v_num text; v_sub int := 0;
  l record; c record; v_price int; v_name text; v_n int; v_item uuid; v_phone text;
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
      update public.products set stock = stock - l.qty, sold = sold + l.qty where id = l.id and stock >= l.qty;
      get diagnostics v_n = row_count;
      if v_n = 0 then raise exception 'out_of_stock'; end if;
      insert into public.order_items (order_id, product_id, name, unit_price, qty) values (v_ord, l.id, v_name, v_price, l.qty);

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

-- 4. cancel_order : une commande PAYEE annulée laisse une trace de remboursement
create or replace function public.cancel_order(p_order uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare o record;
begin
  select id, status, paid, total into o from public.orders where id = p_order for update;
  if not found or o.status in ('annulee','livree') then return false; end if;
  update public.orders set status = 'annulee' where id = o.id;
  if o.paid and not exists (select 1 from public.payments where order_id = o.id and status = 'needs_refund') then
    insert into public.payments (order_id, provider, provider_ref, status, amount)
    values (o.id, 'system', 'cancel_after_paid', 'needs_refund', o.total);
  end if;
  perform public._restock_order(o.id);
  return true;
end $$;

-- 5. expire_stale_orders : COD non vérifiés inclus ; lot borné ; verrou + re-test de paid (course avec mark_paid)
drop function if exists public.expire_stale_orders(int);
create or replace function public.expire_stale_orders(p_minutes int default 60, p_cod_hours int default 48) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in
    select id from public.orders
    where status = 'nouvelle' and paid = false
      and ( (pay <> 'cod' and created_at < now() - make_interval(mins => p_minutes))
         or (pay = 'cod' and cod_verified = false and created_at < now() - make_interval(hours => p_cod_hours)) )
    order by created_at
    limit 500
    for update skip locked      -- re-évalue "paid = false" sous verrou : un paiement validé entre-temps l'exclut
  loop
    if public.cancel_order(r.id) then n := n + 1; end if;
  end loop;
  return n;
end $$;

revoke execute on function public._restock_order(uuid) from public, anon, authenticated;
revoke execute on function public.place_order(jsonb, jsonb, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.cancel_order(uuid) from public, anon, authenticated;
revoke execute on function public.expire_stale_orders(int, int) from public, anon, authenticated;
grant execute on function public._restock_order(uuid) to service_role;
grant execute on function public.place_order(jsonb, jsonb, text, text, uuid) to service_role;
grant execute on function public.cancel_order(uuid) to service_role;
grant execute on function public.expire_stale_orders(int, int) to service_role;

-- 6. RLS : is_admin()/auth.uid() évalués UNE fois par requête (initplan) au lieu d'une fois par ligne
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders for select using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists order_items_read on public.order_items;
create policy order_items_read on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = (select auth.uid()) or (select public.is_admin()))));
drop policy if exists favorites_own on public.favorites;
create policy favorites_own on public.favorites for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists products_read on public.products;
create policy products_read on public.products for select using (active or (select public.is_admin()));
drop policy if exists product_tr_read on public.product_translations;
create policy product_tr_read on public.product_translations for select
  using (exists (select 1 from public.products p where p.id = product_id and (p.active or (select public.is_admin()))));
drop policy if exists packs_read on public.packs;
create policy packs_read on public.packs for select using (active or (select public.is_admin()));
drop policy if exists pack_tr_read on public.pack_translations;
create policy pack_tr_read on public.pack_translations for select
  using (exists (select 1 from public.packs p where p.id = pack_id and (p.active or (select public.is_admin()))));
drop policy if exists pack_items_read on public.pack_items;
create policy pack_items_read on public.pack_items for select
  using (exists (select 1 from public.packs p where p.id = pack_id and (p.active or (select public.is_admin()))));
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select using (not hidden or (select public.is_admin()));
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (is_public or (select public.is_admin()));
drop policy if exists product_costs_admin on public.product_costs;
create policy product_costs_admin on public.product_costs for select using ((select public.is_admin()));
drop policy if exists couriers_admin on public.couriers;
create policy couriers_admin on public.couriers for select using ((select public.is_admin()));
drop policy if exists payments_admin on public.payments;
create policy payments_admin on public.payments for select using ((select public.is_admin()));
drop policy if exists messages_admin on public.messages;
create policy messages_admin on public.messages for select using ((select public.is_admin()));
drop policy if exists newsletter_admin on public.newsletter_subs;
create policy newsletter_admin on public.newsletter_subs for select using ((select public.is_admin()));
drop policy if exists kb_admin on public.kb;
create policy kb_admin on public.kb for select using ((select public.is_admin()));
drop policy if exists ledger_admin on public.ledger;
create policy ledger_admin on public.ledger for select using ((select public.is_admin()));

-- 7. Index : clés étrangères non indexées + plafond de commandes ouvertes
create index if not exists order_items_product_idx on public.order_items(product_id) where product_id is not null;
create index if not exists order_items_pack_idx on public.order_items(pack_id) where pack_id is not null;
create index if not exists orders_unverified_cod_idx on public.orders(created_at)
  where status = 'nouvelle' and paid = false and pay = 'cod' and cod_verified = false;
create index if not exists pack_items_product_idx on public.pack_items(product_id);
create index if not exists reviews_user_idx on public.reviews(user_id) where user_id is not null;
create index if not exists orders_courier_idx on public.orders(courier_id) where courier_id is not null;
create index if not exists orders_open_phone_idx on public.orders(phone) where status = 'nouvelle' and paid = false;

commit;
