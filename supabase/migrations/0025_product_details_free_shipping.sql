-- 0025_product_details_free_shipping.sql — Fiche produit détaillée + livraison offerte par produit (décisions Fresnel
-- 2026-10-13). Dans l'éditeur SQL Supabase, après 0015 ; indépendante de 0024 (ordre libre). Retour arrière : supabase/0025_down.sql.
--
-- 1) Six rubriques FACULTATIVES par langue (product_translations) : couleur, matériaux, caractéristiques techniques, points
--    forts, utilisations possibles, conseils d'utilisation et d'entretien. Vide = rubrique ET titre absents de la fiche.
--    Une ligne = un élément (les listes sont découpées à l'affichage). Texte brut, jamais interprété comme du HTML.
-- 2) `products.free_shipping` : case « Livraison gratuite à Cotonou & Calavi ». La livraison est offerte dans la zone
--    Cotonou & Calavi seulement si TOUT le panier est coché (un pack compte comme coché si tous ses produits le sont).
--    Sinon, règle habituelle (tarif de zone, franco dès `shipping.freeFrom`). Hors Cotonou & Calavi : inchangé.
--    Les frais restent calculés PAR LA BASE (place_order) : l'affichage du site n'est qu'une estimation.
--
-- Compatibilité : colonnes avec valeur par défaut (''/false) → le code déjà déployé continue de fonctionner, et le nouveau
-- code relit sans ces colonnes tant que 0025 n'est pas appliquée. RLS inchangée (les colonnes suivent leur table).
-- Rejouable : add column if not exists / create or replace.

alter table public.product_translations
  add column if not exists color      text not null default '' check (length(color) <= 200),
  add column if not exists materials  text not null default '' check (length(materials) <= 200),
  add column if not exists specs      text not null default '' check (length(specs) <= 3000),
  add column if not exists highlights text not null default '' check (length(highlights) <= 3000),
  add column if not exists uses       text not null default '' check (length(uses) <= 3000),
  add column if not exists care       text not null default '' check (length(care) <= 3000);

alter table public.products add column if not exists free_shipping boolean not null default false;

-- place_order : identique à 0015, sauf les lignes marquées « 0025 » (livraison offerte par produit).
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
  v_free_line boolean; v_all_free boolean := true; -- 0025 : toutes les lignes en « livraison offerte » ?
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
      select p.price, t.name, p.free_shipping into v_price, v_name, v_free_line -- 0025
      from public.products p join public.product_translations t on t.product_id = p.id and t.locale = 'fr'
      where p.id = l.id and p.active;
      if not found then raise exception 'product_unavailable'; end if;
      if not v_free_line then v_all_free := false; end if; -- 0025
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
      -- 0025 : un pack est « livraison offerte » seulement si TOUS ses produits le sont.
      if exists (select 1 from public.pack_items pi join public.products p on p.id = pi.product_id
                 where pi.pack_id = l.id and not p.free_shipping) then v_all_free := false; end if;
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
  v_fee := case when p_zone = 'cotonou' and v_all_free then 0 -- 0025 : tout le panier en livraison offerte
                when p_zone = 'cotonou' and v_free > 0 and v_sub >= v_free then 0
                when p_zone = 'cotonou' then coalesce((v_ship ->> 'cotonou')::int, 0)
                else coalesce((v_ship ->> 'autre')::int, 0) end;

  update public.orders set subtotal = v_sub, shipping_fee = v_fee, total = v_sub + v_fee where id = v_ord;
  return query select v_ord, v_num, v_sub, v_fee, v_sub + v_fee;
end $$;

revoke execute on function public.place_order(jsonb, jsonb, text, text, uuid) from public, anon, authenticated;
grant execute on function public.place_order(jsonb, jsonb, text, text, uuid) to service_role;
