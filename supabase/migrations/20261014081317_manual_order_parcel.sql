-- "New parcel" with products (Admin → Delivery): once Colissimo has created the parcel, the order,
-- its lines and the parcel are saved and the order is validated (its tracked items leave the online
-- location's stock) in one transaction. If any step fails, nothing is written.

create or replace function public.create_order_with_delivery(p_order jsonb, p_items jsonb, p_delivery jsonb,
                                                             p_actor uuid default null, p_actor_email text default null)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  created jsonb;
  order_id uuid;
  row public.deliveries;
  ord public.orders;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'order_items_required';
  end if;

  created := public.create_order(p_order, p_items);
  order_id := (created->'order'->>'id')::uuid;

  insert into public.deliveries (order_id, barcode, label_url, label_zebra_url, status, status_changed_at,
                                 recipient_name, phone, governorate, city, address, cod_amount, items_count,
                                 designation, request, created_by, created_by_email)
  values (order_id, p_delivery->>'barcode', p_delivery->>'label_url', p_delivery->>'label_zebra_url', 'En attente', now(),
          p_delivery->'request'->>'nom', p_delivery->'request'->>'tel', p_delivery->'request'->>'gouvernerat',
          p_delivery->'request'->>'ville', p_delivery->'request'->>'adresse',
          nullif(p_delivery->'request'->>'prix', '')::numeric, nullif(p_delivery->'request'->>'nb_article', '')::integer,
          p_delivery->'request'->>'designation', p_delivery->'request', p_actor, p_actor_email)
  returning * into row;

  select * into ord from public.set_order_status(order_id, '{"status": "processing"}'::jsonb, p_actor, p_actor_email);

  return jsonb_build_object(
    'delivery', to_jsonb(row),
    'order', jsonb_build_object('id', ord.id, 'order_number', ord.order_number, 'status', ord.status, 'stock_deducted', ord.stock_deducted)
  );
end;
$$;

revoke all on function public.create_order_with_delivery(jsonb, jsonb, jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.create_order_with_delivery(jsonb, jsonb, jsonb, uuid, text) to service_role;
