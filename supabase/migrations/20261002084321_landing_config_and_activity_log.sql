-- 1. Every home page section is editable: product picks for top products, promotions and
--    the collection spotlight; featured categories in their own order; section order,
--    visibility and list sizes in the site_settings row `landing_config` (JSON).
-- 2. activity_log: who changed what in the back office. Triggers record every insert and
--    update on business tables; the actor comes from the x-actor-* headers that
--    lib/supabase-admin.ts adds to service-role requests made for a signed-in staff member.
-- 3. Customer accounts, favorites and carts join the no-hard-delete guard.

-- ---------------------------------------------------------------------------
-- Landing page
-- ---------------------------------------------------------------------------

alter table public.landing_products drop constraint landing_products_section_check;
alter table public.landing_products add constraint landing_products_section_check
  check (section in ('new_arrivals', 'showcase', 'ring', 'top_products', 'promo_products', 'spotlight'));

create or replace function public.set_landing_products(p_section text, p_product_ids uuid[], p_actor uuid default null)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  ids uuid[] := coalesce(p_product_ids, '{}');
  i integer;
begin
  if p_section not in ('new_arrivals', 'showcase', 'ring', 'top_products', 'promo_products', 'spotlight') then
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

-- Featured categories on the home page, in their own order (independent of sort_order,
-- which orders the menus).
alter table public.categories add column featured_position integer;

update public.categories c
   set featured_position = r.pos
  from (select id, row_number() over (order by sort_order, name) - 1 as pos
          from public.categories where is_featured and deleted_at is null) r
 where c.id = r.id;

-- Makes exactly p_category_ids featured, in that order.
create or replace function public.set_featured_categories(p_category_ids uuid[])
returns integer
language plpgsql
set search_path = ''
as $$
declare
  ids uuid[] := coalesce(p_category_ids, '{}');
begin
  update public.categories c
     set is_featured = false, featured_position = null
   where c.is_featured and not (c.id = any (ids));

  update public.categories c
     set is_featured = true, featured_position = array_position(ids, c.id) - 1
   where c.id = any (ids)
     and (not c.is_featured or c.featured_position is distinct from array_position(ids, c.id) - 1);

  return coalesce(array_length(ids, 1), 0);
end;
$$;

revoke all on function public.set_featured_categories(uuid[]) from public, anon, authenticated;
grant execute on function public.set_featured_categories(uuid[]) to service_role;

-- One JSON setting replaces the two keys added earlier today (their values carry over).
insert into public.site_settings (setting_key, setting_value, setting_type, description)
select 'landing_config',
       jsonb_build_object(
         'lists', jsonb_build_object(
           'new_arrivals', jsonb_build_object(
             'count', coalesce((select setting_value::integer from public.site_settings where setting_key = 'landing_new_arrivals_count'), 10),
             'autofill', coalesce((select setting_value::boolean from public.site_settings where setting_key = 'landing_new_arrivals_autofill'), true)
           )
         )
       )::text,
       'json',
       'Home page layout and product lists (Admin → Landing page)'
on conflict (setting_key) do nothing;

alter table public.site_settings disable trigger prevent_hard_delete;
delete from public.site_settings where setting_key in ('landing_new_arrivals_count', 'landing_new_arrivals_autofill');
alter table public.site_settings enable trigger prevent_hard_delete;

-- ---------------------------------------------------------------------------
-- Customer accounts: soft delete only
-- ---------------------------------------------------------------------------

alter table public.users add column deleted_at timestamptz;

do $$
declare
  t text;
begin
  foreach t in array array['users', 'user_favorites', 'carts', 'cart_items'] loop
    execute format(
      'create trigger prevent_hard_delete before delete on public.%I
         for each row execute function private.prevent_hard_delete()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Activity log
-- ---------------------------------------------------------------------------

create table public.activity_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_id uuid,
  actor_email text,
  actor_role text,
  source text not null default 'admin' check (source in ('admin', 'database')),
  action text not null,
  entity text not null,
  entity_id text,
  label text,
  changes jsonb
);

create index activity_log_created_at_idx on public.activity_log (created_at desc);
create index activity_log_actor_created_at_idx on public.activity_log (actor_id, created_at desc);
create index activity_log_entity_idx on public.activity_log (entity, entity_id);

-- Service role only (read by the admin Activity page).
alter table public.activity_log enable row level security;
revoke all on public.activity_log from anon, authenticated;
grant select, insert on public.activity_log to service_role;

-- History can't be rewritten.
create or replace function private.prevent_activity_log_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'activity_log_is_append_only' using errcode = 'P0001';
end;
$$;

create trigger activity_log_append_only before update or delete on public.activity_log
  for each row execute function private.prevent_activity_log_change();

-- Records an insert or update. Requests through the API without a staff member (checkout,
-- shoppers' favorites, scripts) are skipped; changes made directly in the database
-- (SQL editor, migrations) are recorded with source 'database'.
create or replace function private.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  headers jsonb;
  v_actor uuid;
  v_source text := 'admin';
  v_new jsonb := to_jsonb(new);
  v_old jsonb;
  v_changes jsonb;
  v_action text;
begin
  begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    headers := null;
  end;

  if headers is null then
    v_source := 'database';
  else
    begin
      v_actor := nullif(headers->>'x-actor-id', '')::uuid;
    exception when others then
      v_actor := null;
    end;
    if v_actor is null then
      return null;
    end if;
  end if;

  if tg_op = 'INSERT' then
    v_action := 'create';
    v_changes := v_new;
  else
    v_old := to_jsonb(old);
    select jsonb_object_agg(n.key, jsonb_build_object('from', o.value, 'to', n.value))
      into v_changes
      from jsonb_each(v_new) n
      join jsonb_each(v_old) o using (key)
     where n.value is distinct from o.value
       and n.key not in ('updated_at');
    if v_changes is null then
      return null;
    end if;
    v_action := case
      when v_old->>'deleted_at' is null and v_new->>'deleted_at' is not null then 'delete'
      when v_old->>'deleted_at' is not null and v_new->>'deleted_at' is null then 'restore'
      else 'update'
    end;
  end if;

  insert into public.activity_log (actor_id, actor_email, actor_role, source, action, entity, entity_id, label, changes)
  values (
    v_actor,
    nullif(headers->>'x-actor-email', ''),
    nullif(headers->>'x-actor-role', ''),
    v_source,
    v_action,
    tg_table_name,
    coalesce(v_new->>'id', v_new->>'product_id', v_new->>'setting_key'),
    coalesce(v_new->>'order_number', v_new->>'name', v_new->>'title', v_new->>'sku', v_new->>'setting_key',
             v_new->>'product_name', v_new->>'section'),
    v_changes
  );
  return null;
end;
$$;

revoke all on function private.log_activity() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'categories', 'products', 'colors', 'sizes', 'product_variants', 'product_discounts',
    'promotions', 'reels', 'hero_sections', 'small_cards', 'orders', 'site_settings',
    'shipping_rates', 'country_tax_rates', 'locations', 'suppliers', 'collections',
    'product_costs', 'stock_movements', 'landing_products', 'reviews', 'newsletter_subscribers'
  ]
  loop
    execute format(
      'create trigger log_activity after insert or update on public.%I
         for each row execute function private.log_activity()', t);
  end loop;
end;
$$;

-- Everyone who appears in the log (for the Activity page's user filter), including
-- accounts deleted since.
create or replace function public.activity_actors()
returns table (actor_id uuid, actor_email text, last_at timestamptz, entries bigint)
language sql
stable
set search_path = ''
as $$
  select a.actor_id, max(a.actor_email), max(a.created_at), count(*)
    from public.activity_log a
   where a.actor_id is not null
   group by a.actor_id
   order by max(a.created_at) desc;
$$;

revoke all on function public.activity_actors() from public, anon, authenticated;
grant execute on function public.activity_actors() to service_role;
