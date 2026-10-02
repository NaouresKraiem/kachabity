-- 1. No hard deletes: rows are marked with deleted_at (plus status/active where the table
--    has one) instead of being removed. A trigger refuses DELETE on business tables, so a
--    stray .delete() or a dashboard click fails loudly instead of losing data.
-- 2. landing_products: the products the admin picks (and orders) for the home page.

-- ---------------------------------------------------------------------------
-- Soft-delete columns
-- ---------------------------------------------------------------------------

alter table public.product_images add column deleted_at timestamptz;
alter table public.product_discounts add column deleted_at timestamptz;
alter table public.promotions add column deleted_at timestamptz;
alter table public.reels add column deleted_at timestamptz;
alter table public.hero_sections add column deleted_at timestamptz;
alter table public.small_cards add column deleted_at timestamptz;
alter table public.orders add column deleted_at timestamptz;
alter table public.user_favorites add column deleted_at timestamptz;
alter table public.locations add column deleted_at timestamptz;
alter table public.suppliers add column deleted_at timestamptz;
alter table public.collections add column deleted_at timestamptz;
alter table public.product_costs add column deleted_at timestamptz;

-- A deleted supplier/collection/location must not block re-creating one with the same name.
alter table public.locations drop constraint locations_name_key;
alter table public.suppliers drop constraint suppliers_name_key;
alter table public.collections drop constraint collections_name_key;
create unique index locations_name_live_idx on public.locations (name) where deleted_at is null;
create unique index suppliers_name_live_idx on public.suppliers (name) where deleted_at is null;
create unique index collections_name_live_idx on public.collections (name) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Public reads hide deleted rows
-- ---------------------------------------------------------------------------

drop policy "Public can read product images" on public.product_images;
create policy "Public can read live product images" on public.product_images
  for select to anon, authenticated using (deleted_at is null);

drop policy "Public can read active discounts" on public.product_discounts;
create policy "Public can read active discounts" on public.product_discounts
  for select to anon, authenticated using (active and deleted_at is null);

drop policy "Public can read active sale banners" on public.promotions;
create policy "Public can read active sale banners" on public.promotions
  for select to anon, authenticated using (active and deleted_at is null);

drop policy "Public can read active reels" on public.reels;
create policy "Public can read active reels" on public.reels
  for select to anon, authenticated using (active and deleted_at is null);

drop policy "Public can read active hero sections" on public.hero_sections;
create policy "Public can read active hero sections" on public.hero_sections
  for select to anon, authenticated using (is_active and deleted_at is null);

drop policy "Public can read active small cards" on public.small_cards;
create policy "Public can read active small cards" on public.small_cards
  for select to anon, authenticated using (is_active and deleted_at is null);

drop policy "Users can read their orders" on public.orders;
create policy "Users can read their orders" on public.orders
  for select to authenticated using (user_id = (select auth.uid()) and deleted_at is null);

drop policy "Users can read their order items" on public.order_items;
create policy "Users can read their order items" on public.order_items
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = (select auth.uid()) and o.deleted_at is null
    )
  );

-- Favorites: removing one sets deleted_at; adding it again upserts deleted_at back to null.
-- The select policy keeps the owner's deleted rows visible so that upsert can find them;
-- lib/favorites.ts filters them out.
drop policy "Users can remove their favorites" on public.user_favorites;
create policy "Users can update their favorites" on public.user_favorites
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke delete on public.user_favorites from authenticated;
grant update (user_id, product_id, deleted_at) on public.user_favorites to authenticated;

-- ---------------------------------------------------------------------------
-- Functions: soft deletes instead of DELETE
-- ---------------------------------------------------------------------------

-- "Deletes" orders (one or many): returns any stock they took, then marks them cancelled
-- and deleted. Order lines stay attached. All or nothing.
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
    if exists (select 1 from public.orders where id = v_order_id and deleted_at is null) then
      perform public.apply_order_stock(v_order_id, 'restore', p_actor, p_actor_email);
      update public.orders
         set status = 'cancelled', deleted_at = now(), updated_at = now()
       where id = v_order_id;
      deleted := deleted + 1;
    end if;
  end loop;
  return deleted;
end;
$$;

-- Same as before, except replaced photos, removed variants and replaced discounts are
-- marked deleted instead of being removed.
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
    -- Variant photos are rewritten from the payload below (the old rows are kept, marked deleted).
    update public.product_images pi set deleted_at = now()
     where pi.product_id = v_product_id and pi.variant_id is not null and pi.deleted_at is null;

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
     where pv.product_id = v_product_id and not (pv.id = any (claimed)) and pv.deleted_at is null
       and exists (select 1 from public.inventory_levels l where l.variant_id = pv.id and l.available > 0);
    if stocked > 0 and not p_keep_stocked_variants then
      raise exception 'variants_with_stock:%', stocked using errcode = 'P0001';
    end if;
    update public.product_variants pv
       set deleted_at = now(), is_available = false
     where pv.product_id = v_product_id and not (pv.id = any (claimed)) and pv.deleted_at is null
       and not exists (select 1 from public.inventory_levels l where l.variant_id = pv.id and l.available > 0);
  end if;

  if p_images is not null then
    update public.product_images pi set deleted_at = now()
     where pi.product_id = v_product_id and pi.variant_id is null and pi.deleted_at is null;
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
    update public.product_discounts d set deleted_at = now(), active = false
     where d.product_id = v_product_id and d.deleted_at is null;
    if p_discount is not null and p_discount > 0 then
      insert into public.product_discounts (product_id, discount_percent, active) values (v_product_id, p_discount, true);
    end if;
  end if;

  return v_product_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Landing page picks
-- ---------------------------------------------------------------------------

-- section: new_arrivals (pinned first, newest products fill the rest), showcase (the
-- header pieces), ring (extra pieces of the 3D ring, after the showcase ones).
create table public.landing_products (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('new_arrivals', 'showcase', 'ring')),
  product_id uuid not null references public.products (id),
  position integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index landing_products_section_product_live_idx
  on public.landing_products (section, product_id) where deleted_at is null;
create index landing_products_section_position_idx
  on public.landing_products (section, position) where deleted_at is null;
create index landing_products_product_id_idx on public.landing_products (product_id);
create index landing_products_created_by_idx on public.landing_products (created_by);

create trigger set_updated_at before update on public.landing_products
  for each row execute function private.set_updated_at();

alter table public.landing_products enable row level security;
create policy "Public can read live landing picks" on public.landing_products
  for select to anon, authenticated using (deleted_at is null);
grant select on public.landing_products to anon, authenticated;
grant all on public.landing_products to service_role;

-- Replaces a section's picks with p_product_ids, in that order. Picks left out are marked deleted.
create or replace function public.set_landing_products(p_section text, p_product_ids uuid[], p_actor uuid default null)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  ids uuid[] := coalesce(p_product_ids, '{}');
  i integer;
begin
  if p_section not in ('new_arrivals', 'showcase', 'ring') then
    raise exception 'invalid_section';
  end if;

  update public.landing_products lp
     set deleted_at = now()
   where lp.section = p_section and lp.deleted_at is null and not (lp.product_id = any (ids));

  for i in 1 .. coalesce(array_length(ids, 1), 0) loop
    update public.landing_products lp
       set position = i - 1
     where lp.section = p_section and lp.product_id = ids[i] and lp.deleted_at is null;
    if not found then
      insert into public.landing_products (section, product_id, position, created_by)
      values (p_section, ids[i], i - 1, p_actor);
    end if;
  end loop;

  return coalesce(array_length(ids, 1), 0);
end;
$$;

revoke all on function public.set_landing_products(text, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.set_landing_products(text, uuid[], uuid) to service_role;

-- Start from what the home page showed until now (the hard-coded slugs).
insert into public.landing_products (section, product_id, position)
select 'showcase', p.id, s.ord - 1
  from unnest(array[
    'kachabia-laine-zemnia-homme-224', 'dengri-tunisien-homme-240', 'blouza-djerbienne-homme-690'
  ]) with ordinality as s (slug, ord)
  join public.products p on p.slug = s.slug and p.deleted_at is null;

insert into public.landing_products (section, product_id, position)
select 'ring', p.id, s.ord - 1
  from unnest(array[
    'kachabia-wazra-tibar-7018', 'kachabia-ennour-3742', 'dengri-du-marie-5849',
    'kachabia-poil-de-chameau-1853', 'burnous-tunisien-laine-232', 'kachabia-cachemire-3226',
    'kachabia-zemnia-rayee-4952', 'kachabia-mlef-bouc-2638', 'dengri-tunisien-simple-6583',
    'kachabia-chakhma-pro-max-2-7066', 'kachabia-zemnia-demi-homme-241'
  ]) with ordinality as s (slug, ord)
  join public.products p on p.slug = s.slug and p.deleted_at is null;

insert into public.site_settings (setting_key, setting_value, setting_type, description) values
  ('landing_new_arrivals_count', '10', 'number', 'How many products the home page New arrivals section shows'),
  ('landing_new_arrivals_autofill', 'true', 'boolean', 'Fill New arrivals with the newest products after the pinned ones')
on conflict (setting_key) do nothing;

-- ---------------------------------------------------------------------------
-- Guard: no hard deletes
-- ---------------------------------------------------------------------------

create or replace function private.prevent_hard_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'hard_delete_not_allowed: set deleted_at on %.% instead', tg_table_schema, tg_table_name
    using errcode = 'P0001';
end;
$$;

-- Not guarded: users, user_favorites, carts and cart_items, which are removed by cascade
-- when Supabase Auth deletes an account; and inventory_levels, maintained by the stock trigger.
do $$
declare
  t text;
begin
  foreach t in array array[
    'categories', 'products', 'colors', 'sizes', 'product_variants', 'product_images',
    'product_discounts', 'promotions', 'reels', 'hero_sections', 'small_cards', 'reviews',
    'orders', 'order_items', 'newsletter_subscribers', 'site_settings', 'shipping_rates',
    'country_tax_rates', 'locations', 'suppliers', 'collections', 'product_costs',
    'stock_movements', 'landing_products'
  ]
  loop
    execute format(
      'create trigger prevent_hard_delete before delete on public.%I
         for each row execute function private.prevent_hard_delete()', t);
  end loop;
end;
$$;
