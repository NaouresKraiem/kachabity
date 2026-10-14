-- Who added each order: the team member (agent) for orders entered in the admin, null for orders
-- placed on the website. Admin → Agent performance compares agents with agent_performance().

alter table public.orders add column created_by uuid, add column created_by_email text;
create index orders_created_by_created_at_idx on public.orders (created_by, created_at desc) where created_by is not null;

-- Orders entered so far with "New parcel" were saved in the same transaction as their parcel, so
-- they share its creation time and its author.
update public.orders o
   set created_by = d.created_by, created_by_email = d.created_by_email
  from public.deliveries d
 where d.order_id = o.id and d.created_at = o.created_at and d.created_by is not null and o.created_by is null;

-- Same as before, and the order records the agent who added it.
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
  update public.orders set created_by = p_actor, created_by_email = p_actor_email where id = order_id;

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

-- One row per agent (and one for website orders, agent_id null) over orders created in
-- [p_from, p_to): how many, their value, and how they ended. "Returned" means the parcel came back
-- (Colissimo return statuses). Deleted orders are left out.
create or replace function public.agent_performance(p_from timestamptz, p_to timestamptz)
returns table (
  agent_id uuid,
  agent_email text,
  agent_role text,
  orders integer,
  revenue numeric,
  delivered integer,
  delivered_revenue numeric,
  paid integer,
  in_progress integer,
  cancelled integer,
  returned integer,
  items integer,
  last_order_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  with scoped as (
    select o.*,
           exists (
             select 1 from public.deliveries d
              where d.order_id = o.id and d.deleted_at is null
                and d.status in ('Retour Expediteur', 'Retour depot', 'Retour definitif', 'Retour paye', 'Retour recu paye')
           ) as was_returned,
           (select coalesce(sum(oi.quantity), 0) from public.order_items oi where oi.order_id = o.id) as item_count
      from public.orders o
     where o.deleted_at is null and o.created_at >= p_from and o.created_at < p_to
  )
  select s.created_by,
         coalesce(max(s.created_by_email), max(b.email)),
         max(b.role),
         count(*)::integer,
         coalesce(sum(s.total) filter (where s.status <> 'cancelled'), 0),
         (count(*) filter (where s.status = 'delivered'))::integer,
         coalesce(sum(s.total) filter (where s.status = 'delivered'), 0),
         (count(*) filter (where s.payment_status = 'paid'))::integer,
         (count(*) filter (where s.status in ('pending', 'processing', 'shipped') and not s.was_returned))::integer,
         (count(*) filter (where s.status = 'cancelled'))::integer,
         (count(*) filter (where s.was_returned))::integer,
         coalesce(sum(s.item_count), 0)::integer,
         max(s.created_at)
    from scoped s
    left join public.back_office_users b on b.user_id = s.created_by
   group by s.created_by
   order by s.created_by is null, count(*) desc;
$$;

revoke all on function public.agent_performance(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.agent_performance(timestamptz, timestamptz) to service_role;
