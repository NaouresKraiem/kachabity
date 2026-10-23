-- ERP, part 2: purchasing (suppliers, price requests, purchase orders, receipts with quality
-- check), raw materials and cost price per model (bill of materials, production), and the
-- point of sale (till sessions, sales, cash in/out, closing with variance).

-- ---------------------------------------------------------------------------
-- Suppliers: terms and details
-- ---------------------------------------------------------------------------

alter table public.suppliers
  add column contact_name text,
  add column address text,
  add column tax_id text,                       -- matricule fiscal
  add column bank_details text,                 -- RIB
  add column payment_terms_days integer not null default 0 check (payment_terms_days >= 0),
  add column kind text not null default 'goods' check (kind in ('goods', 'materials', 'services', 'other'));

-- ---------------------------------------------------------------------------
-- Raw materials
-- ---------------------------------------------------------------------------

create table public.raw_materials (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  code text,
  unit text not null default 'unit' check (unit in ('unit', 'm', 'cm', 'kg', 'g', 'l', 'ml', 'roll', 'pack')),
  supplier_id uuid references public.suppliers (id) on delete set null,
  stock numeric(14, 3) not null default 0 check (stock >= 0),
  avg_cost numeric(14, 4) check (avg_cost >= 0),
  reorder_point numeric(14, 3) not null default 0 check (reorder_point >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index raw_materials_code_live_idx on public.raw_materials (code) where deleted_at is null and code is not null;

-- Append-only, like stock_movements. The trigger keeps raw_materials.stock and avg_cost.
create table public.material_movements (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.raw_materials (id),
  type text not null check (type in ('purchase', 'consumption', 'adjustment', 'return')),
  quantity numeric(14, 3) not null check (quantity <> 0),
  unit_cost numeric(14, 4) check (unit_cost >= 0),
  reference text not null default '',
  note text not null default '',
  purchase_receipt_id uuid,
  production_id uuid,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  constraint material_movements_direction check (
    (type = 'purchase' and quantity > 0) or (type = 'consumption' and quantity < 0) or type in ('adjustment', 'return')
  )
);

create index material_movements_material_idx on public.material_movements (material_id, created_at desc);

create or replace function private.apply_material_movement()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  m public.raw_materials;
begin
  select * into m from public.raw_materials where id = new.material_id for update;
  if not found then
    raise exception 'material_not_found';
  end if;
  if m.stock + new.quantity < 0 then
    raise exception 'insufficient_material:%:%', m.name, m.stock using errcode = 'P0001';
  end if;
  if new.type = 'purchase' and new.unit_cost is not null then
    update public.raw_materials
       set stock = m.stock + new.quantity,
           avg_cost = case when m.avg_cost is null or m.stock <= 0 then new.unit_cost
                           else round((m.stock * m.avg_cost + new.quantity * new.unit_cost) / (m.stock + new.quantity), 4) end
     where id = m.id;
  else
    new.unit_cost := coalesce(new.unit_cost, m.avg_cost);
    update public.raw_materials set stock = m.stock + new.quantity where id = m.id;
  end if;
  return new;
end;
$$;

create trigger material_movements_apply
  before insert on public.material_movements
  for each row execute function private.apply_material_movement();

create or replace function private.prevent_movement_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'append_only: record a correcting movement instead' using errcode = 'P0001';
end;
$$;

create trigger material_movements_append_only
  before update or delete on public.material_movements
  for each row execute function private.prevent_movement_change();

-- ---------------------------------------------------------------------------
-- Cost price per model
-- ---------------------------------------------------------------------------

-- Materials used to make one unit of a product.
create table public.product_bom (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  material_id uuid not null references public.raw_materials (id),
  quantity numeric(14, 4) not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index product_bom_live_idx on public.product_bom (product_id, material_id) where deleted_at is null;

-- Work and overhead per unit (admin only; products is publicly readable, so not there).
create table public.product_costing (
  product_id uuid primary key references public.products (id) on delete cascade,
  labor_cost numeric(12, 3) not null default 0 check (labor_cost >= 0),
  overhead_cost numeric(12, 3) not null default 0 check (overhead_cost >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Per product: what each unit costs. With a bill of materials: materials + labor + overhead.
-- Without one: the purchase cost entered on the product, else the stock's average cost.
create or replace function public.product_cost_prices()
returns table (
  product_id uuid,
  product_name text,
  code text,
  base_price numeric,
  materials_cost numeric,
  labor_cost numeric,
  overhead_cost numeric,
  stock_avg_cost numeric,
  purchase_cost numeric,
  cost_price numeric,
  margin numeric,
  margin_percent numeric
)
language sql
stable
set search_path = ''
as $$
  with bom as (
    select b.product_id, sum(b.quantity * coalesce(m.avg_cost, 0)) as materials
      from public.product_bom b
      join public.raw_materials m on m.id = b.material_id
     where b.deleted_at is null
     group by b.product_id
  ), avgc as (
    select v.product_id, avg(v.avg_cost) as avg_cost
      from public.product_variants v
     where v.deleted_at is null and v.avg_cost is not null
     group by v.product_id
  ), base as (
    select p.id, p.name, p.code, p.base_price,
           round(bom.materials, 3) as materials,
           coalesce(pc.labor_cost, 0) as labor, coalesce(pc.overhead_cost, 0) as overhead,
           round(avgc.avg_cost, 3) as avg_cost, cost.cost as purchase,
           case when bom.product_id is not null then round(bom.materials + coalesce(pc.labor_cost, 0) + coalesce(pc.overhead_cost, 0), 3)
                else coalesce(cost.cost, round(avgc.avg_cost, 3)) end as cost_price
      from public.products p
      left join bom on bom.product_id = p.id
      left join avgc on avgc.product_id = p.id
      left join public.product_costing pc on pc.product_id = p.id and pc.deleted_at is null
      left join public.product_costs cost on cost.product_id = p.id and cost.deleted_at is null
     where p.deleted_at is null
  )
  select id, name, code, base_price, materials, labor, overhead, avg_cost, purchase, cost_price,
         case when cost_price is null then null else base_price - cost_price end,
         case when cost_price is null or base_price = 0 then null else round((base_price - cost_price) / base_price * 100, 1) end
    from base
   order by name;
$$;

-- Making p_quantity units of a variant in the workshop: its materials are consumed and the units
-- enter stock at their cost price (materials + labor + overhead).
create or replace function public.record_production(p_variant_id uuid, p_quantity integer, p_location_id uuid,
                                                    p_note text default '', p_actor uuid default null, p_actor_email text default null)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_product uuid;
  v_ref text := 'PROD-' || to_char(now(), 'YYMMDDHH24MISS');
  v_prod uuid := gen_random_uuid();
  materials numeric := 0;
  extra numeric := 0;
  line record;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;
  select product_id into v_product from public.product_variants where id = p_variant_id and deleted_at is null;
  if v_product is null then
    raise exception 'variant_not_found';
  end if;
  if not exists (select 1 from public.product_bom where product_id = v_product and deleted_at is null) then
    raise exception 'no_bill_of_materials';
  end if;

  for line in
    select b.material_id, b.quantity, m.avg_cost
      from public.product_bom b join public.raw_materials m on m.id = b.material_id
     where b.product_id = v_product and b.deleted_at is null
  loop
    insert into public.material_movements (material_id, type, quantity, reference, note, production_id, created_by, created_by_email)
    values (line.material_id, 'consumption', -(line.quantity * p_quantity), v_ref, coalesce(p_note, ''), v_prod, p_actor, p_actor_email);
    materials := materials + line.quantity * coalesce(line.avg_cost, 0);
  end loop;
  select coalesce(labor_cost, 0) + coalesce(overhead_cost, 0) into extra
    from public.product_costing where product_id = v_product and deleted_at is null;

  insert into public.stock_movements (variant_id, location_id, type, quantity, unit_cost, reference, note, created_by, created_by_email)
  values (p_variant_id, p_location_id, 'restock', p_quantity, round(materials + coalesce(extra, 0), 3), v_ref,
          coalesce(nullif(p_note, ''), 'Production'), p_actor, p_actor_email);
  update public.products set stock_tracked = true where id = v_product and not stock_tracked;

  return jsonb_build_object('reference', v_ref, 'unit_cost', round(materials + coalesce(extra, 0), 3));
end;
$$;

-- Restocks recorded by hand can carry a unit cost (moves the average cost).
create or replace function public.record_stock_movements(
  p_type text,
  p_location_id uuid,
  p_items jsonb,
  p_to_location_id uuid default null,
  p_reference text default '',
  p_note text default '',
  p_track boolean default false,
  p_actor uuid default null,
  p_actor_email text default null
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  item jsonb;
  item_location uuid;
  qty integer;
  current_qty integer;
  delta integer;
  recorded integer := 0;
  v_ref text := coalesce(p_reference, '');
  v_note text := coalesce(p_note, '');
  v_cost numeric;
begin
  if p_type not in ('restock', 'return', 'sale', 'adjustment', 'transfer', 'count') then
    raise exception 'invalid_movement_type';
  end if;
  if p_type = 'transfer' and (p_to_location_id is null or p_to_location_id = p_location_id) then
    raise exception 'invalid_transfer';
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    qty := (item->>'quantity')::integer;
    item_location := coalesce(nullif(item->>'location_id', '')::uuid, p_location_id);
    v_cost := nullif(item->>'unit_cost', '')::numeric;

    if p_type = 'count' then
      if qty < 0 then
        raise exception 'negative_count';
      end if;
      select l.available into current_qty
        from public.inventory_levels l
       where l.variant_id = (item->>'variant_id')::uuid and l.location_id = item_location
       for update;
      delta := qty - coalesce(current_qty, 0);
      if delta <> 0 then
        insert into public.stock_movements (variant_id, location_id, type, quantity, reference, note, created_by, created_by_email)
        values ((item->>'variant_id')::uuid, item_location, 'adjustment', delta, coalesce(nullif(v_ref, ''), 'Stock count'), v_note, p_actor, p_actor_email);
        recorded := recorded + 1;
      end if;
    elsif p_type = 'transfer' then
      qty := abs(qty);
      if qty > 0 then
        insert into public.stock_movements (variant_id, location_id, type, quantity, reference, note, created_by, created_by_email)
        values ((item->>'variant_id')::uuid, item_location, 'transfer', -qty, v_ref, v_note, p_actor, p_actor_email),
               ((item->>'variant_id')::uuid, p_to_location_id, 'transfer', qty, v_ref, v_note, p_actor, p_actor_email);
        recorded := recorded + 2;
      end if;
    else
      qty := case p_type when 'sale' then -abs(qty) when 'adjustment' then qty else abs(qty) end;
      if qty <> 0 then
        insert into public.stock_movements (variant_id, location_id, type, quantity, unit_cost, reference, note, created_by, created_by_email)
        values ((item->>'variant_id')::uuid, item_location, p_type::public.stock_movement_type, qty,
                case when p_type = 'restock' then v_cost end, v_ref, v_note, p_actor, p_actor_email);
        recorded := recorded + 1;
      end if;
    end if;
  end loop;

  if p_track then
    update public.products p
       set stock_tracked = true
     where not p.stock_tracked
       and p.id in (select pv.product_id from public.product_variants pv
                     where pv.id in (select (i->>'variant_id')::uuid from jsonb_array_elements(p_items) as i));
  end if;

  return recorded;
end;
$$;

-- ---------------------------------------------------------------------------
-- Purchase orders and price requests
-- ---------------------------------------------------------------------------

create sequence public.purchase_order_seq;
create sequence public.purchase_receipt_seq;

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('PO-' || lpad(nextval('public.purchase_order_seq')::text, 5, '0')),
  supplier_id uuid not null references public.suppliers (id),
  -- rfq: price request sent, the prices are the supplier's quote.
  status text not null default 'draft'
    check (status in ('draft', 'rfq', 'ordered', 'partial', 'received', 'cancelled')),
  order_date date not null default current_date,
  expected_date date,
  location_id uuid references public.locations (id) on delete set null,
  notes text,
  subtotal numeric(14, 3) not null default 0,
  vat_amount numeric(14, 3) not null default 0,
  total numeric(14, 3) not null default 0,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index purchase_orders_supplier_idx on public.purchase_orders (supplier_id, order_date desc);

create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete set null,
  material_id uuid references public.raw_materials (id) on delete set null,
  description text not null default '',
  quantity numeric(14, 3) not null check (quantity > 0),
  unit_cost numeric(14, 4) not null default 0 check (unit_cost >= 0),
  vat_rate numeric(5, 2) not null default 19 check (vat_rate >= 0),
  received_quantity numeric(14, 3) not null default 0,
  rejected_quantity numeric(14, 3) not null default 0,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (variant_id is not null or material_id is not null or length(description) > 0)
);

create index purchase_order_lines_po_idx on public.purchase_order_lines (purchase_order_id);
create index purchase_order_lines_variant_idx on public.purchase_order_lines (variant_id) where variant_id is not null;
create index purchase_order_lines_material_idx on public.purchase_order_lines (material_id) where material_id is not null;

-- Goods arriving against a purchase order. Lines are checked (accepted / rejected) and the
-- accepted quantities only enter stock when the receipt is validated.
create table public.purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('GR-' || lpad(nextval('public.purchase_receipt_seq')::text, 5, '0')),
  purchase_order_id uuid not null references public.purchase_orders (id),
  received_on date not null default current_date,
  location_id uuid references public.locations (id),
  status text not null default 'pending' check (status in ('pending', 'validated', 'cancelled')),
  notes text,
  validated_at timestamptz,
  validated_by uuid,
  validated_by_email text,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.purchase_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.purchase_receipts (id) on delete cascade,
  po_line_id uuid not null references public.purchase_order_lines (id),
  quantity_accepted numeric(14, 3) not null default 0 check (quantity_accepted >= 0),
  quantity_rejected numeric(14, 3) not null default 0 check (quantity_rejected >= 0),
  reject_reason text,
  created_at timestamptz not null default now(),
  check (quantity_accepted + quantity_rejected > 0)
);

create index purchase_receipt_lines_receipt_idx on public.purchase_receipt_lines (receipt_id);

-- Creates (p_id null) or updates a purchase order and replaces its lines, with totals.
-- Lines already partly received can't be removed.
create or replace function public.save_purchase_order(p_id uuid, p_po jsonb, p_lines jsonb,
                                                      p_actor uuid default null, p_actor_email text default null)
returns public.purchase_orders
language plpgsql
set search_path = ''
as $$
declare
  po public.purchase_orders;
  line jsonb;
  pos integer := 0;
  keep uuid[] := '{}';
begin
  if p_id is null then
    insert into public.purchase_orders (supplier_id, status, order_date, expected_date, location_id, notes, created_by, created_by_email)
    values ((p_po->>'supplier_id')::uuid, coalesce(nullif(p_po->>'status', ''), 'draft'),
            coalesce(nullif(p_po->>'order_date', '')::date, current_date), nullif(p_po->>'expected_date', '')::date,
            nullif(p_po->>'location_id', '')::uuid, nullif(p_po->>'notes', ''), p_actor, p_actor_email)
    returning * into po;
  else
    select * into po from public.purchase_orders where id = p_id and deleted_at is null for update;
    if not found then
      raise exception 'purchase_order_not_found';
    end if;
    if po.status in ('received', 'cancelled') and p_lines is not null then
      raise exception 'purchase_order_closed';
    end if;
    update public.purchase_orders
       set supplier_id = coalesce(nullif(p_po->>'supplier_id', '')::uuid, supplier_id),
           status = coalesce(nullif(p_po->>'status', ''), status),
           order_date = coalesce(nullif(p_po->>'order_date', '')::date, order_date),
           expected_date = case when p_po ? 'expected_date' then nullif(p_po->>'expected_date', '')::date else expected_date end,
           location_id = case when p_po ? 'location_id' then nullif(p_po->>'location_id', '')::uuid else location_id end,
           notes = case when p_po ? 'notes' then nullif(p_po->>'notes', '') else notes end
     where id = p_id
    returning * into po;
  end if;

  if p_lines is not null then
    for line in select * from jsonb_array_elements(p_lines) loop
      pos := pos + 1;
      if nullif(line->>'id', '') is not null then
        update public.purchase_order_lines
           set variant_id = nullif(line->>'variant_id', '')::uuid, material_id = nullif(line->>'material_id', '')::uuid,
               description = coalesce(line->>'description', ''), quantity = (line->>'quantity')::numeric,
               unit_cost = coalesce(nullif(line->>'unit_cost', '')::numeric, 0),
               vat_rate = coalesce(nullif(line->>'vat_rate', '')::numeric, 19), position = pos
         where id = (line->>'id')::uuid and purchase_order_id = po.id;
        keep := keep || (line->>'id')::uuid;
      else
        insert into public.purchase_order_lines (purchase_order_id, variant_id, material_id, description, quantity, unit_cost, vat_rate, position)
        values (po.id, nullif(line->>'variant_id', '')::uuid, nullif(line->>'material_id', '')::uuid, coalesce(line->>'description', ''),
                (line->>'quantity')::numeric, coalesce(nullif(line->>'unit_cost', '')::numeric, 0),
                coalesce(nullif(line->>'vat_rate', '')::numeric, 19), pos)
        returning array_append(keep, id) into keep;
      end if;
    end loop;
    if exists (select 1 from public.purchase_order_lines
                where purchase_order_id = po.id and deleted_at is null and not (id = any (keep)) and received_quantity > 0) then
      raise exception 'line_already_received';
    end if;
    update public.purchase_order_lines set deleted_at = now()
     where purchase_order_id = po.id and deleted_at is null and not (id = any (keep));
  end if;

  update public.purchase_orders p
     set subtotal = t.subtotal, vat_amount = t.vat, total = t.subtotal + t.vat
    from (
      select coalesce(round(sum(quantity * unit_cost), 3), 0) as subtotal,
             coalesce(round(sum(quantity * unit_cost * vat_rate / 100), 3), 0) as vat
        from public.purchase_order_lines where purchase_order_id = po.id and deleted_at is null
    ) t
   where p.id = po.id
  returning p.* into po;
  return po;
end;
$$;

-- Records goods received (pending check), and validates them right away when p_validate.
create or replace function public.create_purchase_receipt(p_po_id uuid, p_receipt jsonb, p_lines jsonb, p_validate boolean,
                                                          p_actor uuid default null, p_actor_email text default null)
returns public.purchase_receipts
language plpgsql
set search_path = ''
as $$
declare
  po public.purchase_orders;
  rec public.purchase_receipts;
  line jsonb;
begin
  select * into po from public.purchase_orders where id = p_po_id and deleted_at is null for update;
  if not found then
    raise exception 'purchase_order_not_found';
  end if;
  if po.status in ('draft', 'rfq', 'cancelled', 'received') then
    raise exception 'purchase_order_not_open';
  end if;

  insert into public.purchase_receipts (purchase_order_id, received_on, location_id, notes, created_by, created_by_email)
  values (po.id, coalesce(nullif(p_receipt->>'received_on', '')::date, current_date),
          coalesce(nullif(p_receipt->>'location_id', '')::uuid, po.location_id), nullif(p_receipt->>'notes', ''), p_actor, p_actor_email)
  returning * into rec;

  for line in select * from jsonb_array_elements(p_lines) loop
    if coalesce((line->>'quantity_accepted')::numeric, 0) + coalesce((line->>'quantity_rejected')::numeric, 0) > 0 then
      if not exists (select 1 from public.purchase_order_lines
                      where id = (line->>'po_line_id')::uuid and purchase_order_id = po.id and deleted_at is null) then
        raise exception 'line_not_on_order';
      end if;
      insert into public.purchase_receipt_lines (receipt_id, po_line_id, quantity_accepted, quantity_rejected, reject_reason)
      values (rec.id, (line->>'po_line_id')::uuid, coalesce((line->>'quantity_accepted')::numeric, 0),
              coalesce((line->>'quantity_rejected')::numeric, 0), nullif(line->>'reject_reason', ''));
    end if;
  end loop;
  if not exists (select 1 from public.purchase_receipt_lines where receipt_id = rec.id) then
    raise exception 'receipt_empty';
  end if;

  if p_validate then
    rec := public.validate_purchase_receipt(rec.id, p_actor, p_actor_email);
  end if;
  return rec;
end;
$$;

-- Accepted goods enter stock (products at the receipt's location, materials in the workshop
-- store) at the order's unit cost; the order's received quantities and status follow.
create or replace function public.validate_purchase_receipt(p_receipt_id uuid, p_actor uuid default null, p_actor_email text default null)
returns public.purchase_receipts
language plpgsql
set search_path = ''
as $$
declare
  rec public.purchase_receipts;
  po public.purchase_orders;
  line record;
  v_location uuid;
begin
  select * into rec from public.purchase_receipts where id = p_receipt_id and deleted_at is null for update;
  if not found then
    raise exception 'receipt_not_found';
  end if;
  if rec.status <> 'pending' then
    raise exception 'receipt_not_pending';
  end if;
  select * into po from public.purchase_orders where id = rec.purchase_order_id for update;
  v_location := coalesce(rec.location_id, po.location_id);

  for line in
    select rl.*, pl.variant_id, pl.material_id, pl.unit_cost
      from public.purchase_receipt_lines rl
      join public.purchase_order_lines pl on pl.id = rl.po_line_id
     where rl.receipt_id = rec.id
  loop
    if line.quantity_accepted > 0 then
      if line.variant_id is not null then
        if v_location is null then
          raise exception 'receipt_location_required';
        end if;
        if line.quantity_accepted <> trunc(line.quantity_accepted) then
          raise exception 'product_quantity_must_be_whole';
        end if;
        insert into public.stock_movements (variant_id, location_id, type, quantity, unit_cost, reference, note, created_by, created_by_email)
        values (line.variant_id, v_location, 'restock', line.quantity_accepted::integer, round(line.unit_cost, 3),
                po.number, 'Goods receipt ' || rec.number, p_actor, p_actor_email);
        update public.products set stock_tracked = true
         where id = (select product_id from public.product_variants where id = line.variant_id) and not stock_tracked;
      elsif line.material_id is not null then
        insert into public.material_movements (material_id, type, quantity, unit_cost, reference, note, purchase_receipt_id, created_by, created_by_email)
        values (line.material_id, 'purchase', line.quantity_accepted, line.unit_cost, po.number, 'Goods receipt ' || rec.number, rec.id, p_actor, p_actor_email);
      end if;
    end if;
    update public.purchase_order_lines
       set received_quantity = received_quantity + line.quantity_accepted,
           rejected_quantity = rejected_quantity + line.quantity_rejected
     where id = line.po_line_id;
  end loop;

  update public.purchase_receipts
     set status = 'validated', validated_at = now(), validated_by = p_actor, validated_by_email = p_actor_email
   where id = rec.id
  returning * into rec;

  update public.purchase_orders p
     set status = case when not exists (
                    select 1 from public.purchase_order_lines l
                     where l.purchase_order_id = p.id and l.deleted_at is null and l.received_quantity < l.quantity)
                  then 'received' else 'partial' end
   where p.id = po.id;
  return rec;
end;
$$;

-- What each supplier asked for each item, most recent first: price requests and orders.
create or replace function public.purchase_price_comparison(p_variant_id uuid default null, p_material_id uuid default null)
returns table (
  item_key text,
  item_name text,
  supplier_id uuid,
  supplier_name text,
  last_unit_cost numeric,
  min_unit_cost numeric,
  avg_unit_cost numeric,
  times integer,
  total_quantity numeric,
  last_date date
)
language sql
stable
set search_path = ''
as $$
  with lines as (
    select coalesce('v:' || l.variant_id, 'm:' || l.material_id, 'd:' || lower(l.description)) as item_key,
           coalesce(p.name || coalesce(' · ' || nullif(v.sku, ''), ''), m.name, l.description) as item_name,
           po.supplier_id, s.name as supplier_name, l.unit_cost, l.quantity, po.order_date, po.created_at
      from public.purchase_order_lines l
      join public.purchase_orders po on po.id = l.purchase_order_id and po.deleted_at is null and po.status <> 'cancelled'
      join public.suppliers s on s.id = po.supplier_id
      left join public.product_variants v on v.id = l.variant_id
      left join public.products p on p.id = v.product_id
      left join public.raw_materials m on m.id = l.material_id
     where l.deleted_at is null
       and (p_variant_id is null or l.variant_id = p_variant_id)
       and (p_material_id is null or l.material_id = p_material_id)
  )
  select item_key, max(item_name), supplier_id, max(supplier_name),
         (array_agg(unit_cost order by order_date desc, created_at desc))[1],
         min(unit_cost), round(avg(unit_cost), 4), count(*)::integer, sum(quantity), max(order_date)
    from lines
   group by item_key, supplier_id
   order by max(item_name), min(unit_cost);
$$;

-- ---------------------------------------------------------------------------
-- Point of sale
-- ---------------------------------------------------------------------------

create sequence public.pos_session_seq;

create table public.pos_sessions (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('CS-' || lpad(nextval('public.pos_session_seq')::text, 5, '0')),
  location_id uuid not null references public.locations (id),
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  opened_by uuid,
  opened_by_email text,
  opening_float numeric(12, 3) not null default 0 check (opening_float >= 0),
  closed_at timestamptz,
  closed_by uuid,
  closed_by_email text,
  expected_cash numeric(12, 3),
  counted_cash numeric(12, 3),
  difference numeric(12, 3),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index pos_sessions_one_open_idx on public.pos_sessions (location_id) where status = 'open' and deleted_at is null;

alter table public.orders add constraint orders_pos_session_fk foreign key (pos_session_id) references public.pos_sessions (id) on delete set null;
alter table public.order_payments add constraint order_payments_pos_session_fk foreign key (pos_session_id) references public.pos_sessions (id) on delete set null;
alter table public.treasury_movements add constraint treasury_movements_pos_session_fk foreign key (pos_session_id) references public.pos_sessions (id) on delete set null;
create index orders_pos_session_idx on public.orders (pos_session_id) where pos_session_id is not null;

create or replace function public.open_pos_session(p_location_id uuid, p_opening_float numeric,
                                                   p_actor uuid default null, p_actor_email text default null)
returns public.pos_sessions
language plpgsql
set search_path = ''
as $$
declare
  s public.pos_sessions;
begin
  if exists (select 1 from public.pos_sessions where location_id = p_location_id and status = 'open' and deleted_at is null) then
    raise exception 'session_already_open';
  end if;
  insert into public.pos_sessions (location_id, opening_float, opened_by, opened_by_email)
  values (p_location_id, coalesce(p_opening_float, 0), p_actor, p_actor_email)
  returning * into s;
  return s;
end;
$$;

-- Cash that should be in the drawer: float + cash takings + cash in − cash out.
create or replace function public.pos_expected_cash(p_session_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select s.opening_float
         + coalesce((select sum(p.amount) from public.order_payments p
                      where p.pos_session_id = s.id and p.account = 'cash' and p.deleted_at is null), 0)
         + coalesce((select sum(case when m.direction = 'in' then m.amount else -m.amount end) from public.treasury_movements m
                      where m.pos_session_id = s.id and m.account = 'cash' and m.deleted_at is null and m.category <> 'pos_difference'), 0)
    from public.pos_sessions s
   where s.id = p_session_id;
$$;

-- A till sale: the order (channel store, stock from the session's shop, delivered on the spot)
-- and its payments, all together. The API prices the lines; payments must cover the total.
create or replace function public.create_pos_sale(p_session_id uuid, p_order jsonb, p_items jsonb, p_payments jsonb,
                                                  p_actor uuid default null, p_actor_email text default null)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  s public.pos_sessions;
  created jsonb;
  v_order_id uuid;
  ord public.orders;
  pay jsonb;
  paid numeric := 0;
begin
  select * into s from public.pos_sessions where id = p_session_id and deleted_at is null for update;
  if not found or s.status <> 'open' then
    raise exception 'session_not_open';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'order_items_required';
  end if;
  select coalesce(sum((x->>'amount')::numeric), 0) into paid from jsonb_array_elements(p_payments) x;
  if paid < (p_order->>'total')::numeric - 0.0005 then
    raise exception 'payment_short';
  end if;

  created := public.create_order(
    p_order || jsonb_build_object('channel', 'store', 'location_id', s.location_id, 'pos_session_id', s.id,
                                  'created_by', p_actor, 'created_by_email', p_actor_email,
                                  'assigned_to', p_actor, 'assigned_to_email', p_actor_email),
    p_items);
  v_order_id := (created->'order'->>'id')::uuid;
  perform public.set_order_status(v_order_id, '{"status": "delivered"}'::jsonb, p_actor, p_actor_email);

  for pay in select * from jsonb_array_elements(p_payments) loop
    if (pay->>'amount')::numeric <> 0 then
      insert into public.order_payments (order_id, amount, method, account, reference, pos_session_id, created_by, created_by_email)
      values (v_order_id, (pay->>'amount')::numeric, coalesce(nullif(pay->>'method', ''), 'cash'),
              case when coalesce(nullif(pay->>'method', ''), 'cash') = 'cash' then 'cash' else 'bank' end,
              nullif(pay->>'reference', ''), s.id, p_actor, p_actor_email);
    end if;
  end loop;

  select * into ord from public.orders where id = v_order_id;
  return jsonb_build_object('order', to_jsonb(ord),
    'items', coalesce((select jsonb_agg(to_jsonb(oi)) from public.order_items oi where oi.order_id = v_order_id), '[]'::jsonb));
end;
$$;

-- Closing: the counted cash is compared with what's expected; a difference is booked as a
-- cash movement so the till balance matches what's really there.
create or replace function public.close_pos_session(p_session_id uuid, p_counted numeric, p_notes text default null,
                                                    p_actor uuid default null, p_actor_email text default null)
returns public.pos_sessions
language plpgsql
set search_path = ''
as $$
declare
  s public.pos_sessions;
  expected numeric;
  diff numeric;
begin
  select * into s from public.pos_sessions where id = p_session_id and deleted_at is null for update;
  if not found or s.status <> 'open' then
    raise exception 'session_not_open';
  end if;
  expected := public.pos_expected_cash(s.id);
  diff := round(coalesce(p_counted, 0) - expected, 3);
  if diff <> 0 then
    insert into public.treasury_movements (account, direction, amount, category, label, pos_session_id, created_by, created_by_email)
    values ('cash', case when diff > 0 then 'in' else 'out' end, abs(diff), 'pos_difference',
            'Till difference ' || s.number, s.id, p_actor, p_actor_email);
  end if;
  update public.pos_sessions
     set status = 'closed', closed_at = now(), closed_by = p_actor, closed_by_email = p_actor_email,
         expected_cash = expected, counted_cash = coalesce(p_counted, 0), difference = diff, notes = nullif(p_notes, '')
   where id = s.id
  returning * into s;
  return s;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS, audit, grants
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['raw_materials', 'product_bom', 'product_costing', 'purchase_orders', 'purchase_order_lines',
                           'purchase_receipts', 'pos_sessions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()', t);
    execute format('create trigger prevent_hard_delete before delete on public.%I for each row execute function private.prevent_hard_delete()', t);
    execute format('create trigger log_activity after insert or update on public.%I for each row execute function private.log_activity()', t);
  end loop;
  foreach t in array array['material_movements', 'purchase_receipt_lines'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end;
$$;

grant usage on sequence public.purchase_order_seq, public.purchase_receipt_seq, public.pos_session_seq to service_role;

revoke all on function
  public.product_cost_prices(),
  public.record_production(uuid, integer, uuid, text, uuid, text),
  public.save_purchase_order(uuid, jsonb, jsonb, uuid, text),
  public.create_purchase_receipt(uuid, jsonb, jsonb, boolean, uuid, text),
  public.validate_purchase_receipt(uuid, uuid, text),
  public.purchase_price_comparison(uuid, uuid),
  public.open_pos_session(uuid, numeric, uuid, text),
  public.pos_expected_cash(uuid),
  public.create_pos_sale(uuid, jsonb, jsonb, jsonb, uuid, text),
  public.close_pos_session(uuid, numeric, text, uuid, text),
  public.record_stock_movements(text, uuid, jsonb, uuid, text, text, boolean, uuid, text)
  from public, anon, authenticated;
grant execute on function
  public.product_cost_prices(),
  public.record_production(uuid, integer, uuid, text, uuid, text),
  public.save_purchase_order(uuid, jsonb, jsonb, uuid, text),
  public.create_purchase_receipt(uuid, jsonb, jsonb, boolean, uuid, text),
  public.validate_purchase_receipt(uuid, uuid, text),
  public.purchase_price_comparison(uuid, uuid),
  public.open_pos_session(uuid, numeric, uuid, text),
  public.pos_expected_cash(uuid),
  public.create_pos_sale(uuid, jsonb, jsonb, jsonb, uuid, text),
  public.close_pos_session(uuid, numeric, text, uuid, text),
  public.record_stock_movements(text, uuid, jsonb, uuid, text, text, boolean, uuid, text)
  to service_role;

revoke all on function private.apply_material_movement(), private.prevent_movement_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Saving a product's costing (bill of materials, labor, overhead) in one go
-- ---------------------------------------------------------------------------

-- p_bom: the full list [{material_id, quantity}]; materials no longer listed are removed.
create or replace function public.save_product_costing(p_product_id uuid, p_labor numeric, p_overhead numeric,
                                                       p_notes text, p_bom jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  line jsonb;
  keep uuid[] := '{}';
begin
  if not exists (select 1 from public.products where id = p_product_id and deleted_at is null) then
    raise exception 'product_not_found';
  end if;
  insert into public.product_costing (product_id, labor_cost, overhead_cost, notes)
  values (p_product_id, coalesce(p_labor, 0), coalesce(p_overhead, 0), nullif(p_notes, ''))
  on conflict (product_id) do update
    set labor_cost = excluded.labor_cost, overhead_cost = excluded.overhead_cost, notes = excluded.notes, deleted_at = null;

  for line in select * from jsonb_array_elements(coalesce(p_bom, '[]'::jsonb)) loop
    keep := keep || (line->>'material_id')::uuid;
    update public.product_bom set quantity = (line->>'quantity')::numeric
     where product_id = p_product_id and material_id = (line->>'material_id')::uuid and deleted_at is null;
    if not found then
      insert into public.product_bom (product_id, material_id, quantity)
      values (p_product_id, (line->>'material_id')::uuid, (line->>'quantity')::numeric);
    end if;
  end loop;
  update public.product_bom set deleted_at = now()
   where product_id = p_product_id and deleted_at is null and not (material_id = any (keep));

  -- A product made in the workshop costs its materials + labor + overhead: that becomes its
  -- purchase cost, the one cost margins and statistics use.
  if exists (select 1 from public.product_bom where product_id = p_product_id and deleted_at is null) then
    insert into public.product_costs (product_id, cost)
    select p_product_id, round(coalesce(sum(b.quantity * coalesce(m.avg_cost, 0)), 0) + coalesce(p_labor, 0) + coalesce(p_overhead, 0), 3)
      from public.product_bom b join public.raw_materials m on m.id = b.material_id
     where b.product_id = p_product_id and b.deleted_at is null
    on conflict (product_id) do update set cost = excluded.cost, deleted_at = null, updated_at = now();
  end if;
end;
$$;

revoke all on function public.save_product_costing(uuid, numeric, numeric, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_product_costing(uuid, numeric, numeric, text, jsonb) to service_role;
