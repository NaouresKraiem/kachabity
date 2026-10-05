-- Out-of-stock items can be ordered ("sur commande"): validating an order deducts only the units
-- the online location actually holds, instead of failing on the shortage. The rest is made to order.
-- Restoring is unchanged: it returns exactly what was deducted (summed from the order's movements).

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
  on_hand integer;
  take integer;
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
      select oi.variant_id, sum(oi.quantity)::integer as quantity
        from public.order_items oi
        join public.product_variants v on v.id = oi.variant_id
        join public.products p on p.id = v.product_id
       where oi.order_id = p_order_id and p.stock_tracked
       group by oi.variant_id
    loop
      select available into on_hand
        from public.inventory_levels
       where variant_id = item.variant_id and location_id = online_location
         for update;
      take := least(item.quantity, greatest(coalesce(on_hand, 0), 0));
      if take > 0 then
        insert into public.stock_movements (variant_id, location_id, type, quantity, reference, order_id, created_by, created_by_email)
        values (item.variant_id, online_location, 'sale', -take, ord.order_number, p_order_id, p_actor, p_actor_email);
        lines := lines + 1;
      end if;
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
