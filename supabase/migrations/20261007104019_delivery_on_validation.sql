-- Validating an order now creates its Colissimo parcel. Creating the parcel therefore validates
-- the order (pending → processing, which takes its items out of stock) instead of marking it
-- shipped; it becomes shipped when Colissimo reports the parcel picked up or on its way.

create or replace function public.complete_delivery(p_id uuid, p_barcode text, p_label_url text, p_label_zebra_url text,
                                                    p_actor uuid default null, p_actor_email text default null)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  row public.deliveries;
  ord public.orders;
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
    select * into ord from public.orders where id = row.order_id;
    if ord.status = 'pending' then
      begin
        select * into ord from public.set_order_status(row.order_id, '{"status": "processing"}'::jsonb, p_actor, p_actor_email);
      exception when others then
        warning := sqlerrm;
      end;
    end if;
  end if;

  return jsonb_build_object(
    'delivery', to_jsonb(row),
    'order', case when ord.id is null then null else jsonb_build_object('status', ord.status, 'stock_deducted', ord.stock_deducted) end,
    'warning', warning
  );
end;
$$;

-- As before, plus: once Colissimo has the parcel (picked up, at the depot, out for delivery),
-- a validated order becomes shipped.
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

  if row.order_id is not null then
    select * into ord from public.orders where id = row.order_id and deleted_at is null;
    if found then
      if p_status in ('Enleve', 'Au depot', 'En cours', 'Retour Inter Agence') and ord.status = 'processing' then
        changes := changes || '{"status": "shipped"}'::jsonb;
      elsif p_status in ('Livre', 'Livre paye') and ord.status in ('processing', 'shipped') then
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
