-- Waxo 0008_down (PROPOSITION Tariq) : retour exact à l'état 0001. Perd uniquement le snapshot order_item_components.
begin;
drop function if exists public.expire_stale_orders(int, int);
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
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
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
drop index if exists public.order_items_product_idx;
drop index if exists public.order_items_pack_idx;
drop index if exists public.orders_unverified_cod_idx;
drop index if exists public.pack_items_product_idx;
drop index if exists public.reviews_user_idx;
drop index if exists public.orders_courier_idx;
drop index if exists public.orders_open_phone_idx;
drop table if exists public.order_item_components;
commit;
