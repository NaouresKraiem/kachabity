-- Stock management, merged from the separate kachabiti-stock-management app.
--
-- Model:
--   * Stock lives per variant × location in inventory_levels.
--   * Stock is never written directly: insert a stock_movements row and the
--     apply_stock_movement trigger updates inventory_levels (available can't go below 0).
--   * The location with sells_online = true feeds product_variants.stock, which the
--     storefront reads. Products with stock_tracked = false stay orderable regardless
--     (stock not counted yet) and their confirmed orders don't deduct stock.
--   * Online orders deduct stock when confirmed (public.apply_order_stock, called by
--     the admin orders API) and get it back when cancelled.
--   * All tables are service-role only (admin API); RLS is on with no policies.

-- ---------------------------------------------------------------------------
-- Setup tables
-- ---------------------------------------------------------------------------

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  sells_online boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one location feeds the online shop.
create unique index locations_single_online_idx on public.locations (sells_online) where sells_online;

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Product and variant fields
-- ---------------------------------------------------------------------------

create sequence public.product_code_seq;

alter table public.products
  add column code text unique,
  add column supplier_id uuid references public.suppliers (id) on delete set null,
  add column collection_id uuid references public.collections (id) on delete set null,
  add column stock_tracked boolean not null default false;

create index products_supplier_id_idx on public.products (supplier_id);
create index products_collection_id_idx on public.products (collection_id);

-- Purchase cost: admin only (served by the admin API, never exposed to the storefront).
create table public.product_costs (
  product_id uuid primary key references public.products (id) on delete cascade,
  cost numeric(10, 2) not null check (cost >= 0),
  updated_at timestamptz not null default now()
);

alter table public.product_variants
  add column reorder_point integer not null default 5 check (reorder_point >= 0);

-- ---------------------------------------------------------------------------
-- Inventory and movements
-- ---------------------------------------------------------------------------

create table public.inventory_levels (
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  available integer not null default 0 check (available >= 0),
  updated_at timestamptz not null default now(),
  primary key (variant_id, location_id)
);

create index inventory_levels_location_id_idx on public.inventory_levels (location_id);

create type public.stock_movement_type as enum ('sale', 'restock', 'adjustment', 'return', 'transfer');

alter table public.orders
  add column stock_deducted boolean not null default false;

-- Size/color the customer picked (previously not recorded).
alter table public.order_items
  add column variant_id uuid references public.product_variants (id) on delete set null,
  add column variant_label text;

create index order_items_variant_id_idx on public.order_items (variant_id);

-- Append-only log. sku/product_name are snapshots so history survives variant deletion.
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid references public.product_variants (id) on delete set null,
  sku text not null default '',
  product_name text not null default '',
  location_id uuid not null references public.locations (id),
  type public.stock_movement_type not null,
  quantity integer not null check (quantity <> 0),
  reference text not null default '',
  note text not null default '',
  order_id uuid references public.orders (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_by_email text,
  created_at timestamptz not null default now(),
  constraint stock_movements_direction check (
    (type in ('restock', 'return') and quantity > 0)
    or (type = 'sale' and quantity < 0)
    or type in ('adjustment', 'transfer')
  )
);

create index stock_movements_created_at_idx on public.stock_movements (created_at desc);
create index stock_movements_variant_id_idx on public.stock_movements (variant_id);
create index stock_movements_location_id_idx on public.stock_movements (location_id);
create index stock_movements_order_id_idx on public.stock_movements (order_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function private.apply_stock_movement()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_available integer;
  online boolean;
begin
  if new.variant_id is null then
    raise exception 'variant_id is required';
  end if;

  select v.sku, p.name
    into new.sku, new.product_name
    from public.product_variants v
    join public.products p on p.id = v.product_id
   where v.id = new.variant_id;

  insert into public.inventory_levels (variant_id, location_id)
  values (new.variant_id, new.location_id)
  on conflict (variant_id, location_id) do nothing;

  select available into current_available
    from public.inventory_levels
   where variant_id = new.variant_id and location_id = new.location_id
   for update;

  if current_available + new.quantity < 0 then
    -- Parsed by the admin API into a readable message.
    raise exception 'insufficient_stock:%:%', coalesce(nullif(new.sku, ''), new.variant_id::text), current_available
      using errcode = 'P0001';
  end if;

  update public.inventory_levels
     set available = current_available + new.quantity,
         updated_at = now()
   where variant_id = new.variant_id and location_id = new.location_id;

  select sells_online into online from public.locations where id = new.location_id;
  if online then
    update public.product_variants
       set stock = current_available + new.quantity
     where id = new.variant_id;
  end if;

  return new;
end;
$$;

create trigger stock_movements_apply
  before insert on public.stock_movements
  for each row execute function private.apply_stock_movement();

-- product_variants.stock mirrors the online location for tracked products.
-- Untracked products keep their old value (the storefront ignores it for them).
create or replace function private.sync_online_stock(product_ids uuid[] default null)
returns void
language sql
set search_path = ''
as $$
  update public.product_variants v
     set stock = coalesce((
       select il.available
         from public.inventory_levels il
         join public.locations l on l.id = il.location_id and l.sells_online
        where il.variant_id = v.id
     ), 0)
    from public.products p
   where p.id = v.product_id
     and p.stock_tracked
     and (product_ids is null or v.product_id = any (product_ids));
$$;

-- When a product starts being tracked, show its real online stock.
create or replace function private.on_product_tracking_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stock_tracked and not old.stock_tracked then
    perform private.sync_online_stock(array[new.id]);
  end if;
  return new;
end;
$$;

create trigger products_tracking_change
  after update of stock_tracked on public.products
  for each row execute function private.on_product_tracking_change();

-- Switching which location sells online re-syncs every variant.
create or replace function private.on_online_location_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform private.sync_online_stock(null);
  return null;
end;
$$;

create trigger locations_online_change
  after insert or update of sells_online or delete on public.locations
  for each statement execute function private.on_online_location_change();

-- Product codes (e.g. KAC-012) when none is given; prefix from the category slug.
create or replace function private.set_product_code()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  prefix text;
begin
  if new.code is null or new.code = '' then
    select upper(left(regexp_replace(coalesce(c.slug, ''), '[^a-zA-Z]', '', 'g'), 3))
      into prefix
      from public.categories c
     where c.id = new.category_id;
    new.code := coalesce(nullif(prefix, ''), 'PRD') || '-' || lpad(nextval('public.product_code_seq')::text, 3, '0');
  end if;
  return new;
end;
$$;

create trigger products_set_code
  before insert on public.products
  for each row execute function private.set_product_code();

-- Variant SKUs (CODE-COLOR-SIZE) when none is given.
create or replace function private.variant_sku(p_variant public.product_variants)
returns text
language plpgsql
set search_path = ''
as $$
declare
  base text;
  candidate text;
begin
  select concat_ws('-',
           p.code,
           nullif(upper(left(regexp_replace(coalesce(c.name, ''), '[^a-zA-Z0-9]', '', 'g'), 6)), ''),
           nullif(upper(regexp_replace(coalesce(s.name, ''), '[^a-zA-Z0-9]', '', 'g')), ''))
    into base
    from public.products p
    left join public.colors c on c.id = p_variant.color_id
    left join public.sizes s on s.id = p_variant.size_id
   where p.id = p_variant.product_id;

  candidate := coalesce(nullif(base, ''), 'SKU');
  if exists (select 1 from public.product_variants where sku = candidate and id <> p_variant.id) then
    candidate := candidate || '-' || left(replace(p_variant.id::text, '-', ''), 4);
  end if;
  return upper(candidate);
end;
$$;

create or replace function private.set_variant_sku()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sku is null or trim(new.sku) = '' then
    new.sku := private.variant_sku(new);
  end if;
  return new;
end;
$$;

create trigger product_variants_set_sku
  before insert on public.product_variants
  for each row execute function private.set_variant_sku();

do $$
declare
  t text;
begin
  foreach t in array array['locations', 'suppliers', 'product_costs'] loop
    execute format('create trigger set_updated_at before update on public.%I
                      for each row execute function private.set_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Orders ↔ stock
-- ---------------------------------------------------------------------------

-- p_direction 'deduct': record a sale per tracked item from the online location.
-- p_direction 'restore': return what this order deducted. Idempotent via orders.stock_deducted.
-- Runs as one transaction, so a shortage on any line rolls the whole thing back.
create or replace function public.apply_order_stock(p_order_id uuid, p_direction text, p_actor uuid default null, p_actor_email text default null)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  ord public.orders;
  online_location uuid;
  lines integer := 0;
  item record;
begin
  select * into ord from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  if p_direction = 'deduct' then
    if ord.stock_deducted then return 0; end if;
    select id into online_location from public.locations where sells_online;
    if online_location is null then
      raise exception 'no_online_location';
    end if;
    for item in
      select oi.variant_id, oi.quantity
        from public.order_items oi
        join public.product_variants v on v.id = oi.variant_id
        join public.products p on p.id = v.product_id
       where oi.order_id = p_order_id and p.stock_tracked
    loop
      insert into public.stock_movements (variant_id, location_id, type, quantity, reference, order_id, created_by, created_by_email)
      values (item.variant_id, online_location, 'sale', -item.quantity, ord.order_number, p_order_id, p_actor, p_actor_email);
      lines := lines + 1;
    end loop;
    update public.orders set stock_deducted = true where id = p_order_id;
  elsif p_direction = 'restore' then
    if not ord.stock_deducted then return 0; end if;
    for item in
      select variant_id, location_id, sum(-quantity)::integer as qty
        from public.stock_movements
       where order_id = p_order_id and variant_id is not null
       group by variant_id, location_id
      having sum(-quantity) > 0
    loop
      insert into public.stock_movements (variant_id, location_id, type, quantity, reference, order_id, created_by, created_by_email)
      values (item.variant_id, item.location_id, 'return', item.qty, ord.order_number, p_order_id, p_actor, p_actor_email);
      lines := lines + 1;
    end loop;
    update public.orders set stock_deducted = false where id = p_order_id;
  else
    raise exception 'invalid_direction';
  end if;

  return lines;
end;
$$;

revoke all on function public.apply_order_stock(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.apply_order_stock(uuid, text, uuid, text) to service_role;

-- Daily movement totals for the dashboard chart (last 30 days).
create view public.daily_movement_stats with (security_invoker = true) as
select
  d.day::date as day,
  coalesce(sum(-m.quantity) filter (where m.type = 'sale'), 0)::integer as sales,
  coalesce(sum(m.quantity) filter (where m.type = 'restock'), 0)::integer as restocks,
  coalesce(sum(m.quantity) filter (where m.type = 'return'), 0)::integer as returns,
  coalesce(sum(abs(m.quantity)) filter (where m.type in ('adjustment', 'transfer')), 0)::integer as adjustments
from generate_series(current_date - 29, current_date, interval '1 day') as d (day)
left join public.stock_movements m on m.created_at::date = d.day::date
group by d.day
order by d.day;

-- ---------------------------------------------------------------------------
-- Security: service role only
-- ---------------------------------------------------------------------------

alter table public.locations enable row level security;
alter table public.suppliers enable row level security;
alter table public.collections enable row level security;
alter table public.product_costs enable row level security;
alter table public.inventory_levels enable row level security;
alter table public.stock_movements enable row level security;

revoke all on public.locations, public.suppliers, public.collections, public.product_costs,
  public.inventory_levels, public.stock_movements, public.daily_movement_stats from anon, authenticated;
grant all on public.locations, public.suppliers, public.collections, public.product_costs,
  public.inventory_levels, public.stock_movements, public.daily_movement_stats to service_role;
grant usage, select on sequence public.product_code_seq to service_role;

revoke all on function private.apply_stock_movement() from public, anon, authenticated;
revoke all on function private.sync_online_stock(uuid[]) from public, anon, authenticated;
revoke all on function private.variant_sku(public.product_variants) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------

insert into public.locations (name, sells_online) values
  ('Main warehouse', true),
  ('Kachabiti monastir', false);

-- Product codes for existing products, oldest first.
update public.products p
   set code = sub.code
  from (
    select p2.id,
           coalesce(nullif(upper(left(regexp_replace(coalesce(c.slug, ''), '[^a-zA-Z]', '', 'g'), 3)), ''), 'PRD')
             || '-' || lpad(nextval('public.product_code_seq')::text, 3, '0') as code
      from public.products p2
      left join public.categories c on c.id = p2.category_id
     where p2.code is null
     order by p2.created_at
  ) sub
 where p.id = sub.id;

-- SKUs for existing variants (one at a time so collision checks see earlier ones).
do $$
declare
  v public.product_variants;
begin
  for v in select * from public.product_variants where sku is null or trim(sku) = '' order by created_at loop
    update public.product_variants set sku = private.variant_sku(v) where id = v.id;
  end loop;
end;
$$;
