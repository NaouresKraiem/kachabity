-- Multi-step writes as single database functions, so each runs in one transaction:
-- if any step fails (stock shortage, duplicate SKU, constraint, lost connection), nothing
-- is written. The API routes call these through supabase.rpc() with the service role.

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

-- Checkout: the order and its lines together. Amounts are computed (and checked) by the API.
create or replace function public.create_order(p_order jsonb, p_items jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  ord public.orders;
begin
  insert into public.orders (
    order_number, user_id, customer_email, customer_first_name, customer_last_name, customer_phone,
    shipping_address, shipping_city, shipping_state, shipping_zip, shipping_country,
    subtotal, shipping_cost, total, order_notes, status, payment_status
  ) values (
    p_order->>'order_number', nullif(p_order->>'user_id', '')::uuid, nullif(p_order->>'customer_email', ''),
    p_order->>'customer_first_name', p_order->>'customer_last_name', p_order->>'customer_phone',
    nullif(p_order->>'shipping_address', ''), nullif(p_order->>'shipping_city', ''), nullif(p_order->>'shipping_state', ''),
    nullif(p_order->>'shipping_zip', ''), nullif(p_order->>'shipping_country', ''),
    (p_order->>'subtotal')::numeric, (p_order->>'shipping_cost')::numeric, (p_order->>'total')::numeric,
    nullif(p_order->>'order_notes', ''), 'pending', 'pending'
  )
  returning * into ord;

  insert into public.order_items (
    order_id, product_id, variant_id, variant_label, product_name, product_name_ar, product_name_fr,
    product_image, quantity, price, subtotal
  )
  select ord.id, i.product_id, i.variant_id, i.variant_label, i.product_name, i.product_name_ar, i.product_name_fr,
         i.product_image, i.quantity, i.price, i.subtotal
    from jsonb_to_recordset(p_items) as i (
      product_id uuid, variant_id uuid, variant_label text, product_name text, product_name_ar text,
      product_name_fr text, product_image text, quantity integer, price numeric, subtotal numeric
    );

  return jsonb_build_object(
    'order', to_jsonb(ord),
    'items', coalesce((select jsonb_agg(to_jsonb(oi)) from public.order_items oi where oi.order_id = ord.id), '[]'::jsonb)
  );
end;
$$;

-- Status/payment/notes change plus the matching stock movement, together.
-- processing/shipped/delivered deduct the order's tracked items; pending/cancelled return them.
create or replace function public.set_order_status(p_order_id uuid, p_changes jsonb, p_actor uuid default null, p_actor_email text default null)
returns public.orders
language plpgsql
set search_path = ''
as $$
declare
  new_status text := nullif(p_changes->>'status', '');
  ord public.orders;
begin
  if new_status in ('processing', 'shipped', 'delivered') then
    perform public.apply_order_stock(p_order_id, 'deduct', p_actor, p_actor_email);
  elsif new_status in ('pending', 'cancelled') then
    perform public.apply_order_stock(p_order_id, 'restore', p_actor, p_actor_email);
  end if;

  update public.orders
     set status = coalesce(new_status, status),
         payment_status = case when p_changes ? 'payment_status' then p_changes->>'payment_status' else payment_status end,
         order_notes = case when p_changes ? 'order_notes' then nullif(p_changes->>'order_notes', '') else order_notes end,
         updated_at = now()
   where id = p_order_id
  returning * into ord;

  if not found then
    raise exception 'order_not_found';
  end if;
  return ord;
end;
$$;

-- Deletes orders (one or many) after returning any stock they took. All or nothing.
create or replace function public.delete_orders(p_order_ids uuid[], p_actor uuid default null, p_actor_email text default null)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_order_id uuid;
  deleted integer := 0;
begin
  foreach v_order_id in array p_order_ids loop
    if exists (select 1 from public.orders where id = v_order_id) then
      perform public.apply_order_stock(v_order_id, 'restore', p_actor, p_actor_email);
      delete from public.order_items where order_items.order_id = v_order_id;
      delete from public.orders where id = v_order_id;
      deleted := deleted + 1;
    end if;
  end loop;
  return deleted;
end;
$$;

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------

-- Creates (p_product_id null) or updates a product with its variants and images in one go.
--   p_product: product columns to set; only keys present are changed on update.
--   p_variants: null leaves variants alone. Otherwise the full list: each is matched to an
--     existing variant by id, then by color + size, and updated in place (ids carry stock);
--     unmatched ones are inserted, and existing variants not in the list are deleted, which
--     is refused while they hold stock (unless p_keep_stocked_variants). A variant's `images`
--     replace its photos. On create, a variant's `stock` is recorded as opening stock at the
--     online location and the product starts tracked.
--   p_images: null leaves product photos alone; otherwise replaces them (first is main).
--   p_replace_discount / p_discount: replace the product's discounts (used by the importer).
create or replace function public.save_product(
  p_product_id uuid,
  p_product jsonb,
  p_variants jsonb default null,
  p_images jsonb default null,
  p_replace_discount boolean default false,
  p_discount numeric default null,
  p_keep_stocked_variants boolean default false,
  p_actor uuid default null,
  p_actor_email text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_product_id uuid := p_product_id;
  creating boolean := p_product_id is null;
  v jsonb;
  v_variant_id uuid;
  claimed uuid[] := '{}';
  opening jsonb := '[]'::jsonb;
  stocked integer;
  online_location uuid;
begin
  if creating then
    insert into public.products (
      name, slug, description, name_ar, name_fr, description_ar, description_fr, category_id,
      base_price, status, code, supplier_id, collection_id, stock_tracked
    ) values (
      p_product->>'name', p_product->>'slug', nullif(p_product->>'description', ''),
      nullif(p_product->>'name_ar', ''), nullif(p_product->>'name_fr', ''),
      nullif(p_product->>'description_ar', ''), nullif(p_product->>'description_fr', ''),
      nullif(p_product->>'category_id', '')::uuid, coalesce(nullif(p_product->>'base_price', '')::numeric, 0),
      coalesce(nullif(p_product->>'status', ''), 'active'), nullif(trim(p_product->>'code'), ''),
      nullif(p_product->>'supplier_id', '')::uuid, nullif(p_product->>'collection_id', '')::uuid,
      coalesce((p_product->>'stock_tracked')::boolean, false)
    )
    returning id into v_product_id;
  else
    update public.products p
       set name = case when p_product ? 'name' then p_product->>'name' else p.name end,
           slug = case when p_product ? 'slug' then p_product->>'slug' else p.slug end,
           description = case when p_product ? 'description' then nullif(p_product->>'description', '') else p.description end,
           name_ar = case when p_product ? 'name_ar' then nullif(p_product->>'name_ar', '') else p.name_ar end,
           name_fr = case when p_product ? 'name_fr' then nullif(p_product->>'name_fr', '') else p.name_fr end,
           description_ar = case when p_product ? 'description_ar' then nullif(p_product->>'description_ar', '') else p.description_ar end,
           description_fr = case when p_product ? 'description_fr' then nullif(p_product->>'description_fr', '') else p.description_fr end,
           category_id = case when p_product ? 'category_id' then nullif(p_product->>'category_id', '')::uuid else p.category_id end,
           base_price = case when p_product ? 'base_price' then (p_product->>'base_price')::numeric else p.base_price end,
           status = case when p_product ? 'status' then p_product->>'status' else p.status end,
           code = case when p_product ? 'code' then nullif(trim(p_product->>'code'), '') else p.code end,
           supplier_id = case when p_product ? 'supplier_id' then nullif(p_product->>'supplier_id', '')::uuid else p.supplier_id end,
           collection_id = case when p_product ? 'collection_id' then nullif(p_product->>'collection_id', '')::uuid else p.collection_id end,
           stock_tracked = case when p_product ? 'stock_tracked' then (p_product->>'stock_tracked')::boolean else p.stock_tracked end,
           deleted_at = case when p_product ? 'restore' and (p_product->>'restore')::boolean then null else p.deleted_at end,
           updated_at = now()
     where p.id = v_product_id;
    if not found then
      raise exception 'product_not_found';
    end if;
  end if;

  if p_variants is not null then
    -- Variant photos are rewritten from the payload below.
    delete from public.product_images pi where pi.product_id = v_product_id and pi.variant_id is not null;

    for v in select * from jsonb_array_elements(p_variants) loop
      v_variant_id := null;
      if nullif(v->>'id', '') is not null then
        select pv.id into v_variant_id
          from public.product_variants pv
         where pv.id = (v->>'id')::uuid and pv.product_id = v_product_id and not (pv.id = any (claimed));
      end if;
      if v_variant_id is null then
        select pv.id into v_variant_id
          from public.product_variants pv
         where pv.product_id = v_product_id
           and pv.color_id is not distinct from nullif(v->>'color_id', '')::uuid
           and pv.size_id is not distinct from nullif(v->>'size_id', '')::uuid
           and not (pv.id = any (claimed))
         order by pv.deleted_at nulls first
         limit 1;
      end if;

      if v_variant_id is null then
        insert into public.product_variants (product_id, color_id, size_id, sku, price, is_available, reorder_point)
        values (
          v_product_id, nullif(v->>'color_id', '')::uuid, nullif(v->>'size_id', '')::uuid,
          nullif(trim(v->>'sku'), ''), nullif(v->>'price', '')::numeric,
          coalesce((v->>'is_available')::boolean, true), coalesce(nullif(v->>'reorder_point', '')::integer, 5)
        )
        returning id into v_variant_id;
        if creating and coalesce(nullif(v->>'stock', '')::integer, 0) > 0 then
          opening := opening || jsonb_build_object('variant_id', v_variant_id, 'quantity', (v->>'stock')::integer);
        end if;
      else
        update public.product_variants pv
           set color_id = nullif(v->>'color_id', '')::uuid,
               size_id = nullif(v->>'size_id', '')::uuid,
               sku = coalesce(nullif(trim(v->>'sku'), ''), pv.sku),
               price = nullif(v->>'price', '')::numeric,
               is_available = coalesce((v->>'is_available')::boolean, true),
               reorder_point = coalesce(nullif(v->>'reorder_point', '')::integer, pv.reorder_point),
               deleted_at = null,
               updated_at = now()
         where pv.id = v_variant_id;
      end if;
      claimed := claimed || v_variant_id;

      if jsonb_typeof(v->'images') = 'array' then
        insert into public.product_images (product_id, variant_id, image_url, alt_text, is_main, position)
        select v_product_id, v_variant_id,
               coalesce(img->>'url', img #>> '{}'), img->>'alt',
               ord = 1 or coalesce((img->>'is_main')::boolean, false),
               coalesce(nullif(img->>'position', '')::integer, (ord - 1)::integer)
          from jsonb_array_elements(v->'images') with ordinality as t (img, ord)
         where coalesce(img->>'url', img #>> '{}') is not null;
      end if;
    end loop;

    -- Variants left out of the list are removed, but never while they hold stock.
    select count(*) into stocked
      from public.product_variants pv
     where pv.product_id = v_product_id and not (pv.id = any (claimed))
       and exists (select 1 from public.inventory_levels l where l.variant_id = pv.id and l.available > 0);
    if stocked > 0 and not p_keep_stocked_variants then
      raise exception 'variants_with_stock:%', stocked using errcode = 'P0001';
    end if;
    delete from public.product_variants pv
     where pv.product_id = v_product_id and not (pv.id = any (claimed))
       and not exists (select 1 from public.inventory_levels l where l.variant_id = pv.id and l.available > 0);
  end if;

  if p_images is not null then
    delete from public.product_images pi where pi.product_id = v_product_id and pi.variant_id is null;
    insert into public.product_images (product_id, variant_id, image_url, alt_text, is_main, position)
    select v_product_id, null,
           coalesce(img->>'url', img #>> '{}'), img->>'alt',
           ord = 1 or coalesce((img->>'is_main')::boolean, false),
           coalesce(nullif(img->>'position', '')::integer, (ord - 1)::integer)
      from jsonb_array_elements(p_images) with ordinality as t (img, ord)
     where coalesce(img->>'url', img #>> '{}') is not null;
  end if;

  if jsonb_array_length(opening) > 0 then
    select id into online_location from public.locations where sells_online;
    if online_location is not null then
      insert into public.stock_movements (variant_id, location_id, type, quantity, reference, created_by, created_by_email)
      select (o->>'variant_id')::uuid, online_location, 'restock', (o->>'quantity')::integer, 'Opening stock', p_actor, p_actor_email
        from jsonb_array_elements(opening) as o;
      update public.products p set stock_tracked = true where p.id = v_product_id;
    end if;
  end if;

  if p_replace_discount then
    delete from public.product_discounts d where d.product_id = v_product_id;
    if p_discount is not null and p_discount > 0 then
      insert into public.product_discounts (product_id, discount_percent, active) values (v_product_id, p_discount, true);
    end if;
  end if;

  return v_product_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Stock
-- ---------------------------------------------------------------------------

-- Records stock movements in one transaction.
--   p_type: restock | return (add), sale (remove), adjustment (signed), transfer (from
--     p_location_id to p_to_location_id), or count (set the counted quantity; the difference
--     is recorded as an adjustment). Items may carry their own location_id (count across
--     several locations at once).
--   p_track: also switch on website tracking for the items' products.
create or replace function public.record_stock_movements(
  p_type text,
  p_location_id uuid,
  p_items jsonb,
  p_to_location_id uuid default null,
  p_reference text default '',
  p_note text default '',
  p_track boolean default false,
  p_actor uuid default null,
  p_actor_email text default null
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  item jsonb;
  item_location uuid;
  qty integer;
  current_qty integer;
  delta integer;
  recorded integer := 0;
  v_ref text := coalesce(p_reference, '');
  v_note text := coalesce(p_note, '');
begin
  if p_type not in ('restock', 'return', 'sale', 'adjustment', 'transfer', 'count') then
    raise exception 'invalid_movement_type';
  end if;
  if p_type = 'transfer' and (p_to_location_id is null or p_to_location_id = p_location_id) then
    raise exception 'invalid_transfer';
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    qty := (item->>'quantity')::integer;
    item_location := coalesce(nullif(item->>'location_id', '')::uuid, p_location_id);

    if p_type = 'count' then
      if qty < 0 then
        raise exception 'negative_count';
      end if;
      -- Lock the level while counting so a concurrent sale can't slip in between.
      select l.available into current_qty
        from public.inventory_levels l
       where l.variant_id = (item->>'variant_id')::uuid and l.location_id = item_location
       for update;
      delta := qty - coalesce(current_qty, 0);
      if delta <> 0 then
        insert into public.stock_movements (variant_id, location_id, type, quantity, reference, note, created_by, created_by_email)
        values ((item->>'variant_id')::uuid, item_location, 'adjustment', delta, coalesce(nullif(v_ref, ''), 'Stock count'), v_note, p_actor, p_actor_email);
        recorded := recorded + 1;
      end if;
    elsif p_type = 'transfer' then
      qty := abs(qty);
      if qty > 0 then
        insert into public.stock_movements (variant_id, location_id, type, quantity, reference, note, created_by, created_by_email)
        values ((item->>'variant_id')::uuid, item_location, 'transfer', -qty, v_ref, v_note, p_actor, p_actor_email),
               ((item->>'variant_id')::uuid, p_to_location_id, 'transfer', qty, v_ref, v_note, p_actor, p_actor_email);
        recorded := recorded + 2;
      end if;
    else
      qty := case p_type when 'sale' then -abs(qty) when 'adjustment' then qty else abs(qty) end;
      if qty <> 0 then
        insert into public.stock_movements (variant_id, location_id, type, quantity, reference, note, created_by, created_by_email)
        values ((item->>'variant_id')::uuid, item_location, p_type::public.stock_movement_type, qty, v_ref, v_note, p_actor, p_actor_email);
        recorded := recorded + 1;
      end if;
    end if;
  end loop;

  if p_track then
    update public.products p
       set stock_tracked = true
     where not p.stock_tracked
       and p.id in (select pv.product_id from public.product_variants pv
                     where pv.id in (select (i->>'variant_id')::uuid from jsonb_array_elements(p_items) as i));
  end if;

  return recorded;
end;
$$;

revoke all on function public.create_order(jsonb, jsonb),
  public.set_order_status(uuid, jsonb, uuid, text),
  public.delete_orders(uuid[], uuid, text),
  public.save_product(uuid, jsonb, jsonb, jsonb, boolean, numeric, boolean, uuid, text),
  public.record_stock_movements(text, uuid, jsonb, uuid, text, text, boolean, uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_order(jsonb, jsonb),
  public.set_order_status(uuid, jsonb, uuid, text),
  public.delete_orders(uuid[], uuid, text),
  public.save_product(uuid, jsonb, jsonb, jsonb, boolean, numeric, boolean, uuid, text),
  public.record_stock_movements(text, uuid, jsonb, uuid, text, text, boolean, uuid, text)
  to service_role;
