-- Parcels sent to the delivery company (Colissimo), one live parcel per order.
-- Colissimo's API can create a parcel and report one parcel's status by barcode, but can't
-- list an account's parcels, so this table is the list the admin sees. Parcels created on
-- Colissimo's website can be added by barcode (order_id null until linked).

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete set null,
  provider text not null default 'colissimo',
  barcode text,
  label_url text,
  label_zebra_url text,
  -- Colissimo's état ("En attente", "Livre", ...), or 'sending' while the request is out.
  status text not null default 'sending',
  status_reason text,
  status_changed_at timestamptz,
  recipient_name text,
  phone text,
  governorate text,
  city text,
  address text,
  cod_amount numeric(10, 3),
  items_count integer,
  designation text,
  -- The fields sent to Colissimo (never the token).
  request jsonb,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index deliveries_order_live_idx on public.deliveries (order_id)
  where deleted_at is null and order_id is not null;
create unique index deliveries_barcode_live_idx on public.deliveries (provider, barcode)
  where deleted_at is null and barcode is not null;
create index deliveries_created_at_idx on public.deliveries (created_at desc);

alter table public.deliveries enable row level security;
revoke all on public.deliveries from anon, authenticated;
grant all on public.deliveries to service_role;

create trigger prevent_hard_delete before delete on public.deliveries
  for each row execute function private.prevent_hard_delete();
create trigger log_activity after insert or update on public.deliveries
  for each row execute function private.log_activity();

-- Step 1 of sending an order: reserve its parcel row before calling Colissimo, so two clicks
-- (or two admins) can't create two parcels for one order.
create or replace function public.begin_delivery(p_order_id uuid, p_request jsonb, p_actor uuid default null, p_actor_email text default null)
returns public.deliveries
language plpgsql
set search_path = ''
as $$
declare
  ord public.orders;
  row public.deliveries;
begin
  select * into ord from public.orders where id = p_order_id and deleted_at is null for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if ord.status = 'cancelled' then
    raise exception 'order_cancelled';
  end if;
  if exists (select 1 from public.deliveries where order_id = p_order_id and deleted_at is null) then
    raise exception 'delivery_exists';
  end if;

  insert into public.deliveries (order_id, status, recipient_name, phone, governorate, city, address,
                                 cod_amount, items_count, designation, request, created_by, created_by_email)
  values (p_order_id, 'sending', p_request->>'nom', p_request->>'tel', p_request->>'gouvernerat', p_request->>'ville',
          p_request->>'adresse', nullif(p_request->>'prix', '')::numeric, nullif(p_request->>'nb_article', '')::integer,
          p_request->>'designation', p_request, p_actor, p_actor_email)
  returning * into row;
  return row;
end;
$$;

-- Step 2: Colissimo accepted the parcel. Records its barcode and slip, and marks the order
-- shipped (which takes its items out of stock) in the same transaction. If the order can't
-- change status, the parcel is still recorded and the reason comes back as `warning`.
create or replace function public.complete_delivery(p_id uuid, p_barcode text, p_label_url text, p_label_zebra_url text,
                                                    p_actor uuid default null, p_actor_email text default null)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  row public.deliveries;
  ord_status text;
  warning text;
begin
  update public.deliveries
     set barcode = p_barcode, label_url = p_label_url, label_zebra_url = p_label_zebra_url,
         status = 'En attente', status_changed_at = now(), updated_at = now()
   where id = p_id and deleted_at is null
  returning * into row;
  if not found then
    raise exception 'delivery_not_found';
  end if;

  if row.order_id is not null then
    select status into ord_status from public.orders where id = row.order_id;
    if ord_status in ('pending', 'processing') then
      begin
        perform public.set_order_status(row.order_id, '{"status": "shipped"}'::jsonb, p_actor, p_actor_email);
      exception when others then
        warning := sqlerrm;
      end;
    end if;
  end if;

  return jsonb_build_object('delivery', to_jsonb(row), 'warning', warning);
end;
$$;

-- Colissimo refused the parcel or couldn't be reached: release the reservation.
create or replace function public.fail_delivery(p_id uuid, p_error text)
returns void
language sql
set search_path = ''
as $$
  update public.deliveries
     set status = 'failed', status_reason = left(p_error, 500), deleted_at = now(), updated_at = now()
   where id = p_id and status = 'sending' and deleted_at is null;
$$;

-- A tracking result. Only a change of status is written (so refreshing doesn't flood the
-- activity log). A delivered parcel marks its shipped order delivered, and "Livre paye"
-- (Colissimo has paid out the cash) also marks it paid.
create or replace function public.record_delivery_status(p_id uuid, p_status text, p_reason text,
                                                         p_actor uuid default null, p_actor_email text default null)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  row public.deliveries;
  ord public.orders;
  changes jsonb := '{}'::jsonb;
begin
  update public.deliveries
     set status = p_status, status_reason = nullif(p_reason, ''), status_changed_at = now(), updated_at = now()
   where id = p_id and deleted_at is null
     and (status is distinct from p_status or status_reason is distinct from nullif(p_reason, ''))
  returning * into row;
  if not found then
    return false;
  end if;

  if row.order_id is not null and p_status in ('Livre', 'Livre paye') then
    select * into ord from public.orders where id = row.order_id and deleted_at is null;
    if found then
      if ord.status in ('processing', 'shipped') then
        changes := changes || '{"status": "delivered"}'::jsonb;
      end if;
      if p_status = 'Livre paye' and ord.payment_status = 'pending' then
        changes := changes || '{"payment_status": "paid"}'::jsonb;
      end if;
      if changes <> '{}'::jsonb then
        perform public.set_order_status(row.order_id, changes, p_actor, p_actor_email);
      end if;
    end if;
  end if;
  return true;
end;
$$;

revoke all on function public.begin_delivery(uuid, jsonb, uuid, text) from public, anon, authenticated;
revoke all on function public.complete_delivery(uuid, text, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.fail_delivery(uuid, text) from public, anon, authenticated;
revoke all on function public.record_delivery_status(uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.begin_delivery(uuid, jsonb, uuid, text) to service_role;
grant execute on function public.complete_delivery(uuid, text, text, text, uuid, text) to service_role;
grant execute on function public.fail_delivery(uuid, text) to service_role;
grant execute on function public.record_delivery_status(uuid, text, text, uuid, text) to service_role;
