-- ERP, part 1: sales pipeline, customers (CRM), payments, campaigns, goals and stock costs.
--
-- * Orders now record where they came from (channel, campaign), who handles them (assigned_to),
--   and each step on its own: confirmed (customer called back), validated (parcel created),
--   shipped, delivered, returned, cancelled. Being delivered is not being paid: money received is
--   one row per payment in order_payments, and orders.paid_amount / payment_status follow them.
-- * customers: one row per phone number, created from orders automatically; conversations
--   (customer_interactions) and reminders (crm_tasks) hang off it.
-- * Stock is valued at weighted average cost (CMUP): restocks carry a unit cost that updates
--   product_variants.avg_cost; every other movement and every order line records the cost in force.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Tunisian numbers keep their 8 digits (+216 / 00216 dropped); anything else keeps its digits.
create or replace function public.normalize_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(case
    when d ~ '^00216\d{8}$' then substr(d, 6)
    when d ~ '^216\d{8}$' then substr(d, 4)
    else d
  end, '')
  from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d) s;
$$;

grant execute on function public.normalize_phone(text) to anon, authenticated, service_role;

-- Settings of the back office that the storefront must not read (accounting, POS rules...).
create table public.erp_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.erp_settings enable row level security;
revoke all on public.erp_settings from anon, authenticated;
grant all on public.erp_settings to service_role;

create trigger set_updated_at before update on public.erp_settings
  for each row execute function private.set_updated_at();
create trigger log_activity after insert or update on public.erp_settings
  for each row execute function private.log_activity();

insert into public.erp_settings (key, value) values
  ('sales', jsonb_build_object(
     'pending_alert_hours', 24,       -- an order still unconfirmed after this long raises an alert
     'late_delivery_days', 6,         -- a parcel still moving after this long raises an alert
     'duplicate_window_days', 30      -- open orders from the same phone in this window are flagged
  )),
  ('pos', jsonb_build_object(
     'max_discount_percent', 10       -- staff can't give more than this at the till (owners/admins can)
  ));

-- ---------------------------------------------------------------------------
-- Campaigns and ad spend (Marketing)
-- ---------------------------------------------------------------------------

create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  platform text not null default 'facebook'
    check (platform in ('facebook', 'instagram', 'tiktok', 'google', 'whatsapp', 'influencer', 'other')),
  starts_on date,
  ends_on date,
  budget numeric(12, 3) check (budget >= 0),
  notes text,
  active boolean not null default true,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- What was spent, per day or per invoice. `account` is how it was paid: card/bank, cash, or still
-- owed (payable). It posts to the advertising account.
create table public.ad_spend (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.ad_campaigns (id) on delete set null,
  spend_date date not null default current_date,
  amount numeric(12, 3) not null check (amount > 0),
  account text not null default 'bank' check (account in ('bank', 'cash', 'payable')),
  note text,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index ad_spend_date_idx on public.ad_spend (spend_date) where deleted_at is null;
create index ad_spend_campaign_idx on public.ad_spend (campaign_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Customers (CRM)
-- ---------------------------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  -- Normalized (normalize_phone). Null only for contacts that wrote in on Messenger/Instagram
  -- without leaving a number yet.
  phone text,
  phone_alt text,
  full_name text not null default '',
  email text,
  governorate text,
  city text,
  address text,
  -- First channel the customer reached us through.
  channel text not null default 'website'
    check (channel in ('website', 'facebook', 'instagram', 'tiktok', 'whatsapp', 'phone', 'store', 'other')),
  -- Sales pipeline. new/interested are set by hand; later stages follow the customer's latest order.
  stage text not null default 'new'
    check (stage in ('new', 'interested', 'to_confirm', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  assigned_to uuid,
  assigned_to_email text,
  tags text[] not null default '{}',
  notes text,
  user_id uuid references auth.users (id) on delete set null,
  -- Ids on messaging platforms: {"messenger": "<psid>", "instagram": "<igsid>", "whatsapp": "<wa_id>"}.
  external_ids jsonb not null default '{}'::jsonb,
  anonymized_at timestamptz,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index customers_phone_live_idx on public.customers (phone) where deleted_at is null and phone is not null;
create index customers_assigned_idx on public.customers (assigned_to) where deleted_at is null;
create index customers_stage_idx on public.customers (stage) where deleted_at is null;
create index customers_created_at_idx on public.customers (created_at desc);
create index customers_external_ids_idx on public.customers using gin (external_ids);

-- Conversations: messages received/sent on a channel, calls and notes typed by agents.
create table public.customer_interactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  channel text not null default 'phone'
    check (channel in ('website', 'facebook', 'instagram', 'tiktok', 'whatsapp', 'phone', 'store', 'email', 'other')),
  direction text not null default 'note' check (direction in ('in', 'out', 'note')),
  body text not null check (length(body) > 0),
  order_id uuid references public.orders (id) on delete set null,
  -- Messages synced from Meta's APIs (Messenger, Instagram Direct, WhatsApp Cloud).
  external_id text,
  sender_name text,
  read_at timestamptz,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index customer_interactions_customer_idx on public.customer_interactions (customer_id, created_at desc);
-- Plain (not partial) so webhook upserts can target it; rows without an external id never clash.
create unique index customer_interactions_external_idx on public.customer_interactions (channel, external_id);
create index customer_interactions_unread_idx on public.customer_interactions (created_at desc)
  where direction = 'in' and read_at is null and deleted_at is null;

-- Follow-ups and reminders for agents.
create table public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  notes text,
  due_at timestamptz not null,
  assigned_to uuid,
  assigned_to_email text,
  done_at timestamptz,
  done_by uuid,
  reminded_at timestamptz,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index crm_tasks_open_idx on public.crm_tasks (assigned_to, due_at) where done_at is null and deleted_at is null;
create index crm_tasks_customer_idx on public.crm_tasks (customer_id);

-- ---------------------------------------------------------------------------
-- Orders: channel, campaign, customer, assignment, stages, location
-- ---------------------------------------------------------------------------

alter table public.orders
  add column channel text not null default 'website'
    check (channel in ('website', 'facebook', 'instagram', 'tiktok', 'whatsapp', 'phone', 'store', 'other')),
  add column campaign_id uuid references public.ad_campaigns (id) on delete set null,
  add column customer_id uuid references public.customers (id) on delete set null,
  add column assigned_to uuid,
  add column assigned_to_email text,
  add column assigned_at timestamptz,
  add column confirmed_at timestamptz,
  add column confirmed_by uuid,
  add column confirmed_by_email text,
  add column delivered_at timestamptz,
  add column returned_at timestamptz,
  add column cancelled_at timestamptz,
  -- Discount given on the whole order (till, phone orders). Line prices are already discounted
  -- product prices; subtotal is the lines, total = subtotal - discount_amount + shipping_cost.
  add column discount_amount numeric(12, 3) not null default 0 check (discount_amount >= 0),
  -- Where the stock comes from: the online location when null (website and phone orders),
  -- the shop for till sales.
  add column location_id uuid references public.locations (id) on delete set null,
  add column pos_session_id uuid,
  add column paid_amount numeric(12, 3) not null default 0;

alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'returned', 'cancelled'));
alter table public.orders drop constraint orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('pending', 'partial', 'paid', 'failed', 'refunded'));

create index orders_channel_created_idx on public.orders (channel, created_at desc);
create index orders_customer_idx on public.orders (customer_id);
create index orders_assigned_idx on public.orders (assigned_to, created_at desc) where assigned_to is not null;
create index orders_campaign_idx on public.orders (campaign_id) where campaign_id is not null;
create index orders_delivered_at_idx on public.orders (delivered_at) where delivered_at is not null;
create index orders_phone_idx on public.orders (public.normalize_phone(customer_phone));

-- Orders so far: website ones have no author; the others were typed in by an agent (phone/social).
update public.orders set channel = 'other' where created_by is not null;
update public.orders set assigned_to = created_by, assigned_to_email = created_by_email, assigned_at = created_at
 where created_by is not null;
update public.orders set confirmed_at = coalesce(confirmed_at, updated_at)
 where status in ('processing', 'shipped', 'delivered');
update public.orders set delivered_at = updated_at where status = 'delivered';
update public.orders set cancelled_at = updated_at where status = 'cancelled';
update public.orders o set returned_at = d.status_changed_at, status = 'returned'
  from public.deliveries d
 where d.order_id = o.id and d.deleted_at is null and o.deleted_at is null
   and d.status in ('Retour definitif', 'Retour paye', 'Retour recu paye')
   and o.status not in ('delivered', 'cancelled', 'returned');

-- ---------------------------------------------------------------------------
-- Stock cost (weighted average, CMUP)
-- ---------------------------------------------------------------------------

alter table public.product_variants add column avg_cost numeric(12, 3) check (avg_cost >= 0);
alter table public.stock_movements add column unit_cost numeric(12, 3) check (unit_cost >= 0);
alter table public.order_items add column unit_cost numeric(12, 3) check (unit_cost >= 0);

-- Start from the purchase cost entered per product.
update public.product_variants v set avg_cost = pc.cost
  from public.product_costs pc
 where pc.product_id = v.product_id and pc.deleted_at is null and v.avg_cost is null;

-- Cost in force for a variant: the purchase cost entered on its product (the reference for
-- margins and statistics), else the running average of its restocks.
create or replace function public.variant_unit_cost(p_variant_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(pc.cost, v.avg_cost)
    from public.product_variants v
    left join public.product_costs pc on pc.product_id = v.product_id and pc.deleted_at is null
   where v.id = p_variant_id;
$$;

-- Runs after stock_movements_apply (triggers fire in name order), so inventory_levels already
-- include this movement. A restock with a unit cost moves the variant's running average
-- (the fallback cost for products without a purchase cost):
--   new avg = (units before × avg + units in × cost) / (units before + units in)
-- Other movements record the cost in force (the cost of what left or came back).
create or replace function private.stock_movement_cost()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  units_after integer;
  units_before integer;
  avg_now numeric;
begin
  if new.type = 'restock' and new.unit_cost is not null then
    select avg_cost into avg_now from public.product_variants where id = new.variant_id;
    select coalesce(sum(available), 0) into units_after from public.inventory_levels where variant_id = new.variant_id;
    units_before := units_after - new.quantity;
    update public.product_variants
       set avg_cost = case
             when avg_now is null or units_before <= 0 then new.unit_cost
             else round((units_before * avg_now + new.quantity * new.unit_cost) / (units_before + new.quantity), 3)
           end
     where id = new.variant_id;
  else
    new.unit_cost := coalesce(new.unit_cost, public.variant_unit_cost(new.variant_id));
  end if;
  return new;
end;
$$;

create trigger stock_movements_cost
  before insert on public.stock_movements
  for each row execute function private.stock_movement_cost();

-- Order lines keep the product's cost when the order was taken (gross margin).
create or replace function private.set_order_item_cost()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.unit_cost is null then
    if new.variant_id is not null then
      new.unit_cost := public.variant_unit_cost(new.variant_id);
    elsif new.product_id is not null then
      select coalesce(
               (select pc.cost from public.product_costs pc where pc.product_id = new.product_id and pc.deleted_at is null),
               (select avg(v.avg_cost) from public.product_variants v where v.product_id = new.product_id and v.avg_cost is not null))
        into new.unit_cost;
    end if;
  end if;
  return new;
end;
$$;

-- When a product gets its purchase cost, its order lines that had none take it, so margins
-- and statistics cover past orders too. A changed cost doesn't rewrite lines that had one.
create or replace function private.fill_order_item_costs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is null and new.cost is not null then
    update public.order_items set unit_cost = new.cost
     where product_id = new.product_id and unit_cost is null;
  end if;
  return null;
end;
$$;

revoke all on function private.fill_order_item_costs() from public, anon, authenticated;

create trigger product_costs_fill_order_items
  after insert or update of cost, deleted_at on public.product_costs
  for each row execute function private.fill_order_item_costs();

create trigger order_items_cost
  before insert on public.order_items
  for each row execute function private.set_order_item_cost();

update public.order_items oi
   set unit_cost = coalesce((select pc.cost from public.product_costs pc where pc.product_id = oi.product_id and pc.deleted_at is null),
                            public.variant_unit_cost(oi.variant_id))
 where oi.unit_cost is null;

-- Stock value per variant and location at the cost in force.
create or replace function public.stock_valuation()
returns table (
  variant_id uuid,
  product_id uuid,
  product_name text,
  sku text,
  location_id uuid,
  units integer,
  unit_cost numeric,
  value numeric
)
language sql
stable
set search_path = ''
as $$
  select v.id, p.id, p.name, v.sku, il.location_id, il.available,
         public.variant_unit_cost(v.id),
         round(il.available * coalesce(public.variant_unit_cost(v.id), 0), 3)
    from public.inventory_levels il
    join public.product_variants v on v.id = il.variant_id and v.deleted_at is null
    join public.products p on p.id = v.product_id and p.deleted_at is null
    join public.locations l on l.id = il.location_id and l.deleted_at is null
   where il.available > 0;
$$;

-- ---------------------------------------------------------------------------
-- Payments received and carrier payouts
-- ---------------------------------------------------------------------------

-- A payout from the delivery company: the cash it collected for a batch of parcels, less its fees,
-- arriving in the bank (or cash).
create table public.cod_remittances (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'colissimo',
  reference text,
  received_on date not null default current_date,
  gross_amount numeric(12, 3) not null check (gross_amount >= 0),
  fees numeric(12, 3) not null default 0 check (fees >= 0),
  net_amount numeric(12, 3) generated always as (gross_amount - fees) stored,
  account text not null default 'bank' check (account in ('bank', 'cash')),
  note text,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Money received for an order (negative amount: a refund). `account` is where the money is now:
-- the till (cash), the bank, or still held by the delivery company (carrier) until it pays out.
create table public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  amount numeric(12, 3) not null check (amount <> 0),
  method text not null default 'cash'
    check (method in ('cash', 'card', 'bank_transfer', 'check', 'cod', 'mobile', 'other')),
  account text not null default 'cash' check (account in ('cash', 'bank', 'carrier')),
  received_at timestamptz not null default now(),
  reference text,
  note text,
  remittance_id uuid references public.cod_remittances (id) on delete set null,
  pos_session_id uuid,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index order_payments_order_idx on public.order_payments (order_id);
create index order_payments_received_idx on public.order_payments (received_at) where deleted_at is null;
create index order_payments_carrier_open_idx on public.order_payments (order_id)
  where account = 'carrier' and remittance_id is null and deleted_at is null;

-- orders.paid_amount and payment_status follow the live payments.
create or replace function private.refresh_order_paid(p_order_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  paid numeric;
  any_refund boolean;
begin
  select coalesce(sum(amount), 0), bool_or(amount < 0) into paid, any_refund
    from public.order_payments where order_id = p_order_id and deleted_at is null;
  update public.orders o
     set paid_amount = paid,
         payment_status = case
           when paid >= o.total - 0.0005 and o.total > 0 then 'paid'
           when paid > 0 then 'partial'
           when any_refund then 'refunded'
           when o.payment_status in ('paid', 'partial') then 'pending'
           else o.payment_status
         end,
         updated_at = now()
   where o.id = p_order_id
     and (o.paid_amount is distinct from paid or o.payment_status is distinct from case
           when paid >= o.total - 0.0005 and o.total > 0 then 'paid'
           when paid > 0 then 'partial'
           when any_refund then 'refunded'
           when o.payment_status in ('paid', 'partial') then 'pending'
           else o.payment_status
         end);
end;
$$;

create or replace function private.on_order_payment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_order_paid(new.order_id);
  if tg_op = 'UPDATE' and old.order_id <> new.order_id then
    perform private.refresh_order_paid(old.order_id);
  end if;
  return null;
end;
$$;

create trigger order_payments_refresh
  after insert or update on public.order_payments
  for each row execute function private.on_order_payment_change();

-- Orders already marked paid (Colissimo "Livre paye") get the matching payment, held as paid out.
insert into public.order_payments (order_id, amount, method, account, received_at, note)
select o.id, o.total, 'cod', 'bank', o.updated_at, 'Recorded before payments were tracked'
  from public.orders o
 where o.payment_status = 'paid' and o.total > 0 and o.deleted_at is null;

-- Records a carrier payout and marks the given carrier payments as paid out, together.
create or replace function public.record_remittance(p_remittance jsonb, p_payment_ids uuid[],
                                                    p_actor uuid default null, p_actor_email text default null)
returns public.cod_remittances
language plpgsql
set search_path = ''
as $$
declare
  row public.cod_remittances;
  linked integer;
begin
  insert into public.cod_remittances (provider, reference, received_on, gross_amount, fees, account, note, created_by, created_by_email)
  values (coalesce(nullif(p_remittance->>'provider', ''), 'colissimo'), nullif(p_remittance->>'reference', ''),
          coalesce(nullif(p_remittance->>'received_on', '')::date, current_date),
          (p_remittance->>'gross_amount')::numeric, coalesce(nullif(p_remittance->>'fees', '')::numeric, 0),
          coalesce(nullif(p_remittance->>'account', ''), 'bank'), nullif(p_remittance->>'note', ''), p_actor, p_actor_email)
  returning * into row;

  update public.order_payments
     set remittance_id = row.id, updated_at = now()
   where id = any (coalesce(p_payment_ids, '{}')) and account = 'carrier' and remittance_id is null and deleted_at is null;
  get diagnostics linked = row_count;
  if linked <> coalesce(cardinality(p_payment_ids), 0) then
    raise exception 'payments_not_open';
  end if;
  return row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Treasury movements (cash and bank in/out that aren't order payments or bills)
-- ---------------------------------------------------------------------------

create table public.treasury_movements (
  id uuid primary key default gen_random_uuid(),
  account text not null check (account in ('cash', 'bank')),
  direction text not null check (direction in ('in', 'out')),
  amount numeric(12, 3) not null check (amount > 0),
  category text not null default 'other'
    check (category in ('opening_balance', 'owner_contribution', 'owner_withdrawal', 'transfer', 'loan',
                        'loan_repayment', 'other_income', 'other_expense', 'pos_difference', 'other')),
  occurred_on date not null default current_date,
  label text not null default '',
  reference text,
  pos_session_id uuid,
  -- The other side of a transfer between cash and bank.
  transfer_id uuid,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index treasury_movements_date_idx on public.treasury_movements (occurred_on) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Objectives and commissions
-- ---------------------------------------------------------------------------

create table public.agent_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  user_email text,
  month date not null check (extract(day from month) = 1),
  target_orders integer check (target_orders >= 0),
  target_confirmed integer check (target_confirmed >= 0),
  target_delivered integer check (target_delivered >= 0),
  target_revenue numeric(12, 3) check (target_revenue >= 0),
  -- percent: % of delivered revenue; per_order: amount per delivered order.
  commission_type text not null default 'none' check (commission_type in ('none', 'percent', 'per_order')),
  commission_value numeric(12, 3) not null default 0 check (commission_value >= 0),
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index agent_goals_user_month_idx on public.agent_goals (user_id, month) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Common triggers, RLS (service role only), audit
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['ad_campaigns', 'ad_spend', 'customers', 'customer_interactions', 'crm_tasks',
                           'cod_remittances', 'order_payments', 'treasury_movements', 'agent_goals'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()', t);
    execute format('create trigger prevent_hard_delete before delete on public.%I for each row execute function private.prevent_hard_delete()', t);
    execute format('create trigger log_activity after insert or update on public.%I for each row execute function private.log_activity()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Customers from orders
-- ---------------------------------------------------------------------------

-- Each order is linked to the customer with the same phone, who is created when new.
create or replace function private.link_order_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := public.normalize_phone(new.customer_phone);
  v_id uuid;
begin
  if new.customer_id is not null or v_phone is null then
    return new;
  end if;
  select id into v_id from public.customers where phone = v_phone and deleted_at is null;
  if v_id is null then
    insert into public.customers (phone, full_name, email, governorate, city, address, channel, stage,
                                  assigned_to, assigned_to_email, user_id, created_by, created_by_email)
    values (v_phone, trim(concat_ws(' ', new.customer_first_name, new.customer_last_name)), new.customer_email,
            new.shipping_state, new.shipping_city, new.shipping_address, new.channel, 'to_confirm',
            new.assigned_to, new.assigned_to_email, new.user_id, new.created_by, new.created_by_email)
    on conflict (phone) where deleted_at is null and phone is not null do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.customers where phone = v_phone and deleted_at is null;
    end if;
  else
    -- Fill in what the customer record is missing.
    update public.customers c
       set email = coalesce(c.email, new.customer_email),
           governorate = coalesce(c.governorate, new.shipping_state),
           city = coalesce(c.city, new.shipping_city),
           address = coalesce(c.address, new.shipping_address),
           user_id = coalesce(c.user_id, new.user_id),
           full_name = case when c.full_name = '' then trim(concat_ws(' ', new.customer_first_name, new.customer_last_name)) else c.full_name end
     where c.id = v_id;
  end if;
  new.customer_id := v_id;
  return new;
end;
$$;

create trigger orders_link_customer
  before insert on public.orders
  for each row execute function private.link_order_customer();

-- Existing orders: one customer per phone, named after their latest order.
insert into public.customers (phone, full_name, email, governorate, city, address, channel, stage, user_id, created_at)
select distinct on (public.normalize_phone(o.customer_phone))
       public.normalize_phone(o.customer_phone),
       trim(concat_ws(' ', o.customer_first_name, o.customer_last_name)), o.customer_email,
       o.shipping_state, o.shipping_city, o.shipping_address, o.channel,
       case o.status
         when 'pending' then 'to_confirm' when 'confirmed' then 'confirmed' when 'processing' then 'confirmed'
         when 'shipped' then 'shipped' when 'delivered' then 'delivered' else 'cancelled' end,
       o.user_id,
       (select min(o2.created_at) from public.orders o2 where public.normalize_phone(o2.customer_phone) = public.normalize_phone(o.customer_phone))
  from public.orders o
 where public.normalize_phone(o.customer_phone) is not null
 order by public.normalize_phone(o.customer_phone), o.created_at desc
on conflict do nothing;

update public.orders o set customer_id = c.id
  from public.customers c
 where c.phone = public.normalize_phone(o.customer_phone) and c.deleted_at is null and o.customer_id is null;

-- A customer's stage follows their latest order (new/interested stay manual until they order).
create or replace function private.sync_customer_stage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.customer_id is null or new.deleted_at is not null then
    return null;
  end if;
  if exists (select 1 from public.orders o
              where o.customer_id = new.customer_id and o.deleted_at is null and o.created_at > new.created_at) then
    return null; -- an older order changed; the latest one decides
  end if;
  update public.customers c
     set stage = case new.status
           when 'pending' then 'to_confirm'
           when 'confirmed' then 'confirmed'
           when 'processing' then 'confirmed'
           when 'shipped' then 'shipped'
           when 'delivered' then 'delivered'
           else 'cancelled'
         end
   where c.id = new.customer_id and c.deleted_at is null;
  return null;
end;
$$;

create trigger orders_sync_customer_stage
  after insert or update of status on public.orders
  for each row execute function private.sync_customer_stage();

-- Open orders (not finished) from the same phone, newest first: possible duplicates.
create or replace function public.find_order_duplicates(p_phone text, p_exclude uuid default null, p_days integer default 30)
returns table (id uuid, order_number text, status text, total numeric, created_at timestamptz, channel text,
               customer_first_name text, customer_last_name text)
language sql
stable
set search_path = ''
as $$
  select o.id, o.order_number, o.status, o.total, o.created_at, o.channel, o.customer_first_name, o.customer_last_name
    from public.orders o
   where public.normalize_phone(o.customer_phone) = public.normalize_phone(p_phone)
     and o.deleted_at is null
     and o.id is distinct from p_exclude
     and o.status in ('pending', 'confirmed', 'processing', 'shipped')
     and o.created_at > now() - make_interval(days => greatest(p_days, 1))
   order by o.created_at desc;
$$;

-- Customer records that look like the same person: same e-mail, same second phone, or same
-- name in the same city.
create or replace function public.find_customer_duplicates()
returns table (customer_id uuid, duplicate_id uuid, reason text)
language sql
stable
set search_path = ''
as $$
  select a.id, b.id,
         case when lower(a.email) = lower(b.email) then 'email'
              when a.phone_alt is not null and (a.phone_alt = b.phone or a.phone_alt = b.phone_alt) then 'phone'
              else 'name' end
    from public.customers a
    join public.customers b on b.id > a.id and b.deleted_at is null
   where a.deleted_at is null
     and (
       (a.email is not null and lower(a.email) = lower(b.email))
       or (a.phone_alt is not null and (a.phone_alt = b.phone or a.phone_alt = b.phone_alt))
       or (b.phone_alt is not null and b.phone_alt = a.phone)
       or (a.full_name <> '' and lower(a.full_name) = lower(b.full_name) and lower(coalesce(a.city, '')) = lower(coalesce(b.city, '')))
     )
   limit 500;
$$;

-- Keeps p_keep and moves p_remove's orders, conversations and tasks onto it; p_remove is deleted.
create or replace function public.merge_customers(p_keep uuid, p_remove uuid)
returns public.customers
language plpgsql
set search_path = ''
as $$
declare
  kept public.customers;
  gone public.customers;
begin
  if p_keep = p_remove then
    raise exception 'same_customer';
  end if;
  select * into kept from public.customers where id = p_keep and deleted_at is null for update;
  select * into gone from public.customers where id = p_remove and deleted_at is null for update;
  if kept.id is null or gone.id is null then
    raise exception 'customer_not_found';
  end if;
  update public.orders set customer_id = p_keep where customer_id = p_remove;
  update public.customer_interactions set customer_id = p_keep where customer_id = p_remove;
  update public.crm_tasks set customer_id = p_keep where customer_id = p_remove;
  update public.customers set deleted_at = now(), notes = concat_ws(E'\n', notes, 'Merged into ' || p_keep::text)
   where id = p_remove;
  update public.customers
     set phone_alt = coalesce(phone_alt, case when gone.phone is distinct from kept.phone then gone.phone end),
         email = coalesce(email, gone.email),
         governorate = coalesce(governorate, gone.governorate),
         city = coalesce(city, gone.city),
         address = coalesce(address, gone.address),
         tags = (select coalesce(array_agg(distinct t), '{}') from unnest(tags || gone.tags) t),
         external_ids = gone.external_ids || external_ids,
         notes = concat_ws(E'\n', notes, gone.notes)
   where id = p_keep
  returning * into kept;
  return kept;
end;
$$;

-- Personal data erased on request (Tunisian law 2004-63). Orders keep their amounts and lines
-- for the accounts; their names, phone and address are blanked once they're finished.
create or replace function public.anonymize_customer(p_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.orders where customer_id = p_id and deleted_at is null
               and status in ('pending', 'confirmed', 'processing', 'shipped')) then
    raise exception 'customer_has_open_orders';
  end if;
  update public.customers
     set phone = null, phone_alt = null, full_name = 'Anonymized', email = null, address = null,
         notes = null, external_ids = '{}'::jsonb, tags = '{}', anonymized_at = now()
   where id = p_id;
  update public.orders
     set customer_first_name = 'Anonymized', customer_last_name = '', customer_phone = '00000000',
         customer_email = null, shipping_address = null, order_notes = null
   where customer_id = p_id;
  update public.customer_interactions set body = '—', sender_name = null where customer_id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Orders: creation, statuses, stock location
-- ---------------------------------------------------------------------------

-- As before, plus the new order fields (channel, campaign, agent, till...). Everything the API
-- doesn't send keeps its default.
create or replace function public.create_order(p_order jsonb, p_items jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  ord public.orders;
begin
  insert into public.orders (
    order_number, user_id, customer_email, customer_first_name, customer_last_name, customer_phone,
    shipping_address, shipping_city, shipping_state, shipping_zip, shipping_country,
    subtotal, shipping_cost, total, order_notes, status, payment_status,
    channel, campaign_id, customer_id, assigned_to, assigned_to_email, assigned_at,
    created_by, created_by_email, discount_amount, location_id, pos_session_id
  ) values (
    p_order->>'order_number', nullif(p_order->>'user_id', '')::uuid, nullif(p_order->>'customer_email', ''),
    p_order->>'customer_first_name', p_order->>'customer_last_name', p_order->>'customer_phone',
    nullif(p_order->>'shipping_address', ''), nullif(p_order->>'shipping_city', ''), nullif(p_order->>'shipping_state', ''),
    nullif(p_order->>'shipping_zip', ''), nullif(p_order->>'shipping_country', ''),
    (p_order->>'subtotal')::numeric, (p_order->>'shipping_cost')::numeric, (p_order->>'total')::numeric,
    nullif(p_order->>'order_notes', ''), 'pending', 'pending',
    coalesce(nullif(p_order->>'channel', ''), 'website'), nullif(p_order->>'campaign_id', '')::uuid,
    nullif(p_order->>'customer_id', '')::uuid,
    nullif(p_order->>'assigned_to', '')::uuid, nullif(p_order->>'assigned_to_email', ''),
    case when nullif(p_order->>'assigned_to', '') is not null then now() end,
    nullif(p_order->>'created_by', '')::uuid, nullif(p_order->>'created_by_email', ''),
    coalesce(nullif(p_order->>'discount_amount', '')::numeric, 0),
    nullif(p_order->>'location_id', '')::uuid, nullif(p_order->>'pos_session_id', '')::uuid
  )
  returning * into ord;

  insert into public.order_items (
    order_id, product_id, variant_id, variant_label, product_name, product_name_ar, product_name_fr,
    product_image, quantity, price, subtotal
  )
  select ord.id, i.product_id, i.variant_id, i.variant_label, i.product_name, i.product_name_ar, i.product_name_fr,
         i.product_image, i.quantity, i.price, i.subtotal
    from jsonb_to_recordset(p_items) as i (
      product_id uuid, variant_id uuid, variant_label text, product_name text, product_name_ar text,
      product_name_fr text, product_image text, quantity integer, price numeric, subtotal numeric
    );

  return jsonb_build_object(
    'order', to_jsonb(ord),
    'items', coalesce((select jsonb_agg(to_jsonb(oi)) from public.order_items oi where oi.order_id = ord.id), '[]'::jsonb)
  );
end;
$$;

-- Stock leaves the order's own location (the shop for till sales), else the online one.
create or replace function public.apply_order_stock(p_order_id uuid, p_direction text, p_actor uuid default null, p_actor_email text default null)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  ord public.orders;
  source_location uuid;
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
    source_location := ord.location_id;
    if source_location is null then
      select id into source_location from public.locations where sells_online;
    end if;
    if source_location is null then
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
       where variant_id = item.variant_id and location_id = source_location
         for update;
      take := least(item.quantity, greatest(coalesce(on_hand, 0), 0));
      if take > 0 then
        insert into public.stock_movements (variant_id, location_id, type, quantity, reference, order_id, created_by, created_by_email)
        values (item.variant_id, source_location, 'sale', -take, ord.order_number, p_order_id, p_actor, p_actor_email);
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

-- Status / payment status / notes, plus the stock movement and the date of each stage.
--   pending → confirmed (customer agreed) → processing (validated: parcel created, stock out)
--   → shipped → delivered; or returned (parcel came back: stock back) / cancelled.
create or replace function public.set_order_status(p_order_id uuid, p_changes jsonb, p_actor uuid default null, p_actor_email text default null)
returns public.orders
language plpgsql
set search_path = ''
as $$
declare
  new_status text := nullif(p_changes->>'status', '');
  ord public.orders;
begin
  if new_status is not null and new_status not in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'returned', 'cancelled') then
    raise exception 'invalid_status';
  end if;
  if new_status in ('processing', 'shipped', 'delivered') then
    perform public.apply_order_stock(p_order_id, 'deduct', p_actor, p_actor_email);
  elsif new_status in ('pending', 'confirmed', 'returned', 'cancelled') then
    perform public.apply_order_stock(p_order_id, 'restore', p_actor, p_actor_email);
  end if;

  update public.orders
     set status = coalesce(new_status, status),
         payment_status = case when p_changes ? 'payment_status' then p_changes->>'payment_status' else payment_status end,
         order_notes = case when p_changes ? 'order_notes' then nullif(p_changes->>'order_notes', '') else order_notes end,
         confirmed_at = case
           when new_status in ('confirmed', 'processing', 'shipped', 'delivered') then coalesce(confirmed_at, now())
           when new_status = 'pending' then null
           else confirmed_at end,
         confirmed_by = case
           when new_status in ('confirmed', 'processing', 'shipped', 'delivered') and confirmed_at is null then p_actor
           when new_status = 'pending' then null
           else confirmed_by end,
         confirmed_by_email = case
           when new_status in ('confirmed', 'processing', 'shipped', 'delivered') and confirmed_at is null then p_actor_email
           when new_status = 'pending' then null
           else confirmed_by_email end,
         delivered_at = case
           when new_status = 'delivered' then coalesce(delivered_at, now())
           when new_status is not null then null
           else delivered_at end,
         returned_at = case
           when new_status = 'returned' then coalesce(returned_at, now())
           when new_status is not null then null
           else returned_at end,
         cancelled_at = case
           when new_status = 'cancelled' then coalesce(cancelled_at, now())
           when new_status is not null then null
           else cancelled_at end,
         updated_at = now()
   where id = p_order_id
  returning * into ord;

  if not found then
    raise exception 'order_not_found';
  end if;
  return ord;
end;
$$;

-- Assigns orders to an agent (null: unassigns).
create or replace function public.assign_orders(p_order_ids uuid[], p_user uuid, p_user_email text)
returns integer
language sql
set search_path = ''
as $$
  with changed as (
    update public.orders
       set assigned_to = p_user, assigned_to_email = case when p_user is null then null else p_user_email end,
           assigned_at = case when p_user is null then null else now() end, updated_at = now()
     where id = any (p_order_ids) and deleted_at is null and assigned_to is distinct from p_user
    returning 1
  )
  select count(*)::integer from changed;
$$;

-- Parcels can be sent for pending and confirmed orders.
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
    if ord.status in ('pending', 'confirmed') then
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

-- Tracking: picked up → shipped; delivered → delivered; "Livre paye" (Colissimo paid the cash
-- out) → the cash still owed is recorded as a payment held by the carrier until the payout is
-- entered; a parcel back with us → returned (its stock comes back).
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
  owed numeric;
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
      elsif p_status in ('Livre', 'Livre paye') and ord.status in ('confirmed', 'processing', 'shipped') then
        changes := changes || '{"status": "delivered"}'::jsonb;
      elsif p_status in ('Retour definitif', 'Retour paye', 'Retour recu paye') and ord.status in ('processing', 'shipped', 'delivered') then
        changes := changes || '{"status": "returned"}'::jsonb;
      end if;
      if changes <> '{}'::jsonb then
        perform public.set_order_status(row.order_id, changes, p_actor, p_actor_email);
      end if;
      if p_status = 'Livre paye' then
        owed := ord.total - ord.paid_amount;
        if owed > 0 then
          insert into public.order_payments (order_id, amount, method, account, reference, note, created_by, created_by_email)
          values (row.order_id, owed, 'cod', 'carrier', row.barcode, 'Colissimo: delivered and paid', p_actor, p_actor_email);
        end if;
      end if;
    end if;
  end if;
  return true;
end;
$$;

-- Website and phone orders as before; till sales (channel store) don't ring the order bell.
create or replace function private.notify_new_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  items integer;
  vals jsonb;
  recipients uuid[];
begin
  if new.channel = 'store' then
    return null;
  end if;
  select coalesce(sum(quantity), 0) into items from public.order_items where order_id = new.id;
  vals := jsonb_build_object(
    'number', new.order_number,
    'name', trim(concat_ws(' ', new.customer_first_name, new.customer_last_name)),
    'city', coalesce(nullif(new.shipping_city, ''), nullif(new.shipping_state, ''), '—'),
    'total', trim(to_char(new.total, 'FM999999990.##')),
    'items', items
  );
  recipients := private.notification_recipients('orders');
  if new.assigned_to is not null then
    recipients := array_append(recipients, new.assigned_to);
  end if;
  perform private.notify(
    recipients,
    'order', 'new_order', 'info',
    private.i18n('New order {number}', 'Nouvelle commande {number}', 'طلب جديد {number}', vals),
    private.i18n('{name} · {city} · {items} item(s) · {total} TND',
                 '{name} · {city} · {items} article(s) · {total} TND',
                 '{name} · {city} · {items} قطعة · {total} د.ت', vals),
    '/admin/orders/' || new.id,
    jsonb_build_object('order_id', new.id, 'order_number', new.order_number, 'total', new.total)
  );
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Agent performance (by the agent handling the order)
-- ---------------------------------------------------------------------------

drop function if exists public.agent_performance(timestamptz, timestamptz);

-- One row per agent over orders created in [p_from, p_to). The agent is the one the order is
-- assigned to, else the one who entered it; website orders nobody handles come back as null.
create or replace function public.agent_performance(p_from timestamptz, p_to timestamptz, p_channel text default null)
returns table (
  agent_id uuid,
  agent_email text,
  agent_role text,
  orders integer,
  revenue numeric,
  confirmed integer,
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
    select o.*, coalesce(o.assigned_to, o.created_by) as agent,
           coalesce(o.assigned_to_email, o.created_by_email) as agent_mail,
           (select coalesce(sum(oi.quantity), 0) from public.order_items oi where oi.order_id = o.id) as item_count
      from public.orders o
     where o.deleted_at is null and o.created_at >= p_from and o.created_at < p_to
       and (p_channel is null or o.channel = p_channel)
  )
  select s.agent,
         coalesce(max(s.agent_mail), max(b.email)),
         max(b.role),
         count(*)::integer,
         coalesce(sum(s.total) filter (where s.status not in ('cancelled', 'returned')), 0),
         (count(*) filter (where s.confirmed_at is not null))::integer,
         (count(*) filter (where s.status = 'delivered'))::integer,
         coalesce(sum(s.total) filter (where s.status = 'delivered'), 0),
         (count(*) filter (where s.payment_status = 'paid'))::integer,
         (count(*) filter (where s.status in ('pending', 'confirmed', 'processing', 'shipped')))::integer,
         (count(*) filter (where s.status = 'cancelled'))::integer,
         (count(*) filter (where s.status = 'returned'))::integer,
         coalesce(sum(s.item_count), 0)::integer,
         max(s.created_at)
    from scoped s
    left join public.back_office_users b on b.user_id = s.agent
   group by s.agent
   order by s.agent is null, count(*) desc;
$$;

-- ---------------------------------------------------------------------------
-- Notifications: more audiences, low stock, daily reminders
-- ---------------------------------------------------------------------------

create or replace function private.notification_recipients(p_audience text)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  with live as (
    select b.*
      from public.back_office_users b
      join auth.users u on u.id = b.user_id
     where b.deleted_at is null and u.deleted_at is null
  )
  select coalesce(array_agg(user_id), '{}')
    from live
   where case p_audience
           when 'owner' then role = 'owner'
                          or (role = 'admin' and not exists (select 1 from live where role = 'owner'))
           when 'orders' then role in ('owner', 'admin') or 'orders' = any (permissions)
           when 'stock' then role in ('owner', 'admin') or 'stock' = any (permissions) or 'purchasing' = any (permissions)
           when 'finance' then role in ('owner', 'admin') or 'finance' = any (permissions)
           when 'customers' then role in ('owner', 'admin') or 'customers' = any (permissions)
           else false
         end;
$$;

-- A variant at the online location (or the shop) falling to its reorder point.
create or replace function private.notify_low_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
  vals jsonb;
begin
  select pv.reorder_point, pv.sku, p.name, p.id as product_id, p.stock_tracked, l.name as location
    into v
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    join public.locations l on l.id = new.location_id
   where pv.id = new.variant_id and pv.deleted_at is null and p.deleted_at is null;
  if not found or not v.stock_tracked then
    return null;
  end if;
  if new.available <= v.reorder_point and old.available > v.reorder_point then
    vals := jsonb_build_object('name', v.name, 'sku', coalesce(v.sku, ''), 'left', new.available, 'location', v.location);
    perform private.notify(
      private.notification_recipients('stock'),
      'system', 'low_stock', case when new.available = 0 then 'warning' else 'info' end,
      private.i18n('Low stock: {name}', 'Stock bas : {name}', 'مخزون منخفض: {name}', vals),
      private.i18n('{sku} · {left} left at {location}', '{sku} · plus que {left} à {location}', '{sku} · بقي {left} في {location}', vals),
      '/admin/stock?search=' || coalesce(v.sku, ''),
      jsonb_build_object('variant_id', new.variant_id, 'product_id', v.product_id)
    );
  end if;
  return null;
end;
$$;

create trigger inventory_levels_low_stock
  after update of available on public.inventory_levels
  for each row execute function private.notify_low_stock();

-- A message from a customer (Messenger, Instagram, WhatsApp): their agent, else the customers team.
create or replace function private.notify_customer_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.customers;
  vals jsonb;
begin
  if new.direction <> 'in' then
    return null;
  end if;
  select * into c from public.customers where id = new.customer_id;
  vals := jsonb_build_object('name', coalesce(nullif(c.full_name, ''), new.sender_name, c.phone, '?'), 'channel', initcap(new.channel),
                             'text', left(new.body, 120));
  perform private.notify(
    case when c.assigned_to is not null then array[c.assigned_to] else private.notification_recipients('customers') end,
    'order', 'customer_message', 'info',
    private.i18n('{channel} message from {name}', 'Message {channel} de {name}', 'رسالة {channel} من {name}', vals),
    private.i18n('{text}', '{text}', '{text}', vals),
    '/admin/customers/' || new.customer_id,
    jsonb_build_object('customer_id', new.customer_id)
  );
  return null;
end;
$$;

revoke all on function private.notify_customer_message() from public, anon, authenticated;

create trigger customer_interactions_notify
  after insert on public.customer_interactions
  for each row execute function private.notify_customer_message();

-- Once a day: orders waiting for confirmation too long, parcels moving too long, tasks due today.
-- (Bills due soon are added by the accounting migration.)
create or replace function private.daily_alerts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg jsonb := coalesce((select value from public.erp_settings where key = 'sales'), '{}'::jsonb);
  pending_hours integer := coalesce((cfg->>'pending_alert_hours')::integer, 24);
  late_days integer := coalesce((cfg->>'late_delivery_days')::integer, 6);
  n integer;
  sent integer := 0;
  t record;
begin
  select count(*) into n from public.orders
   where deleted_at is null and status in ('pending', 'confirmed') and created_at < now() - make_interval(hours => pending_hours);
  if n > 0 then
    sent := sent + private.notify(private.notification_recipients('orders'), 'order', 'orders_waiting', 'warning',
      private.i18n('{count} order(s) waiting for confirmation', '{count} commande(s) en attente de confirmation', '{count} طلب بانتظار التأكيد', jsonb_build_object('count', n)),
      private.i18n('Older than {hours} h', 'Depuis plus de {hours} h', 'منذ أكثر من {hours} ساعة', jsonb_build_object('hours', pending_hours)),
      '/admin/orders?status=pending', '{}'::jsonb);
  end if;

  select count(*) into n from public.orders o
   where o.deleted_at is null and o.status in ('processing', 'shipped')
     and coalesce(o.confirmed_at, o.created_at) < now() - make_interval(days => late_days);
  if n > 0 then
    sent := sent + private.notify(private.notification_recipients('orders'), 'order', 'late_deliveries', 'warning',
      private.i18n('{count} late delivery(ies)', '{count} livraison(s) en retard', '{count} توصيل متأخر', jsonb_build_object('count', n)),
      private.i18n('Sent more than {days} days ago and not delivered', 'Envoyées il y a plus de {days} jours, non livrées', 'أرسلت منذ أكثر من {days} أيام ولم تسلم', jsonb_build_object('days', late_days)),
      '/admin/delivery', '{}'::jsonb);
  end if;

  for t in
    select assigned_to, count(*) as due
      from public.crm_tasks
     where deleted_at is null and done_at is null and assigned_to is not null and due_at < now() + interval '1 day'
     group by assigned_to
  loop
    sent := sent + private.notify(array[t.assigned_to], 'system', 'tasks_due', 'info',
      private.i18n('{count} follow-up(s) due today', '{count} relance(s) à faire aujourd''hui', '{count} متابعة اليوم', jsonb_build_object('count', t.due)),
      null, '/admin/my-work', '{}'::jsonb);
  end loop;
  return sent;
end;
$$;

revoke all on function private.daily_alerts() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Names for the activity log and owner alerts
-- ---------------------------------------------------------------------------

create or replace function private.entity_names(p_entity text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_entity
    when 'products' then '{"en":"product","fr":"produit","ar":"منتج"}'
    when 'product_variants' then '{"en":"variant","fr":"variante","ar":"متغير"}'
    when 'product_images' then '{"en":"product photo","fr":"photo produit","ar":"صورة منتج"}'
    when 'categories' then '{"en":"category","fr":"catégorie","ar":"فئة"}'
    when 'colors' then '{"en":"color","fr":"couleur","ar":"لون"}'
    when 'sizes' then '{"en":"size","fr":"taille","ar":"مقاس"}'
    when 'product_discounts' then '{"en":"product discount","fr":"remise produit","ar":"تخفيض منتج"}'
    when 'promotions' then '{"en":"sale banner","fr":"bannière promo","ar":"لافتة تخفيض"}'
    when 'reels' then '{"en":"video reel","fr":"vidéo","ar":"فيديو"}'
    when 'orders' then '{"en":"order","fr":"commande","ar":"طلب"}'
    when 'locations' then '{"en":"stock location","fr":"emplacement","ar":"موقع مخزون"}'
    when 'suppliers' then '{"en":"supplier","fr":"fournisseur","ar":"مورّد"}'
    when 'collections' then '{"en":"collection","fr":"collection","ar":"مجموعة"}'
    when 'product_costs' then '{"en":"purchase cost","fr":"coût d''achat","ar":"تكلفة شراء"}'
    when 'landing_products' then '{"en":"home page pick","fr":"choix page d''accueil","ar":"اختيار الصفحة الرئيسية"}'
    when 'site_settings' then '{"en":"setting","fr":"réglage","ar":"إعداد"}'
    when 'erp_settings' then '{"en":"business setting","fr":"réglage de gestion","ar":"إعداد إداري"}'
    when 'shipping_rates' then '{"en":"shipping rate","fr":"tarif de livraison","ar":"سعر شحن"}'
    when 'country_tax_rates' then '{"en":"tax rate","fr":"taux de taxe","ar":"نسبة ضريبة"}'
    when 'reviews' then '{"en":"review","fr":"avis","ar":"تقييم"}'
    when 'team_member' then '{"en":"team account","fr":"compte d''équipe","ar":"حساب فريق"}'
    when 'customers' then '{"en":"customer","fr":"client","ar":"عميل"}'
    when 'customer_interactions' then '{"en":"conversation note","fr":"échange client","ar":"محادثة"}'
    when 'crm_tasks' then '{"en":"follow-up","fr":"relance","ar":"متابعة"}'
    when 'order_payments' then '{"en":"payment","fr":"encaissement","ar":"دفعة"}'
    when 'cod_remittances' then '{"en":"carrier payout","fr":"versement transporteur","ar":"تحويل شركة التوصيل"}'
    when 'treasury_movements' then '{"en":"cash/bank movement","fr":"mouvement de trésorerie","ar":"حركة خزينة"}'
    when 'ad_campaigns' then '{"en":"campaign","fr":"campagne","ar":"حملة"}'
    when 'ad_spend' then '{"en":"ad spend","fr":"dépense publicitaire","ar":"مصروف إشهار"}'
    when 'agent_goals' then '{"en":"objective","fr":"objectif","ar":"هدف"}'
    when 'business_goals' then '{"en":"monthly goal","fr":"objectif du mois","ar":"هدف الشهر"}'
    when 'raw_materials' then '{"en":"raw material","fr":"matière première","ar":"مادة أولية"}'
    when 'purchase_orders' then '{"en":"purchase order","fr":"commande d''achat","ar":"طلب شراء"}'
    when 'purchase_receipts' then '{"en":"goods receipt","fr":"réception","ar":"استلام"}'
    when 'pos_sessions' then '{"en":"till session","fr":"session de caisse","ar":"جلسة صندوق"}'
    when 'bills' then '{"en":"bill","fr":"facture fournisseur","ar":"فاتورة مورد"}'
    when 'bill_payments' then '{"en":"bill payment","fr":"règlement fournisseur","ar":"دفع فاتورة"}'
    when 'sales_invoices' then '{"en":"invoice","fr":"facture","ar":"فاتورة"}'
    when 'journal_entries' then '{"en":"journal entry","fr":"écriture","ar":"قيد محاسبي"}'
    when 'accounts' then '{"en":"account","fr":"compte","ar":"حساب"}'
    when 'documents' then '{"en":"document","fr":"document","ar":"وثيقة"}'
    else jsonb_build_object('en', p_entity, 'fr', p_entity, 'ar', p_entity)::text
  end::jsonb;
$$;

-- ---------------------------------------------------------------------------
-- Function grants (service role only)
-- ---------------------------------------------------------------------------

revoke all on function
  public.variant_unit_cost(uuid),
  public.stock_valuation(),
  public.record_remittance(jsonb, uuid[], uuid, text),
  public.find_order_duplicates(text, uuid, integer),
  public.find_customer_duplicates(),
  public.merge_customers(uuid, uuid),
  public.anonymize_customer(uuid),
  public.assign_orders(uuid[], uuid, text),
  public.agent_performance(timestamptz, timestamptz, text)
  from public, anon, authenticated;
grant execute on function
  public.variant_unit_cost(uuid),
  public.stock_valuation(),
  public.record_remittance(jsonb, uuid[], uuid, text),
  public.find_order_duplicates(text, uuid, integer),
  public.find_customer_duplicates(),
  public.merge_customers(uuid, uuid),
  public.anonymize_customer(uuid),
  public.assign_orders(uuid[], uuid, text),
  public.agent_performance(timestamptz, timestamptz, text)
  to service_role;

revoke all on function private.stock_movement_cost(), private.set_order_item_cost(), private.refresh_order_paid(uuid),
  private.on_order_payment_change(), private.link_order_customer(), private.sync_customer_stage(),
  private.notify_low_stock() from public, anon, authenticated;

-- Sets an agent's objective for one or more months, replacing the ones there were.
create or replace function public.set_agent_goal(p_user uuid, p_user_email text, p_months date[], p_goal jsonb,
                                                 p_actor uuid default null, p_actor_email text default null)
returns setof public.agent_goals
language plpgsql
set search_path = ''
as $$
begin
  update public.agent_goals set deleted_at = now()
   where user_id = p_user and month = any (p_months) and deleted_at is null;
  return query
  insert into public.agent_goals (user_id, user_email, month, target_orders, target_confirmed, target_delivered, target_revenue,
                                  commission_type, commission_value, created_by, created_by_email)
  select p_user, p_user_email, m, nullif(p_goal->>'target_orders', '')::integer, nullif(p_goal->>'target_confirmed', '')::integer,
         nullif(p_goal->>'target_delivered', '')::integer, nullif(p_goal->>'target_revenue', '')::numeric,
         coalesce(nullif(p_goal->>'commission_type', ''), 'none'), coalesce(nullif(p_goal->>'commission_value', '')::numeric, 0),
         p_actor, p_actor_email
    from unnest(p_months) as m
  returning *;
end;
$$;

revoke all on function public.set_agent_goal(uuid, text, date[], jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.set_agent_goal(uuid, text, date[], jsonb, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Monthly goals of the whole business (Admin → Objectives & commissions)
-- ---------------------------------------------------------------------------

-- One row per month; agents' own objectives (agent_goals) break it down per person.
create table public.business_goals (
  id uuid primary key default gen_random_uuid(),
  month date not null unique check (extract(day from month) = 1),
  target_revenue numeric(14, 3) check (target_revenue >= 0),        -- delivered sales, with VAT
  target_orders integer check (target_orders >= 0),                 -- orders taken
  target_confirmed integer check (target_confirmed >= 0),
  target_delivered integer check (target_delivered >= 0),
  target_gross_margin numeric(14, 3) check (target_gross_margin >= 0),
  max_return_rate numeric(5, 2) check (max_return_rate between 0 and 100),
  ad_budget numeric(14, 3) check (ad_budget >= 0),
  notes text,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.business_goals enable row level security;
revoke all on public.business_goals from anon, authenticated;
grant all on public.business_goals to service_role;
create trigger set_updated_at before update on public.business_goals
  for each row execute function private.set_updated_at();
create trigger prevent_hard_delete before delete on public.business_goals
  for each row execute function private.prevent_hard_delete();
create trigger log_activity after insert or update on public.business_goals
  for each row execute function private.log_activity();
