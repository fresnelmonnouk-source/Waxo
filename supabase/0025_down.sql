-- Waxo 0025_down (proposition Tariq, 2026-10-14) : retour à l'état d'avant 0025. NE PAS exécuter sauf incident.
-- ORDRE IMPÉRATIF : place_order de 0015 restaurée AVANT toute suppression de colonne, sinon toute commande échoue (42703).
-- Étape 1 (sûre, réversible en rejouant 0025) : place_order d'avant 0025 + case « livraison offerte » décochée partout
-- (le site n'annonce plus de gratuité que la base ne ferait plus). Les rubriques saisies sont CONSERVÉES.
-- Étape 2 (facultative, DESTRUCTIVE) : en bas, commentée. Exporter d'abord les rubriques (Table editor → Export CSV).
set lock_timeout = '5s'; -- ne jamais rester bloqué derrière une transaction longue (la boutique attendrait aussi)
begin;

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

update public.products set free_shipping = false where free_shipping;

commit;

-- Étape 2 — DESTRUCTIVE (efface les rubriques saisies). Seulement après export, et après retour au code d'avant 0025.
-- alter table public.products drop column if exists free_shipping;
-- alter table public.product_translations
--   drop column if exists color, drop column if exists materials, drop column if exists specs,
--   drop column if exists highlights, drop column if exists uses, drop column if exists care;
