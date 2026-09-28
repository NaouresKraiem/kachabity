-- Rebuild of the storefront schema for the new Supabase project.
--
-- Derived from what the application code reads and writes (the scripts/ folder
-- was incomplete and contradictory). Access model:
--   * Catalog and content tables: public read of live rows only.
--   * All catalog/admin writes go through app/api/* with the service-role key,
--     behind the admin gate in middleware.ts, so there are no write policies.
--   * Customers: may insert reviews, manage their own favorites, read their own orders.
--   * Orders are created server-side (POST /api/orders) with the service-role key.

create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_ar text,
  name_fr text,
  slug text not null unique,
  description text,
  image_url text,
  sort_order integer not null default 0,
  is_featured boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_ar text,
  name_fr text,
  slug text not null unique,
  description text,
  description_ar text,
  description_fr text,
  category_id uuid references public.categories (id) on delete set null,
  base_price numeric(10, 2) not null default 0 check (base_price >= 0),
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  sold_count integer not null default 0 check (sold_count >= 0),
  product_details text[],
  weight numeric(10, 2),
  shipping_info text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_id_idx on public.products (category_id);
create index products_live_created_at_idx on public.products (created_at desc)
  where deleted_at is null and status = 'active';
create index products_live_sold_count_idx on public.products (sold_count desc)
  where deleted_at is null and status = 'active';

create table public.colors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hex_code text,
  rgb_code text,
  display_name text,
  sort_order integer not null default 0,
  description text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sizes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_name text,
  sort_order integer not null default 0,
  description text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- sku keeps the default constraint name product_variants_sku_key, which
-- app/api/products/route.ts matches on to show a friendly duplicate-SKU error.
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  size_id uuid references public.sizes (id) on delete set null,
  color_id uuid references public.colors (id) on delete set null,
  sku text unique,
  price numeric(10, 2) check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  is_available boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_variants_product_id_idx on public.product_variants (product_id);
create index product_variants_size_id_idx on public.product_variants (size_id);
create index product_variants_color_id_idx on public.product_variants (color_id);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete cascade,
  image_url text not null,
  alt_text text,
  is_main boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_images_product_id_position_idx on public.product_images (product_id, position);
create index product_images_variant_id_idx on public.product_images (variant_id);

create table public.product_discounts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  discount_percent numeric(5, 2) not null check (discount_percent > 0 and discount_percent <= 100),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create index product_discounts_active_product_id_idx on public.product_discounts (product_id)
  where active;

-- ---------------------------------------------------------------------------
-- Storefront content
-- ---------------------------------------------------------------------------

-- Sale banners (app/api/sale-banners, components/sections/SaleBanner.tsx).
create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  badge_text text,
  discount_percent integer not null default 0 check (discount_percent between 0 and 100),
  image_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reels (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  username text default '@kachabiti',
  thumbnail_url text not null,
  video_url text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  is_new boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.hero_sections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  title_ar text,
  title_fr text,
  subtitle text,
  subtitle_ar text,
  subtitle_fr text,
  sub_subtitle text,
  sub_subtitle_ar text,
  sub_subtitle_fr text,
  cta_label text,
  cta_label_ar text,
  cta_label_fr text,
  cta_href text,
  image_url text,
  left_image_url text,
  background_image_url text,
  bg_color text,
  text_color text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.small_cards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  title_ar text,
  title_fr text,
  subtitle text,
  subtitle_ar text,
  subtitle_fr text,
  sub_subtitle text,
  sub_subtitle_ar text,
  sub_subtitle_fr text,
  cta_href text,
  image_url text,
  background_image_url text,
  bg_color text not null default 'bg-gray-100',
  text_color text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

-- Public profile used by review embeds (reviews -> users). Deliberately has no
-- email column: this table is publicly readable.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid references public.users (id) on delete set null,
  user_name text check (char_length(user_name) <= 100),
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reviews_product_id_created_at_idx on public.reviews (product_id, created_at desc);
create index reviews_user_id_idx on public.reviews (user_id);

create table public.user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index user_favorites_product_id_idx on public.user_favorites (product_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references auth.users (id) on delete set null,
  customer_email text,
  customer_first_name text not null,
  customer_last_name text not null,
  customer_phone text not null,
  shipping_address text,
  shipping_city text,
  shipping_state text,
  shipping_zip text,
  shipping_country text,
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  shipping_cost numeric(10, 2) not null default 0 check (shipping_cost >= 0),
  total numeric(10, 2) not null check (total >= 0),
  order_notes text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_user_id_created_at_idx on public.orders (user_id, created_at desc);
create index orders_created_at_idx on public.orders (created_at desc);

-- product_id is kept nullable so order history survives product deletion.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  product_name_ar text,
  product_name_fr text,
  product_image text,
  quantity integer not null check (quantity > 0),
  price numeric(10, 2) not null check (price >= 0),
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  created_at timestamptz not null default now()
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'active' check (status in ('active', 'unsubscribed', 'bounced')),
  subscribed_at timestamptz default now(),
  unsubscribed_at timestamptz,
  ip_address text,
  user_agent text,
  referrer text,
  metadata jsonb not null default '{}'::jsonb
);

-- Cart analytics (admin dashboard). Nothing in the app writes carts yet.
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  session_id text unique,
  status text not null default 'active' check (status in ('active', 'abandoned', 'converted', 'merged')),
  last_activity_at timestamptz not null default now(),
  expires_at timestamptz default now() + interval '30 days',
  converted_to_order_id uuid references public.orders (id) on delete set null,
  device_info jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or session_id is not null)
);

create index carts_user_id_idx on public.carts (user_id);
create index carts_converted_to_order_id_idx on public.carts (converted_to_order_id);
create index carts_active_last_activity_idx on public.carts (last_activity_at) where status = 'active';

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  price_at_add numeric(10, 2),
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id)
);

create index cart_items_product_id_idx on public.cart_items (product_id);

-- security_invoker so the views respect RLS on carts (service role only).
create view public.abandoned_carts with (security_invoker = true) as
select
  c.id,
  c.user_id,
  c.session_id,
  c.last_activity_at,
  c.created_at,
  count(ci.id) as item_count,
  sum(ci.quantity * ci.price_at_add) as estimated_value,
  coalesce(
    jsonb_agg(
      jsonb_build_object('product_id', ci.product_id, 'quantity', ci.quantity, 'price', ci.price_at_add)
    ) filter (where ci.id is not null),
    '[]'::jsonb
  ) as items
from public.carts c
left join public.cart_items ci on ci.cart_id = c.id
where c.status = 'active'
  and c.last_activity_at < now() - interval '1 hour'
  and c.last_activity_at > now() - interval '30 days'
  and c.user_id is not null
group by c.id;

create view public.cart_analytics with (security_invoker = true) as
select
  (c.created_at at time zone 'utc')::date as date,
  count(*) as total_carts,
  count(*) filter (where c.status = 'converted') as converted_carts,
  count(*) filter (where c.status = 'abandoned') as abandoned_carts,
  avg(t.item_count) as avg_items_per_cart,
  avg(t.total_value) as avg_cart_value
from public.carts c
left join (
  select cart_id, count(*) as item_count, sum(quantity * price_at_add) as total_value
  from public.cart_items
  group by cart_id
) t on t.cart_id = c.id
group by 1;

-- ---------------------------------------------------------------------------
-- Settings, shipping, tax
-- ---------------------------------------------------------------------------

create table public.site_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value text not null,
  setting_type text not null default 'string' check (setting_type in ('string', 'number', 'boolean', 'json')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  country_code text not null,
  shipping_method text not null default 'standard' check (shipping_method in ('standard', 'express', 'overnight')),
  base_rate numeric(10, 2) not null default 0 check (base_rate >= 0),
  free_shipping_threshold numeric(10, 2),
  estimated_days_min integer default 2,
  estimated_days_max integer default 5,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_code, shipping_method)
);

create table public.country_tax_rates (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  country_code text not null unique,
  tax_rate numeric(5, 4) not null check (tax_rate >= 0 and tax_rate < 1),
  tax_name text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'categories', 'products', 'colors', 'sizes', 'product_variants', 'product_images',
    'product_discounts', 'promotions', 'reels', 'hero_sections', 'small_cards', 'users',
    'reviews', 'orders', 'carts', 'cart_items', 'site_settings', 'shipping_rates',
    'country_tax_rates'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function private.set_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.colors enable row level security;
alter table public.sizes enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.product_discounts enable row level security;
alter table public.promotions enable row level security;
alter table public.reels enable row level security;
alter table public.hero_sections enable row level security;
alter table public.small_cards enable row level security;
alter table public.users enable row level security;
alter table public.reviews enable row level security;
alter table public.user_favorites enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.site_settings enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.country_tax_rates enable row level security;

-- Public catalog reads (live rows only).
create policy "Public can read live categories" on public.categories
  for select to anon, authenticated using (deleted_at is null);
create policy "Public can read active products" on public.products
  for select to anon, authenticated using (deleted_at is null and status = 'active');
create policy "Public can read live colors" on public.colors
  for select to anon, authenticated using (deleted_at is null);
create policy "Public can read live sizes" on public.sizes
  for select to anon, authenticated using (deleted_at is null);
create policy "Public can read live variants" on public.product_variants
  for select to anon, authenticated using (deleted_at is null);
create policy "Public can read product images" on public.product_images
  for select to anon, authenticated using (true);
create policy "Public can read active discounts" on public.product_discounts
  for select to anon, authenticated using (active);
create policy "Public can read active sale banners" on public.promotions
  for select to anon, authenticated using (active);
create policy "Public can read active reels" on public.reels
  for select to anon, authenticated using (active);
create policy "Public can read active hero sections" on public.hero_sections
  for select to anon, authenticated using (is_active);
create policy "Public can read active small cards" on public.small_cards
  for select to anon, authenticated using (is_active);
create policy "Public can read site settings" on public.site_settings
  for select to anon, authenticated using (true);
create policy "Public can read active shipping rates" on public.shipping_rates
  for select to anon, authenticated using (is_active);
create policy "Public can read active tax rates" on public.country_tax_rates
  for select to anon, authenticated using (is_active);

-- Profiles and reviews.
create policy "Public can read profiles" on public.users
  for select to anon, authenticated using (true);
create policy "Public can read reviews" on public.reviews
  for select to anon, authenticated using (true);
create policy "Anyone can post a review as themselves" on public.reviews
  for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

-- Favorites: owner only.
create policy "Users can read their favorites" on public.user_favorites
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users can add their favorites" on public.user_favorites
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users can remove their favorites" on public.user_favorites
  for delete to authenticated using (user_id = (select auth.uid()));

-- Orders: owners can read their own history; creation happens server-side.
create policy "Users can read their orders" on public.orders
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users can read their order items" on public.order_items
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = (select auth.uid())
    )
  );

-- newsletter_subscribers, carts, cart_items: no policies (service role only).

-- ---------------------------------------------------------------------------
-- Grants (explicit, so exposure does not depend on project Data API defaults)
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;

grant select on
  public.categories, public.products, public.colors, public.sizes,
  public.product_variants, public.product_images, public.product_discounts,
  public.promotions, public.reels, public.hero_sections, public.small_cards,
  public.site_settings, public.shipping_rates, public.country_tax_rates,
  public.users, public.reviews
to anon, authenticated;

grant insert (product_id, user_id, user_name, rating, comment) on public.reviews to anon, authenticated;
grant select, insert, delete on public.user_favorites to authenticated;
grant select on public.orders, public.order_items to authenticated;

grant all on all tables in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Storage: product/content images, uploaded via app/api/upload/image
-- (service role). Public bucket, so files are served by public URL; no
-- storage.objects policies means clients cannot list, upload or delete.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'products', 'products', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Baseline settings (values match the fallbacks in lib/get-site-settings.ts,
-- except tax, which scripts/FIX-TAX-TO-ZERO.sql had set to 0 for Tunisia).
-- ---------------------------------------------------------------------------

insert into public.site_settings (setting_key, setting_value, setting_type, description) values
  ('global_free_shipping_threshold', '500', 'number', 'Order subtotal above which shipping is free'),
  ('free_shipping_enabled', 'true', 'boolean', 'Whether free shipping over the threshold applies'),
  ('default_shipping_cost', '7', 'number', 'Shipping cost when no country rate matches'),
  ('shipping_tax_rate', '0', 'number', 'Tax rate applied to shipping'),
  ('general_tax_rate', '0', 'number', 'Tax rate when no country rate matches');

insert into public.country_tax_rates (country, country_code, tax_rate, tax_name, description) values
  ('Tunisia', 'TN', 0, 'TVA', 'Tax-free / Exonéré de taxe');
