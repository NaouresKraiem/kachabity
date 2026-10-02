-- Permanent deletes, for admins and for staff given the `hard_delete` permission.
--
-- Deleting stays a soft delete everywhere. Rows that are already soft-deleted can then be
-- erased for good through public.purge_deleted() (Admin → Deleted items). It is the only way
-- past private.prevent_hard_delete, and only the service role can call it; the API checks
-- the permission (middleware.ts). Each erased row is recorded in the activity log.
--
-- Also: the activity log now trusts the x-actor-* headers only on service-role requests.
-- Before, a shopper's own write (a review, a favorite) could carry made-up headers and be
-- logged under a staff member's name.
--
-- And two writes that were several requests become one transaction each:
-- save_landing_page (Admin → Landing page) and delete_variant (variant + its photos).

-- ---------------------------------------------------------------------------
-- Identity of the staff member behind a request
-- ---------------------------------------------------------------------------

-- The request headers of a service-role API request (lib/supabase-admin.ts sets x-actor-*
-- from the identity middleware verified); '{}' for any other API request; null outside the
-- API (SQL editor, migrations, the importer's direct connection).
create or replace function private.trusted_request_headers()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  headers jsonb;
  claims jsonb;
begin
  begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
    claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception when others then
    return '{}'::jsonb;
  end;
  if headers is null then
    return null;
  end if;
  if coalesce(claims->>'role', '') <> 'service_role' then
    return '{}'::jsonb;
  end if;
  return headers;
end;
$$;

revoke all on function private.trusted_request_headers() from public, anon, authenticated;

create or replace function private.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  headers jsonb := private.trusted_request_headers();
  v_actor uuid;
  v_source text := 'admin';
  v_new jsonb := to_jsonb(new);
  v_old jsonb;
  v_changes jsonb;
  v_action text;
begin
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

-- ---------------------------------------------------------------------------
-- Guard: hard deletes only through purge_deleted()
-- ---------------------------------------------------------------------------

create or replace function private.prevent_hard_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Set (transaction-local) by public.purge_deleted() only. Also lets the rows its delete
  -- cascades to (variants, photos, order lines…) go.
  if current_setting('app.purge', true) = 'on' then
    return old;
  end if;
  raise exception 'hard_delete_not_allowed: set deleted_at on %.% instead', tg_table_schema, tg_table_name
    using errcode = 'P0001';
end;
$$;

-- ---------------------------------------------------------------------------
-- Erase soft-deleted rows
-- ---------------------------------------------------------------------------

-- Erases the given rows of p_table that are already soft-deleted (others are ignored) and
-- returns how many went. Nothing is erased (all or nothing) when one of them:
-- * is still used by live data, including references the database would quietly set to null
--   (a color on live variants, a category with live products or subcategories, a location
--   with stock movements): foreign_key_violation (23503);
-- * still holds stock (a product's or variant's inventory levels would vanish without a
--   stock movement): has_stock.
create or replace function public.purge_deleted(p_table text, p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  headers jsonb := private.trusted_request_headers();
  v_actor uuid;
  v_count integer;
begin
  if p_table not in (
    'products', 'product_variants', 'categories', 'colors', 'sizes', 'product_discounts',
    'promotions', 'reels', 'hero_sections', 'small_cards', 'orders', 'locations',
    'suppliers', 'collections'
  ) then
    raise exception 'purge_not_allowed: %', p_table using errcode = 'P0001';
  end if;

  begin
    v_actor := nullif(headers->>'x-actor-id', '')::uuid;
  exception when others then
    v_actor := null;
  end;

  -- Still used by live rows.
  if (p_table = 'colors' and exists (
        select 1 from public.product_variants v where v.color_id = any (p_ids) and v.deleted_at is null))
     or (p_table = 'sizes' and exists (
        select 1 from public.product_variants v where v.size_id = any (p_ids) and v.deleted_at is null))
     or (p_table = 'categories' and (
        exists (select 1 from public.products p where p.category_id = any (p_ids) and p.deleted_at is null)
        or exists (select 1 from public.categories c where c.parent_id = any (p_ids) and c.deleted_at is null)))
     or (p_table = 'suppliers' and exists (
        select 1 from public.products p where p.supplier_id = any (p_ids) and p.deleted_at is null))
     or (p_table = 'collections' and exists (
        select 1 from public.products p where p.collection_id = any (p_ids) and p.deleted_at is null))
  then
    raise exception 'in_use: % still used by live records', p_table using errcode = '23503';
  end if;

  -- Stock only changes through stock_movements; erasing a variant would drop its levels.
  if p_table in ('products', 'product_variants') and exists (
    select 1
      from public.inventory_levels il
      join public.product_variants v on v.id = il.variant_id
     where il.available <> 0
       and (case when p_table = 'products' then v.product_id else v.id end) = any (p_ids)
  ) then
    raise exception 'has_stock: record a movement to bring the stock to 0 first' using errcode = 'P0001';
  end if;

  perform set_config('app.purge', 'on', true);

  -- Home page picks point at products without a cascade; they go with the product.
  if p_table = 'products' then
    delete from public.landing_products l
     using public.products p
     where l.product_id = p.id and p.id = any (p_ids) and p.deleted_at is not null;
  end if;

  execute format(
    'with erased as (
       delete from public.%1$I t where t.id = any ($1) and t.deleted_at is not null returning t.*
     ), logged as (
       insert into public.activity_log (actor_id, actor_email, actor_role, source, action, entity, entity_id, label, changes)
       select $2, nullif($3->>''x-actor-email'', ''''), nullif($3->>''x-actor-role'', ''''),
              case when $3 is null then ''database'' else ''admin'' end,
              ''purge'', %1$L, e.id::text,
              coalesce(to_jsonb(e)->>''order_number'', to_jsonb(e)->>''name'', to_jsonb(e)->>''title'', to_jsonb(e)->>''sku''),
              to_jsonb(e)
         from erased e
       returning 1
     )
     select count(*) from logged', p_table)
    using p_ids, v_actor, headers
    into v_count;

  perform set_config('app.purge', '', true);
  return v_count;
end;
$$;

revoke all on function public.purge_deleted(text, uuid[]) from public, anon, authenticated;
grant execute on function public.purge_deleted(text, uuid[]) to service_role;

-- ---------------------------------------------------------------------------
-- One-transaction writes used by the admin API
-- ---------------------------------------------------------------------------

-- Admin → Landing page save: a section's picks, the layout/list settings and the featured
-- categories, each optional (null = leave as is), all or nothing.
create or replace function public.save_landing_page(
  p_section text default null,
  p_product_ids uuid[] default null,
  p_config jsonb default null,
  p_featured_category_ids uuid[] default null,
  p_actor uuid default null
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_section is not null then
    perform public.set_landing_products(p_section, p_product_ids, p_actor);
  end if;
  if p_config is not null then
    insert into public.site_settings (setting_key, setting_value, setting_type)
    values ('landing_config', p_config::text, 'json')
    on conflict (setting_key) do update set setting_value = excluded.setting_value, setting_type = excluded.setting_type;
  end if;
  if p_featured_category_ids is not null then
    perform public.set_featured_categories(p_featured_category_ids);
  end if;
end;
$$;

revoke all on function public.save_landing_page(text, uuid[], jsonb, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.save_landing_page(text, uuid[], jsonb, uuid[], uuid) to service_role;

-- Variant delete (DELETE /api/variants): the variant and its photos together.
create or replace function public.delete_variant(p_variant_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.product_variants
     set deleted_at = now(), is_available = false
   where id = p_variant_id and deleted_at is null;
  update public.product_images
     set deleted_at = now()
   where variant_id = p_variant_id and deleted_at is null;
end;
$$;

revoke all on function public.delete_variant(uuid) from public, anon, authenticated;
grant execute on function public.delete_variant(uuid) to service_role;
