-- ERP, part 3: accounting (Tunisian SCE structure), bills and expenses, sales invoices, bank
-- reconciliation, documents, and the owner's overview.
--
-- Bookkeeping without double entry: deliveries, payments, carrier payouts, bills and their
-- payments, ad spend and cash/bank movements each create their journal entry through triggers.
-- Entries start as drafts; posting (validation) numbers them per journal and year and makes
-- them unchangeable. A correction is a reversing entry, never an edit. Stock uses intermittent
-- inventory: purchases are expensed on their bill, and the stock variation (valued at weighted
-- average cost) is booked when the accountant asks for it (period end).

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

insert into public.erp_settings (key, value) values ('accounting', jsonb_build_object(
  'enabled', true,
  -- Events before this date create no entries (history stays out of the books).
  'start_date', to_char(current_date, 'YYYY-MM-DD'),
  'auto_post', false,
  'vat_registered', true,
  'sales_vat_rate', 19,            -- shop prices include VAT at this rate
  'invoice_stamp', 0,              -- timbre fiscal added to sales invoices (e.g. 1.000)
  'valuation_method', 'cmup',      -- weighted average cost
  'company', jsonb_build_object('name', 'Kachabity', 'tax_id', '', 'address', '', 'phone', '', 'email', '', 'rc', ''),
  'accounts', jsonb_build_object(
    'customers', '411', 'carrier', '4118', 'suppliers', '401',
    'cash', '541', 'bank', '532', 'transfer', '581',
    'sales', '707', 'shipping_income', '708', 'vat_collected', '4366', 'vat_deductible', '4367', 'stamp', '4368',
    'delivery_fees', '6241', 'advertising', '623',
    'stock', '37', 'stock_variation', '6037', 'materials', '31', 'materials_variation', '6031',
    'owner', '108', 'loan', '164', 'other_income', '758', 'other_expense', '658'
  )
))
on conflict (key) do nothing;

create or replace function private.accounting_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value from public.erp_settings where key = 'accounting'), '{}'::jsonb);
$$;

-- Account code for a role ('cash', 'sales'...), from the settings.
create or replace function private.acct(p_key text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.accounting_settings()->'accounts'->>p_key,
    case p_key
      when 'customers' then '411' when 'carrier' then '4118' when 'suppliers' then '401'
      when 'cash' then '541' when 'bank' then '532' when 'transfer' then '581'
      when 'sales' then '707' when 'shipping_income' then '708' when 'vat_collected' then '4366'
      when 'vat_deductible' then '4367' when 'stamp' then '4368' when 'delivery_fees' then '6241'
      when 'advertising' then '623' when 'stock' then '37' when 'stock_variation' then '6037'
      when 'materials' then '31' when 'materials_variation' then '6031' when 'owner' then '108'
      when 'loan' then '164' when 'other_income' then '758' when 'other_expense' then '658'
    end);
$$;

-- ---------------------------------------------------------------------------
-- Chart of accounts
-- ---------------------------------------------------------------------------

create table public.accounts (
  code text primary key check (code ~ '^[1-7][0-9A-Za-z]*$'),
  name text not null,            -- French (the accounts' language)
  name_en text,
  name_ar text,
  class smallint generated always as (substr(code, 1, 1)::smallint) stored,
  type text not null check (type in ('asset', 'liability', 'equity', 'income', 'expense')),
  is_active boolean not null default true,
  is_system boolean not null default false,   -- used by automatic entries: can't be removed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Structure of the Système Comptable des Entreprises; the accountant can add or rename accounts.
insert into public.accounts (code, name, name_en, name_ar, type, is_system) values
  ('101', 'Capital social', 'Share capital', 'رأس المال', 'equity', false),
  ('108', 'Compte de l''exploitant', 'Owner''s account', 'حساب المستغل', 'equity', true),
  ('110', 'Résultats reportés', 'Retained earnings', 'نتائج مؤجلة', 'equity', false),
  ('120', 'Résultat de l''exercice', 'Profit or loss for the year', 'نتيجة السنة', 'equity', false),
  ('164', 'Emprunts', 'Loans', 'قروض', 'liability', true),
  ('22', 'Immobilisations corporelles', 'Fixed assets', 'أصول ثابتة', 'asset', false),
  ('31', 'Matières premières', 'Raw materials', 'مواد أولية', 'asset', true),
  ('35', 'Stocks de produits finis', 'Finished goods', 'منتجات تامة', 'asset', false),
  ('37', 'Stocks de marchandises', 'Goods for resale', 'بضائع', 'asset', true),
  ('401', 'Fournisseurs d''exploitation', 'Suppliers', 'المزودون', 'liability', true),
  ('411', 'Clients', 'Customers', 'الحرفاء', 'asset', true),
  ('4118', 'Transporteur – encaissements à reverser', 'Delivery company – cash to pay out', 'شركة التوصيل – مبالغ للتحويل', 'asset', true),
  ('421', 'Personnel – rémunérations dues', 'Wages payable', 'أجور مستحقة', 'liability', false),
  ('431', 'CNSS', 'Social security (CNSS)', 'الضمان الاجتماعي', 'liability', false),
  ('4366', 'TVA collectée', 'VAT collected', 'أداء على القيمة المضافة المحصل', 'liability', true),
  ('4367', 'TVA déductible', 'VAT deductible', 'أداء على القيمة المضافة القابل للطرح', 'asset', true),
  ('4368', 'Droit de timbre à payer', 'Stamp duty payable', 'معلوم الطابع', 'liability', true),
  ('4371', 'Retenues à la source', 'Withholding tax', 'الخصم من المورد', 'liability', false),
  ('467', 'Autres débiteurs et créditeurs', 'Other receivables and payables', 'مدينون ودائنون آخرون', 'liability', false),
  ('532', 'Banques', 'Bank', 'البنك', 'asset', true),
  ('541', 'Caisse', 'Cash', 'الصندوق', 'asset', true),
  ('581', 'Virements internes', 'Internal transfers', 'تحويلات داخلية', 'asset', true),
  ('601', 'Achats de matières premières', 'Raw material purchases', 'شراءات مواد أولية', 'expense', true),
  ('6031', 'Variation des stocks de matières premières', 'Change in raw material stock', 'تغير مخزون المواد الأولية', 'expense', true),
  ('6037', 'Variation des stocks de marchandises', 'Change in stock of goods', 'تغير مخزون البضائع', 'expense', true),
  ('6061', 'Eau, électricité, carburant', 'Utilities and fuel', 'ماء وكهرباء ومحروقات', 'expense', true),
  ('6068', 'Emballages et petites fournitures', 'Packaging and supplies', 'تغليف ولوازم', 'expense', true),
  ('607', 'Achats de marchandises', 'Purchases of goods', 'شراءات بضائع', 'expense', true),
  ('613', 'Locations', 'Rent', 'كراء', 'expense', true),
  ('615', 'Entretien et réparations', 'Maintenance and repairs', 'صيانة وإصلاح', 'expense', true),
  ('616', 'Assurances', 'Insurance', 'تأمين', 'expense', true),
  ('622', 'Honoraires', 'Professional fees', 'أتعاب', 'expense', true),
  ('623', 'Publicité', 'Advertising', 'إشهار', 'expense', true),
  ('624', 'Transports', 'Transport', 'نقل', 'expense', true),
  ('6241', 'Frais de livraison', 'Delivery fees', 'مصاريف التوصيل', 'expense', true),
  ('626', 'Frais postaux et télécommunications', 'Phone and internet', 'هاتف وإنترنت', 'expense', true),
  ('627', 'Services bancaires', 'Bank charges', 'خدمات بنكية', 'expense', true),
  ('628', 'Autres services extérieurs', 'Other external services', 'خدمات خارجية أخرى', 'expense', true),
  ('640', 'Salaires', 'Salaries', 'أجور', 'expense', true),
  ('647', 'Charges sociales', 'Social charges', 'أعباء اجتماعية', 'expense', true),
  ('66', 'Impôts et taxes', 'Taxes and duties', 'ضرائب ورسوم', 'expense', true),
  ('651', 'Charges d''intérêts', 'Interest', 'فوائد', 'expense', false),
  ('658', 'Autres charges', 'Other expenses', 'أعباء أخرى', 'expense', true),
  ('701', 'Ventes de produits finis', 'Sales of finished goods', 'مبيعات منتجات تامة', 'income', false),
  ('707', 'Ventes de marchandises', 'Sales of goods', 'مبيعات بضائع', 'income', true),
  ('708', 'Produits des activités annexes (port facturé)', 'Shipping charged', 'معاليم شحن مفوترة', 'income', true),
  ('758', 'Autres produits', 'Other income', 'إيرادات أخرى', 'income', true);

-- ---------------------------------------------------------------------------
-- Gap-free numbering (invoices, posted entries)
-- ---------------------------------------------------------------------------

create table public.document_counters (
  key text primary key,
  value integer not null default 0
);

create or replace function private.next_number(p_key text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  insert into public.document_counters (key, value) values (p_key, 1)
  on conflict (key) do update set value = public.document_counters.value + 1
  returning value into n;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Journal
-- ---------------------------------------------------------------------------

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  -- VT sales, AC purchases, CA cash, BQ bank, OD miscellaneous
  journal text not null check (journal in ('VT', 'AC', 'CA', 'BQ', 'OD')),
  number text unique,               -- given when posted: VT-2026-00001
  entry_date date not null,
  label text not null default '',
  source_type text not null default 'manual',
  source_id uuid,
  source_event text not null default 'booked',
  status text not null default 'draft' check (status in ('draft', 'posted')),
  posted_at timestamptz,
  posted_by uuid,
  posted_by_email text,
  reversal_of uuid references public.journal_entries (id),
  reversed_at timestamptz,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- One live automatic entry per event of a source document.
create unique index journal_entries_source_live_idx on public.journal_entries (source_type, source_id, source_event)
  where deleted_at is null and reversed_at is null and reversal_of is null and source_type <> 'manual';
create index journal_entries_date_idx on public.journal_entries (entry_date) where deleted_at is null;
create index journal_entries_status_idx on public.journal_entries (status, entry_date) where deleted_at is null;

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries (id) on delete cascade,
  account_code text not null references public.accounts (code),
  label text not null default '',
  debit numeric(14, 3) not null default 0 check (debit >= 0),
  credit numeric(14, 3) not null default 0 check (credit >= 0),
  partner_type text check (partner_type in ('customer', 'supplier', 'carrier')),
  partner_id uuid,
  partner_name text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  check ((debit = 0) <> (credit = 0))
);

create index journal_lines_entry_idx on public.journal_lines (entry_id);
create index journal_lines_account_idx on public.journal_lines (account_code);
create index journal_lines_partner_idx on public.journal_lines (partner_type, partner_id) where partner_id is not null;

-- Posted entries can't change, except being marked reversed; lines of posted entries are frozen.
create or replace function private.protect_posted_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'posted' then
    if (to_jsonb(new) - 'reversed_at' - 'updated_at') is distinct from (to_jsonb(old) - 'reversed_at' - 'updated_at') then
      raise exception 'entry_posted: posted entries can''t be changed; reverse them instead' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger journal_entries_protect before update on public.journal_entries
  for each row execute function private.protect_posted_entry();

create or replace function private.protect_posted_lines()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_entry uuid := coalesce(new.entry_id, old.entry_id);
begin
  if current_setting('app.purge', true) = 'on' then
    return coalesce(new, old);
  end if;
  if exists (select 1 from public.journal_entries where id = v_entry and status = 'posted') then
    raise exception 'entry_posted: posted entries can''t be changed; reverse them instead' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger journal_lines_protect before insert or update or delete on public.journal_lines
  for each row execute function private.protect_posted_lines();

-- Identity of the staff member behind the current request (see lib/supabase-admin.ts).
create or replace function private.request_actor()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  h jsonb := private.trusted_request_headers();
begin
  if h is null then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('id', nullif(h->>'x-actor-id', ''), 'email', nullif(h->>'x-actor-email', ''));
end;
$$;

-- Posts draft entries: each must balance and have lines; it gets its number and is frozen.
create or replace function public.post_journal_entries(p_ids uuid[], p_actor uuid default null, p_actor_email text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.journal_entries;
  d numeric;
  c numeric;
  posted integer := 0;
begin
  for e in select * from public.journal_entries where id = any (p_ids) and status = 'draft' and deleted_at is null
            order by entry_date, created_at for update loop
    select coalesce(sum(debit), 0), coalesce(sum(credit), 0) into d, c from public.journal_lines where entry_id = e.id;
    if d = 0 or d <> c then
      raise exception 'unbalanced_entry:%', coalesce(e.label, e.id::text) using errcode = 'P0001';
    end if;
    update public.journal_entries
       set status = 'posted', posted_at = now(), posted_by = p_actor, posted_by_email = p_actor_email,
           number = e.journal || '-' || to_char(e.entry_date, 'YYYY') || '-'
                    || lpad(private.next_number('journal:' || e.journal || ':' || to_char(e.entry_date, 'YYYY'))::text, 5, '0')
     where id = e.id;
    posted := posted + 1;
  end loop;
  return posted;
end;
$$;

-- Writes an entry from lines [{account, debit, credit, label, partner_type, partner_id, partner_name}].
-- Amounts are rounded to the millime; a negative debit becomes a credit and the reverse.
-- Returns null (writes nothing) when accounting is off, the date is before the start date, the
-- lines are all zero, or the event already has its live entry.
create or replace function private.book(p_journal text, p_date date, p_label text, p_source_type text, p_source_id uuid,
                                        p_event text, p_lines jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg jsonb := private.accounting_settings();
  actor jsonb := private.request_actor();
  e uuid;
  d numeric;
  c numeric;
  lines jsonb;
begin
  if not coalesce((cfg->>'enabled')::boolean, true) then
    return null;
  end if;
  if p_date < coalesce(nullif(cfg->>'start_date', '')::date, '1900-01-01'::date) then
    return null;
  end if;
  if exists (select 1 from public.journal_entries
              where source_type = p_source_type and source_id = p_source_id and source_event = p_event
                and deleted_at is null and reversed_at is null and reversal_of is null) then
    return null;
  end if;

  -- Normalized lines: one side each, rounded, zero lines dropped.
  select coalesce(jsonb_agg(n order by (n->>'pos')::integer), '[]'::jsonb) into lines
    from (
      select jsonb_build_object(
               'account', l->>'account', 'label', coalesce(nullif(l->>'label', ''), p_label),
               'debit', greatest(round(coalesce((l->>'debit')::numeric, 0) - coalesce((l->>'credit')::numeric, 0), 3), 0),
               'credit', greatest(round(coalesce((l->>'credit')::numeric, 0) - coalesce((l->>'debit')::numeric, 0), 3), 0),
               'partner_type', nullif(l->>'partner_type', ''), 'partner_id', nullif(l->>'partner_id', ''),
               'partner_name', nullif(l->>'partner_name', ''), 'pos', ord) as n
        from jsonb_array_elements(p_lines) with ordinality as x(l, ord)
    ) s
   where (n->>'debit')::numeric <> 0 or (n->>'credit')::numeric <> 0;
  select coalesce(sum((l->>'debit')::numeric), 0), coalesce(sum((l->>'credit')::numeric), 0) into d, c
    from jsonb_array_elements(lines) l;
  if d = 0 then
    return null;
  end if;
  if d <> c then
    raise exception 'unbalanced_entry:% (% / %)', p_label, d, c using errcode = 'P0001';
  end if;

  insert into public.journal_entries (journal, entry_date, label, source_type, source_id, source_event, created_by, created_by_email)
  values (p_journal, p_date, left(p_label, 300), p_source_type, p_source_id, p_event,
          nullif(actor->>'id', '')::uuid, actor->>'email')
  returning id into e;
  insert into public.journal_lines (entry_id, account_code, label, debit, credit, partner_type, partner_id, partner_name, position)
  select e, l.account, left(l.label, 300), l.debit, l.credit, l.partner_type, l.partner_id, l.partner_name, l.pos
    from jsonb_to_recordset(lines) as l (account text, label text, debit numeric, credit numeric, partner_type text,
                                         partner_id uuid, partner_name text, pos integer);

  if coalesce((cfg->>'auto_post')::boolean, false) then
    perform public.post_journal_entries(array[e], nullif(actor->>'id', '')::uuid, actor->>'email');
  end if;
  return e;
end;
$$;

-- Undoes the live entry of an event: a draft simply goes; a posted one gets a reversing entry.
create or replace function private.unbook(p_source_type text, p_source_id uuid, p_event text, p_date date default current_date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.journal_entries;
  actor jsonb := private.request_actor();
  r uuid;
begin
  select * into e from public.journal_entries
   where source_type = p_source_type and source_id = p_source_id and source_event = p_event
     and deleted_at is null and reversed_at is null and reversal_of is null;
  if not found then
    return null;
  end if;
  if e.status = 'draft' then
    update public.journal_entries set deleted_at = now() where id = e.id;
    return null;
  end if;
  insert into public.journal_entries (journal, entry_date, label, source_type, source_id, source_event, reversal_of, created_by, created_by_email)
  values (e.journal, greatest(p_date, e.entry_date), left('Reversal: ' || e.label, 300), e.source_type, e.source_id, e.source_event, e.id,
          nullif(actor->>'id', '')::uuid, actor->>'email')
  returning id into r;
  insert into public.journal_lines (entry_id, account_code, label, debit, credit, partner_type, partner_id, partner_name, position)
  select r, account_code, label, credit, debit, partner_type, partner_id, partner_name, position
    from public.journal_lines where entry_id = e.id;
  update public.journal_entries set reversed_at = now() where id = e.id;
  if coalesce((private.accounting_settings()->>'auto_post')::boolean, false) then
    perform public.post_journal_entries(array[r], nullif(actor->>'id', '')::uuid, actor->>'email');
  end if;
  return r;
end;
$$;

-- Saves a hand-written entry (draft): creates it (p_id null) or replaces a draft's lines.
create or replace function public.save_manual_entry(p_id uuid, p_entry jsonb, p_lines jsonb,
                                                    p_actor uuid default null, p_actor_email text default null)
returns public.journal_entries
language plpgsql
set search_path = ''
as $$
declare
  e public.journal_entries;
  d numeric;
  c numeric;
begin
  if p_id is null then
    insert into public.journal_entries (journal, entry_date, label, source_type, created_by, created_by_email)
    values (coalesce(nullif(p_entry->>'journal', ''), 'OD'), coalesce(nullif(p_entry->>'entry_date', '')::date, current_date),
            coalesce(p_entry->>'label', ''), 'manual', p_actor, p_actor_email)
    returning * into e;
  else
    select * into e from public.journal_entries where id = p_id and deleted_at is null for update;
    if not found then
      raise exception 'entry_not_found';
    end if;
    if e.status = 'posted' then
      raise exception 'entry_posted: posted entries can''t be changed; reverse them instead' using errcode = 'P0001';
    end if;
    update public.journal_entries
       set journal = coalesce(nullif(p_entry->>'journal', ''), journal),
           entry_date = coalesce(nullif(p_entry->>'entry_date', '')::date, entry_date),
           label = coalesce(p_entry->>'label', label)
     where id = e.id
    returning * into e;
    delete from public.journal_lines where entry_id = e.id;
  end if;

  insert into public.journal_lines (entry_id, account_code, label, debit, credit, partner_type, partner_id, partner_name, position)
  select e.id, l->>'account', coalesce(l->>'label', ''),
         round(coalesce((l->>'debit')::numeric, 0), 3), round(coalesce((l->>'credit')::numeric, 0), 3),
         nullif(l->>'partner_type', ''), nullif(l->>'partner_id', '')::uuid, nullif(l->>'partner_name', ''), ord::integer
    from jsonb_array_elements(p_lines) with ordinality as x(l, ord)
   where round(coalesce((l->>'debit')::numeric, 0), 3) <> 0 or round(coalesce((l->>'credit')::numeric, 0), 3) <> 0;
  select coalesce(sum(debit), 0), coalesce(sum(credit), 0) into d, c from public.journal_lines where entry_id = e.id;
  if d = 0 or d <> c then
    raise exception 'unbalanced_entry:% (% / %)', e.label, d, c using errcode = 'P0001';
  end if;
  return e;
end;
$$;

-- Reverses posted entries by hand (manual corrections).
create or replace function public.reverse_journal_entry(p_id uuid, p_date date default current_date,
                                                        p_actor uuid default null, p_actor_email text default null)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  e public.journal_entries;
  r uuid;
begin
  select * into e from public.journal_entries where id = p_id and deleted_at is null for update;
  if not found then
    raise exception 'entry_not_found';
  end if;
  if e.status <> 'posted' or e.reversed_at is not null or e.reversal_of is not null then
    raise exception 'entry_not_reversible';
  end if;
  insert into public.journal_entries (journal, entry_date, label, source_type, source_id, source_event, reversal_of, created_by, created_by_email)
  values (e.journal, greatest(coalesce(p_date, current_date), e.entry_date), left('Reversal: ' || e.label, 300),
          e.source_type, e.source_id, e.source_event, e.id, p_actor, p_actor_email)
  returning id into r;
  insert into public.journal_lines (entry_id, account_code, label, debit, credit, partner_type, partner_id, partner_name, position)
  select r, account_code, label, credit, debit, partner_type, partner_id, partner_name, position
    from public.journal_lines where entry_id = e.id;
  update public.journal_entries set reversed_at = now() where id = e.id;
  return r;
end;
$$;

-- ---------------------------------------------------------------------------
-- Bills (supplier invoices and expenses) and their payments
-- ---------------------------------------------------------------------------

create sequence public.bill_seq;

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('BILL-' || lpad(nextval('public.bill_seq')::text, 5, '0')),
  supplier_id uuid references public.suppliers (id) on delete set null,
  payee text,                         -- who is paid when there's no supplier record (landlord, staff...)
  purchase_order_id uuid references public.purchase_orders (id) on delete set null,
  supplier_reference text,            -- the supplier's invoice number
  category text not null default 'purchase_goods'
    check (category in ('purchase_goods', 'purchase_materials', 'rent', 'salaries', 'social_charges', 'utilities',
                        'packaging', 'delivery', 'transport', 'telecom', 'bank_fees', 'insurance', 'maintenance',
                        'fees', 'taxes', 'other')),
  cost_type text not null default 'variable' check (cost_type in ('fixed', 'variable')),
  account_code text not null references public.accounts (code),
  bill_date date not null default current_date,
  due_date date,
  amount_ht numeric(14, 3) not null check (amount_ht >= 0),
  vat_amount numeric(14, 3) not null default 0 check (vat_amount >= 0),
  stamp numeric(14, 3) not null default 0 check (stamp >= 0),
  total numeric(14, 3) generated always as (amount_ht + vat_amount + stamp) stored,
  paid_amount numeric(14, 3) not null default 0,
  status text not null default 'unpaid' check (status in ('unpaid', 'partial', 'paid')),
  notes text,
  document_id uuid,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index bills_due_idx on public.bills (due_date) where deleted_at is null and status <> 'paid';
create index bills_date_idx on public.bills (bill_date) where deleted_at is null;
create index bills_supplier_idx on public.bills (supplier_id);

create table public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills (id) on delete cascade,
  amount numeric(14, 3) not null check (amount > 0),
  paid_on date not null default current_date,
  account text not null default 'bank' check (account in ('cash', 'bank')),
  method text not null default 'bank_transfer' check (method in ('cash', 'bank_transfer', 'check', 'card', 'other')),
  reference text,
  note text,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index bill_payments_bill_idx on public.bill_payments (bill_id);

-- Expense account for each bill category.
create or replace function private.bill_category_account(p_category text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_category
    when 'purchase_goods' then '607' when 'purchase_materials' then '601' when 'rent' then '613'
    when 'salaries' then '640' when 'social_charges' then '647' when 'utilities' then '6061'
    when 'packaging' then '6068' when 'delivery' then '6241' when 'transport' then '624'
    when 'telecom' then '626' when 'bank_fees' then '627' when 'insurance' then '616'
    when 'maintenance' then '615' when 'fees' then '622' when 'taxes' then '66' else '628'
  end;
$$;

create or replace function private.refresh_bill_paid()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  paid numeric;
begin
  select coalesce(sum(amount), 0) into paid from public.bill_payments where bill_id = new.bill_id and deleted_at is null;
  update public.bills b
     set paid_amount = paid,
         status = case when paid >= b.total - 0.0005 and b.total > 0 then 'paid' when paid > 0 then 'partial' else 'unpaid' end
   where b.id = new.bill_id
     and (b.paid_amount is distinct from paid);
  return null;
end;
$$;

create trigger bill_payments_refresh after insert or update on public.bill_payments
  for each row execute function private.refresh_bill_paid();

-- A bill's total can change after payments: keep its status right.
create or replace function private.bill_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.status := case when new.paid_amount >= (new.amount_ht + new.vat_amount + new.stamp) - 0.0005 and (new.amount_ht + new.vat_amount + new.stamp) > 0 then 'paid'
                     when new.paid_amount > 0 then 'partial' else 'unpaid' end;
  return new;
end;
$$;

create trigger bills_status before insert or update on public.bills
  for each row execute function private.bill_status();

-- ---------------------------------------------------------------------------
-- Sales invoices and credit notes
-- ---------------------------------------------------------------------------

create table public.sales_invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  kind text not null default 'invoice' check (kind in ('invoice', 'credit_note')),
  order_id uuid references public.orders (id) on delete set null,
  credit_note_for uuid references public.sales_invoices (id),
  invoice_date date not null default current_date,
  customer_name text not null,
  customer_phone text,
  customer_address text,
  customer_tax_id text,
  lines jsonb not null default '[]'::jsonb,
  amount_ht numeric(14, 3) not null,
  vat_rate numeric(5, 2) not null default 0,
  vat_amount numeric(14, 3) not null,
  stamp numeric(14, 3) not null default 0,
  total numeric(14, 3) not null,
  status text not null default 'issued' check (status in ('issued', 'cancelled')),
  notes text,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index sales_invoices_order_live_idx on public.sales_invoices (order_id)
  where kind = 'invoice' and status = 'issued' and deleted_at is null;

-- Issues the invoice of an order (numbered FA-2026-00001, no gaps). Prices include VAT; the
-- invoice shows them before VAT.
create or replace function public.issue_invoice(p_order_id uuid, p_customer_tax_id text default null, p_date date default null,
                                                p_actor uuid default null, p_actor_email text default null)
returns public.sales_invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg jsonb := private.accounting_settings();
  rate numeric := case when coalesce((cfg->>'vat_registered')::boolean, true) then coalesce((cfg->>'sales_vat_rate')::numeric, 19) else 0 end;
  stamp numeric := coalesce((cfg->>'invoice_stamp')::numeric, 0);
  ord public.orders;
  inv public.sales_invoices;
  ht numeric;
  v_date date := coalesce(p_date, current_date);
begin
  select * into ord from public.orders where id = p_order_id and deleted_at is null;
  if not found then
    raise exception 'order_not_found';
  end if;
  if ord.status in ('cancelled', 'returned') then
    raise exception 'order_not_invoiceable';
  end if;
  if exists (select 1 from public.sales_invoices where order_id = ord.id and kind = 'invoice' and status = 'issued' and deleted_at is null) then
    raise exception 'invoice_exists';
  end if;
  ht := round(ord.total / (1 + rate / 100), 3);

  insert into public.sales_invoices (number, kind, order_id, invoice_date, customer_name, customer_phone, customer_address,
                                     customer_tax_id, lines, amount_ht, vat_rate, vat_amount, stamp, total, created_by, created_by_email)
  values (
    'FA-' || to_char(v_date, 'YYYY') || '-' || lpad(private.next_number('invoice:' || to_char(v_date, 'YYYY'))::text, 5, '0'),
    'invoice', ord.id, v_date, trim(concat_ws(' ', ord.customer_first_name, ord.customer_last_name)), ord.customer_phone,
    concat_ws(', ', ord.shipping_address, ord.shipping_city, ord.shipping_state), nullif(p_customer_tax_id, ''),
    coalesce((select jsonb_agg(jsonb_build_object(
                'description', oi.product_name || coalesce(' (' || nullif(oi.variant_label, '') || ')', ''),
                'quantity', oi.quantity,
                'unit_price_ht', round(oi.price / (1 + rate / 100), 3),
                'total_ht', round(oi.subtotal / (1 + rate / 100), 3)) order by oi.created_at)
              from public.order_items oi where oi.order_id = ord.id), '[]'::jsonb)
      || case when ord.discount_amount > 0 then jsonb_build_array(jsonb_build_object('description', 'Remise', 'quantity', 1,
            'unit_price_ht', -round(ord.discount_amount / (1 + rate / 100), 3), 'total_ht', -round(ord.discount_amount / (1 + rate / 100), 3))) else '[]'::jsonb end
      || case when ord.shipping_cost > 0 then jsonb_build_array(jsonb_build_object('description', 'Livraison', 'quantity', 1,
            'unit_price_ht', round(ord.shipping_cost / (1 + rate / 100), 3), 'total_ht', round(ord.shipping_cost / (1 + rate / 100), 3))) else '[]'::jsonb end,
    ht, rate, ord.total - ht, stamp, ord.total + stamp, p_actor, p_actor_email
  )
  returning * into inv;
  return inv;
end;
$$;

-- Cancels an invoice with a credit note for the same amounts.
create or replace function public.cancel_invoice(p_id uuid, p_reason text default null, p_actor uuid default null, p_actor_email text default null)
returns public.sales_invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.sales_invoices;
  credit public.sales_invoices;
begin
  select * into inv from public.sales_invoices where id = p_id and kind = 'invoice' and deleted_at is null for update;
  if not found then
    raise exception 'invoice_not_found';
  end if;
  if inv.status = 'cancelled' then
    raise exception 'invoice_already_cancelled';
  end if;
  insert into public.sales_invoices (number, kind, order_id, credit_note_for, invoice_date, customer_name, customer_phone,
                                     customer_address, customer_tax_id, lines, amount_ht, vat_rate, vat_amount, stamp, total, notes,
                                     created_by, created_by_email)
  values ('AV-' || to_char(current_date, 'YYYY') || '-' || lpad(private.next_number('credit_note:' || to_char(current_date, 'YYYY'))::text, 5, '0'),
          'credit_note', inv.order_id, inv.id, current_date, inv.customer_name, inv.customer_phone, inv.customer_address,
          inv.customer_tax_id, inv.lines, -inv.amount_ht, inv.vat_rate, -inv.vat_amount, -inv.stamp, -inv.total, nullif(p_reason, ''),
          p_actor, p_actor_email)
  returning * into credit;
  update public.sales_invoices set status = 'cancelled' where id = inv.id;
  return credit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Bank reconciliation
-- ---------------------------------------------------------------------------

-- Lines of the bank's statement (imported from CSV or typed), matched one-to-one with bank
-- lines of the journal.
create table public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  statement_date date not null,
  label text not null default '',
  amount numeric(14, 3) not null check (amount <> 0),   -- + money in, − money out
  reference text,
  import_batch text,
  matched_line_id uuid unique references public.journal_lines (id) on delete set null,
  matched_at timestamptz,
  matched_by uuid,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index bank_statement_lines_date_idx on public.bank_statement_lines (statement_date) where deleted_at is null;

-- Matches unmatched statement lines with unmatched bank journal lines of the same amount
-- within p_days days (closest date first). Returns how many were matched.
create or replace function public.auto_match_bank(p_days integer default 5, p_actor uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  l uuid;
  matched integer := 0;
  bank text := private.acct('bank');
begin
  for s in select * from public.bank_statement_lines where matched_line_id is null and deleted_at is null order by statement_date loop
    select jl.id into l
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.deleted_at is null
     where jl.account_code = bank
       and (jl.debit - jl.credit) = s.amount
       and abs(je.entry_date - s.statement_date) <= p_days
       and not exists (select 1 from public.bank_statement_lines b where b.matched_line_id = jl.id and b.deleted_at is null)
     order by abs(je.entry_date - s.statement_date), je.entry_date
     limit 1;
    if l is not null then
      update public.bank_statement_lines set matched_line_id = l, matched_at = now(), matched_by = p_actor where id = s.id;
      matched := matched + 1;
    end if;
  end loop;
  return matched;
end;
$$;

-- ---------------------------------------------------------------------------
-- Documents (contracts, invoices, delivery notes, certificates...)
-- ---------------------------------------------------------------------------

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'other'
    check (kind in ('contract', 'supplier_invoice', 'sales_invoice', 'delivery_note', 'certificate', 'receipt', 'tax', 'payroll', 'other')),
  title text not null check (length(trim(title)) > 0),
  storage_path text,                  -- in the private `documents` bucket
  file_name text,
  mime_type text,
  size_bytes bigint,
  related_type text,                  -- 'order', 'bill', 'supplier', 'customer', 'purchase_order'...
  related_id uuid,
  partner_name text,
  document_date date,
  expires_on date,
  notes text,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index documents_related_idx on public.documents (related_type, related_id) where deleted_at is null;
create index documents_expiry_idx on public.documents (expires_on) where deleted_at is null and expires_on is not null;

alter table public.bills add constraint bills_document_fk foreign key (document_id) references public.documents (id) on delete set null;

-- Private: files are only reached through short-lived signed links from the admin API.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 20971520)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS, audit
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['accounts', 'journal_entries', 'bills', 'bill_payments', 'sales_invoices',
                           'bank_statement_lines', 'documents'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()', t);
    execute format('create trigger prevent_hard_delete before delete on public.%I for each row execute function private.prevent_hard_delete()', t);
    execute format('create trigger log_activity after insert or update on public.%I for each row execute function private.log_activity()', t);
  end loop;
  foreach t in array array['journal_lines', 'document_counters'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end;
$$;

grant usage on sequence public.bill_seq to service_role;

-- ---------------------------------------------------------------------------
-- Automatic entries
-- ---------------------------------------------------------------------------

-- Delivered order → sale (VT): customer debited with the total; sales, shipping charged and VAT
-- credited (shop prices include VAT). Leaving "delivered" (return, cancellation) undoes it.
create or replace function private.book_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg jsonb := private.accounting_settings();
  rate numeric := case when coalesce((cfg->>'vat_registered')::boolean, true) then coalesce((cfg->>'sales_vat_rate')::numeric, 19) else 0 end;
  goods numeric;
  goods_ht numeric;
  ship_ht numeric;
  who text := trim(concat_ws(' ', new.customer_first_name, new.customer_last_name));
begin
  if new.status = 'delivered' and (tg_op = 'INSERT' or old.status is distinct from 'delivered') and new.deleted_at is null then
    goods := new.total - new.shipping_cost;
    goods_ht := round(goods / (1 + rate / 100), 3);
    ship_ht := round(new.shipping_cost / (1 + rate / 100), 3);
    perform private.book('VT', coalesce(new.delivered_at, now())::date, 'Sale ' || new.order_number || ' – ' || who,
      'order', new.id, 'delivered', jsonb_build_array(
        jsonb_build_object('account', private.acct('customers'), 'debit', new.total, 'partner_type', 'customer',
                           'partner_id', new.customer_id, 'partner_name', who),
        jsonb_build_object('account', private.acct('sales'), 'credit', goods_ht),
        jsonb_build_object('account', private.acct('shipping_income'), 'credit', ship_ht),
        jsonb_build_object('account', private.acct('vat_collected'), 'credit', new.total - goods_ht - ship_ht)
      ));
  elsif tg_op = 'UPDATE' and old.status = 'delivered' and new.status is distinct from 'delivered' then
    perform private.unbook('order', new.id, 'delivered');
  end if;
  return null;
end;
$$;

create trigger orders_book after insert or update of status on public.orders
  for each row execute function private.book_order();

-- Money received for an order: cash (CA), bank (BQ) or held by the carrier (OD) against the customer.
create or replace function private.book_order_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ord public.orders;
  who text;
  treasury text := private.acct(new.account);
begin
  if tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null then
    perform private.unbook('order_payment', new.id, 'received');
    return null;
  end if;
  if tg_op <> 'INSERT' or new.deleted_at is not null then
    return null;
  end if;
  select * into ord from public.orders where id = new.order_id;
  who := trim(concat_ws(' ', ord.customer_first_name, ord.customer_last_name));
  perform private.book(case new.account when 'cash' then 'CA' when 'bank' then 'BQ' else 'OD' end,
    new.received_at::date,
    case when new.amount < 0 then 'Refund ' else 'Payment ' end || ord.order_number || ' – ' || who,
    'order_payment', new.id, 'received', jsonb_build_array(
      jsonb_build_object('account', treasury, 'debit', new.amount,
                         'partner_type', case when new.account = 'carrier' then 'carrier' end,
                         'partner_name', case when new.account = 'carrier' then 'Colissimo' end),
      jsonb_build_object('account', private.acct('customers'), 'credit', new.amount, 'partner_type', 'customer',
                         'partner_id', ord.customer_id, 'partner_name', who)
    ));
  return null;
end;
$$;

create trigger order_payments_book after insert or update of deleted_at on public.order_payments
  for each row execute function private.book_order_payment();

-- Carrier payout: the bank (or cash) receives the net, the fees are an expense, the carrier's
-- balance goes down by the gross.
create or replace function private.book_remittance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null then
    perform private.unbook('cod_remittance', new.id, 'received');
    return null;
  end if;
  if tg_op <> 'INSERT' then
    return null;
  end if;
  perform private.book(case new.account when 'cash' then 'CA' else 'BQ' end, new.received_on,
    'Payout ' || new.provider || coalesce(' ' || new.reference, ''), 'cod_remittance', new.id, 'received', jsonb_build_array(
      jsonb_build_object('account', private.acct(new.account), 'debit', new.net_amount),
      jsonb_build_object('account', private.acct('delivery_fees'), 'debit', new.fees),
      jsonb_build_object('account', private.acct('carrier'), 'credit', new.gross_amount, 'partner_type', 'carrier', 'partner_name', new.provider)
    ));
  return null;
end;
$$;

create trigger cod_remittances_book after insert or update of deleted_at on public.cod_remittances
  for each row execute function private.book_remittance();

-- Bill → purchases journal (AC): expense (and stamp) + deductible VAT against the supplier.
-- Changing its amounts, account or date rebooks it (reversal + new entry once posted).
create or replace function private.book_bill()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  who text;
begin
  if tg_op = 'UPDATE' then
    if old.deleted_at is null and new.deleted_at is not null then
      perform private.unbook('bill', new.id, 'booked');
      return null;
    end if;
    if (old.amount_ht, old.vat_amount, old.stamp, old.account_code, old.bill_date, old.supplier_id)
       is not distinct from (new.amount_ht, new.vat_amount, new.stamp, new.account_code, new.bill_date, new.supplier_id) then
      return null;
    end if;
    perform private.unbook('bill', new.id, 'booked', new.bill_date);
  end if;
  if new.deleted_at is not null then
    return null;
  end if;
  select coalesce((select name from public.suppliers where id = new.supplier_id), new.payee, '') into who;
  perform private.book('AC', new.bill_date,
    'Bill ' || coalesce(new.supplier_reference, new.number) || case when who <> '' then ' – ' || who else '' end,
    'bill', new.id, 'booked', jsonb_build_array(
      jsonb_build_object('account', new.account_code, 'debit', new.amount_ht + new.stamp),
      jsonb_build_object('account', private.acct('vat_deductible'), 'debit', new.vat_amount),
      jsonb_build_object('account', private.acct('suppliers'), 'credit', new.amount_ht + new.vat_amount + new.stamp,
                         'partner_type', 'supplier', 'partner_id', new.supplier_id, 'partner_name', nullif(who, ''))
    ));
  return null;
end;
$$;

create trigger bills_book after insert or update on public.bills
  for each row execute function private.book_bill();

create or replace function private.book_bill_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.bills;
  who text;
begin
  if tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null then
    perform private.unbook('bill_payment', new.id, 'paid');
    return null;
  end if;
  if tg_op <> 'INSERT' then
    return null;
  end if;
  select * into b from public.bills where id = new.bill_id;
  select coalesce((select name from public.suppliers where id = b.supplier_id), b.payee, '') into who;
  perform private.book(case new.account when 'cash' then 'CA' else 'BQ' end, new.paid_on,
    'Paid ' || coalesce(b.supplier_reference, b.number) || case when who <> '' then ' – ' || who else '' end,
    'bill_payment', new.id, 'paid', jsonb_build_array(
      jsonb_build_object('account', private.acct('suppliers'), 'debit', new.amount, 'partner_type', 'supplier',
                         'partner_id', b.supplier_id, 'partner_name', nullif(who, '')),
      jsonb_build_object('account', private.acct(new.account), 'credit', new.amount)
    ));
  return null;
end;
$$;

create trigger bill_payments_book after insert or update of deleted_at on public.bill_payments
  for each row execute function private.book_bill_payment();

-- Cash and bank movements against the account their category points to.
create or replace function private.book_treasury_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  other text;
  signed numeric;
begin
  if tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null then
    perform private.unbook('treasury_movement', new.id, 'booked');
    return null;
  end if;
  if tg_op <> 'INSERT' then
    return null;
  end if;
  other := case new.category
    when 'opening_balance' then private.acct('owner')
    when 'owner_contribution' then private.acct('owner')
    when 'owner_withdrawal' then private.acct('owner')
    when 'transfer' then private.acct('transfer')
    when 'loan' then private.acct('loan')
    when 'loan_repayment' then private.acct('loan')
    when 'other_income' then private.acct('other_income')
    when 'other_expense' then private.acct('other_expense')
    else case when new.direction = 'in' then private.acct('other_income') else private.acct('other_expense') end
  end;
  signed := case when new.direction = 'in' then new.amount else -new.amount end;
  perform private.book(case new.account when 'cash' then 'CA' else 'BQ' end, new.occurred_on,
    coalesce(nullif(new.label, ''), new.category), 'treasury_movement', new.id, 'booked', jsonb_build_array(
      jsonb_build_object('account', private.acct(new.account), 'debit', signed),
      jsonb_build_object('account', other, 'credit', signed)
    ));
  return null;
end;
$$;

create trigger treasury_movements_book after insert or update of deleted_at on public.treasury_movements
  for each row execute function private.book_treasury_movement();

-- Ad spend → advertising, paid by bank/cash or owed (supplier).
create or replace function private.book_ad_spend()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  campaign text;
begin
  if tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null then
    perform private.unbook('ad_spend', new.id, 'booked');
    return null;
  end if;
  if tg_op <> 'INSERT' then
    return null;
  end if;
  select name into campaign from public.ad_campaigns where id = new.campaign_id;
  perform private.book(case new.account when 'cash' then 'CA' when 'bank' then 'BQ' else 'OD' end, new.spend_date,
    'Ads' || coalesce(' – ' || campaign, ''), 'ad_spend', new.id, 'booked', jsonb_build_array(
      jsonb_build_object('account', private.acct('advertising'), 'debit', new.amount),
      jsonb_build_object('account', case new.account when 'payable' then private.acct('suppliers') else private.acct(new.account) end,
                         'credit', new.amount)
    ));
  return null;
end;
$$;

create trigger ad_spend_book after insert or update of deleted_at on public.ad_spend
  for each row execute function private.book_ad_spend();

-- Invoice stamp duty (timbre fiscal), when the settings add one.
create or replace function private.book_invoice_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stamp = 0 then
    return null;
  end if;
  perform private.book('OD', new.invoice_date, 'Stamp duty ' || new.number, 'sales_invoice', new.id, 'stamp', jsonb_build_array(
    jsonb_build_object('account', private.acct('customers'), 'debit', new.stamp, 'partner_type', 'customer', 'partner_name', new.customer_name),
    jsonb_build_object('account', private.acct('stamp'), 'credit', new.stamp)
  ));
  return null;
end;
$$;

create trigger sales_invoices_book after insert on public.sales_invoices
  for each row execute function private.book_invoice_stamp();

-- Period end: brings the stock accounts to the value of the stock (goods at weighted average
-- cost, raw materials at their average cost) through the stock variation accounts.
create or replace function public.book_stock_variation(p_date date default current_date, p_actor uuid default null, p_actor_email text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  goods_value numeric;
  materials_value numeric;
  goods_booked numeric;
  materials_booked numeric;
  ref uuid := gen_random_uuid();
  e1 uuid;
  e2 uuid;
begin
  select coalesce(sum(value), 0) into goods_value from public.stock_valuation();
  select coalesce(round(sum(stock * coalesce(avg_cost, 0)), 3), 0) into materials_value from public.raw_materials where deleted_at is null;
  select coalesce(sum(jl.debit - jl.credit), 0) into goods_booked
    from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id and je.deleted_at is null
   where jl.account_code = private.acct('stock') and je.entry_date <= p_date;
  select coalesce(sum(jl.debit - jl.credit), 0) into materials_booked
    from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id and je.deleted_at is null
   where jl.account_code = private.acct('materials') and je.entry_date <= p_date;

  e1 := private.book('OD', p_date, 'Stock variation (goods) at ' || to_char(p_date, 'YYYY-MM-DD'), 'stock_variation', ref, 'goods',
    jsonb_build_array(
      jsonb_build_object('account', private.acct('stock'), 'debit', goods_value - goods_booked),
      jsonb_build_object('account', private.acct('stock_variation'), 'credit', goods_value - goods_booked)));
  e2 := private.book('OD', p_date, 'Stock variation (raw materials) at ' || to_char(p_date, 'YYYY-MM-DD'), 'stock_variation', ref, 'materials',
    jsonb_build_array(
      jsonb_build_object('account', private.acct('materials'), 'debit', materials_value - materials_booked),
      jsonb_build_object('account', private.acct('materials_variation'), 'credit', materials_value - materials_booked)));
  return jsonb_build_object('goods_value', goods_value, 'goods_change', goods_value - goods_booked, 'goods_entry', e1,
                            'materials_value', materials_value, 'materials_change', materials_value - materials_booked, 'materials_entry', e2);
end;
$$;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

-- Per account: balance before the period, movements in it, balance at its end (debit − credit).
create or replace function public.trial_balance(p_from date, p_to date, p_include_drafts boolean default false)
returns table (
  account_code text,
  account_name text,
  account_class smallint,
  account_type text,
  opening numeric,
  debit numeric,
  credit numeric,
  closing numeric
)
language sql
stable
set search_path = ''
as $$
  with lines as (
    select jl.account_code, je.entry_date, jl.debit, jl.credit
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id
     where je.deleted_at is null and je.entry_date <= p_to
       and (p_include_drafts or je.status = 'posted')
  ), sums as (
    select account_code,
           coalesce(sum(debit - credit) filter (where entry_date < p_from), 0) as opening,
           coalesce(sum(debit) filter (where entry_date >= p_from), 0) as debit,
           coalesce(sum(credit) filter (where entry_date >= p_from), 0) as credit
      from lines group by account_code
  )
  select a.code, a.name, a.class, a.type, s.opening, s.debit, s.credit, s.opening + s.debit - s.credit
    from sums s join public.accounts a on a.code = s.account_code
   order by a.code;
$$;

-- VAT per month: collected, deductible, due.
create or replace function public.vat_summary(p_from date, p_to date, p_include_drafts boolean default false)
returns table (month date, collected numeric, deductible numeric, due numeric)
language sql
security definer
stable
set search_path = ''
as $$
  select date_trunc('month', je.entry_date)::date,
         coalesce(sum(jl.credit - jl.debit) filter (where jl.account_code = private.acct('vat_collected')), 0),
         coalesce(sum(jl.debit - jl.credit) filter (where jl.account_code = private.acct('vat_deductible')), 0),
         coalesce(sum(jl.credit - jl.debit) filter (where jl.account_code = private.acct('vat_collected')), 0)
           - coalesce(sum(jl.debit - jl.credit) filter (where jl.account_code = private.acct('vat_deductible')), 0)
    from public.journal_lines jl
    join public.journal_entries je on je.id = jl.entry_id
   where je.deleted_at is null and je.entry_date between p_from and p_to
     and (p_include_drafts or je.status = 'posted')
     and jl.account_code in (private.acct('vat_collected'), private.acct('vat_deductible'))
   group by 1
   order by 1;
$$;

-- Money now: till, bank, and cash the delivery company holds for us.
create or replace function public.treasury_balances()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with flows as (
    select account, amount from public.order_payments where deleted_at is null and account in ('cash', 'bank')
    union all
    select account, net_amount from public.cod_remittances where deleted_at is null
    union all
    select account, case when direction = 'in' then amount else -amount end from public.treasury_movements where deleted_at is null
    union all
    select account, -amount from public.bill_payments where deleted_at is null
    union all
    select account, -amount from public.ad_spend where deleted_at is null and account in ('cash', 'bank')
  )
  select jsonb_build_object(
    'cash', coalesce((select sum(amount) from flows where account = 'cash'), 0),
    'bank', coalesce((select sum(amount) from flows where account = 'bank'), 0),
    'carrier', coalesce((select sum(amount) from public.order_payments
                          where deleted_at is null and account = 'carrier' and remittance_id is null), 0),
    'open_tills', coalesce((select sum(opening_float) from public.pos_sessions where status = 'open' and deleted_at is null), 0)
  );
$$;

-- The owner's overview for a period, optionally narrowed to a channel, an agent, a product or a
-- campaign. Orders count in the period of the step they reached: created, confirmed, delivered,
-- returned. Amounts are in TND; revenue is shown with VAT and before VAT.
create or replace function public.owner_overview(p_from timestamptz, p_to timestamptz, p_channel text default null,
                                                 p_agent uuid default null, p_product uuid default null, p_campaign uuid default null)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  cfg jsonb := private.accounting_settings();
  rate numeric := case when coalesce((cfg->>'vat_registered')::boolean, true) then coalesce((cfg->>'sales_vat_rate')::numeric, 19) else 0 end;
  result jsonb;
begin
  with o as (
    select o.*, coalesce(o.assigned_to, o.created_by) as agent
      from public.orders o
     where o.deleted_at is null
       and (p_channel is null or o.channel = p_channel)
       and (p_agent is null or coalesce(o.assigned_to, o.created_by) = p_agent)
       and (p_campaign is null or o.campaign_id = p_campaign)
       and (p_product is null or exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.product_id = p_product))
  ), lines as (
    -- Each line's cost: the product's cost when it was ordered, else its cost now.
    select oi.order_id, oi.product_id, oi.product_name, oi.quantity, oi.subtotal,
           coalesce(oi.unit_cost, pc.cost, public.variant_unit_cost(oi.variant_id)) as unit_cost
      from public.order_items oi join o on o.id = oi.order_id
      left join public.product_costs pc on pc.product_id = oi.product_id and pc.deleted_at is null
     where p_product is null or oi.product_id = p_product
  ), delivered as (
    select o.* from o where o.status = 'delivered' and o.delivered_at >= p_from and o.delivered_at < p_to
  ), delivered_lines as (
    select l.* from lines l join delivered d on d.id = l.order_id
  ), finished as (
    select o.* from o
     where (o.status = 'delivered' and o.delivered_at >= p_from and o.delivered_at < p_to)
        or (o.status = 'returned' and o.returned_at >= p_from and o.returned_at < p_to)
  ), spend as (
    select coalesce(sum(s.amount), 0) as total from public.ad_spend s
     where s.deleted_at is null and s.spend_date >= p_from::date and s.spend_date < p_to::date + 1
       and (p_campaign is null or s.campaign_id = p_campaign)
  ), expenses as (
    select coalesce(sum(b.amount_ht + b.stamp) filter (where b.category not in ('purchase_goods', 'purchase_materials')), 0) as operating,
           coalesce(sum(b.amount_ht + b.stamp) filter (where b.category not in ('purchase_goods', 'purchase_materials') and b.cost_type = 'fixed'), 0) as fixed,
           coalesce(sum(b.amount_ht + b.stamp) filter (where b.category in ('purchase_goods', 'purchase_materials')), 0) as purchases
      from public.bills b
     where b.deleted_at is null and b.bill_date >= p_from::date and b.bill_date < p_to::date + 1
  ), fees as (
    select coalesce(sum(r.fees), 0) as total from public.cod_remittances r
     where r.deleted_at is null and r.received_on >= p_from::date and r.received_on < p_to::date + 1
  ), revenue as (
    select coalesce(case when p_product is null then sum(d.total) else (select sum(subtotal) from delivered_lines) end, 0) as ttc,
           coalesce(case when p_product is null then sum(d.total - d.shipping_cost) else (select sum(subtotal) from delivered_lines) end, 0) as goods,
           count(*) as orders
      from delivered d
  ), cogs as (
    select coalesce(sum(quantity * coalesce(unit_cost, 0)), 0) as total,
           count(*) filter (where unit_cost is null) as missing
      from delivered_lines
  ), days as (
    select generate_series(date_trunc('day', p_from), date_trunc('day', p_to - interval '1 second'), interval '1 day')::date as day
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'orders', jsonb_build_object(
      'created', (select count(*) from o where o.created_at >= p_from and o.created_at < p_to),
      'created_value', (select coalesce(sum(total), 0) from o where o.created_at >= p_from and o.created_at < p_to),
      'confirmed', (select count(*) from o where o.confirmed_at >= p_from and o.confirmed_at < p_to),
      'delivered', (select orders from revenue),
      'returned', (select count(*) from o where o.status = 'returned' and o.returned_at >= p_from and o.returned_at < p_to),
      'cancelled', (select count(*) from o where o.status = 'cancelled' and o.cancelled_at >= p_from and o.cancelled_at < p_to),
      'pending_now', (select count(*) from o where o.status in ('pending', 'confirmed')),
      'in_delivery_now', (select count(*) from o where o.status in ('processing', 'shipped')),
      'finished', (select count(*) from finished)
    ),
    'money', jsonb_build_object(
      'delivered_revenue', (select ttc from revenue),
      'delivered_revenue_ht', round((select goods from revenue) / (1 + rate / 100), 3),
      'cogs', (select total from cogs),
      'missing_cost_lines', (select missing from cogs),
      'gross_margin', round((select goods from revenue) / (1 + rate / 100), 3) - (select total from cogs),
      'ad_spend', (select total from spend),
      'operating_expenses', (select operating from expenses),
      'fixed_expenses', (select fixed from expenses),
      'purchases', (select purchases from expenses),
      'delivery_fees', (select total from fees),
      'net_margin', round((select goods from revenue) / (1 + rate / 100), 3) - (select total from cogs)
                    - (select total from spend) - (select operating from expenses) - (select total from fees),
      'collected', (select coalesce(sum(p.amount), 0) from public.order_payments p join o on o.id = p.order_id
                     where p.deleted_at is null and p.received_at >= p_from and p.received_at < p_to),
      'receivable', (select coalesce(sum(o.total - o.paid_amount), 0) from o where o.status = 'delivered' and o.total > o.paid_amount),
      'cost_per_delivered_sale', case when (select orders from revenue) > 0 then round((select total from spend) / (select orders from revenue), 3) end,
      'vat_rate', rate
    ),
    'treasury', public.treasury_balances() || jsonb_build_object(
      'supplier_debt', (select coalesce(sum(total - paid_amount), 0) from public.bills where deleted_at is null and status <> 'paid'),
      'due_7_days', (select coalesce(sum(total - paid_amount), 0) from public.bills
                      where deleted_at is null and status <> 'paid' and due_date <= current_date + 7),
      'overdue', (select coalesce(sum(total - paid_amount), 0) from public.bills
                   where deleted_at is null and status <> 'paid' and due_date < current_date)
    ),
    'stock', jsonb_build_object(
      'value', (select coalesce(sum(value), 0) from public.stock_valuation()),
      'units', (select coalesce(sum(units), 0) from public.stock_valuation()),
      'materials_value', (select coalesce(round(sum(stock * coalesce(avg_cost, 0)), 3), 0) from public.raw_materials where deleted_at is null),
      'low', (select count(*) from public.product_variants v join public.products p on p.id = v.product_id
               where v.deleted_at is null and p.deleted_at is null and p.stock_tracked and v.stock <= v.reorder_point),
      'out', (select count(*) from public.product_variants v join public.products p on p.id = v.product_id
               where v.deleted_at is null and p.deleted_at is null and p.stock_tracked and v.stock <= 0),
      -- Live products without a purchase cost: their margin can't be computed.
      'products_without_cost', (select count(*) from public.products p
               where p.deleted_at is null and p.status = 'active'
                 and not exists (select 1 from public.product_costs pc where pc.product_id = p.id and pc.deleted_at is null))
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day,
        'created', (select count(*) from o where o.created_at::date = d.day),
        'confirmed', (select count(*) from o where o.confirmed_at::date = d.day),
        'delivered', (select count(*) from delivered x where x.delivered_at::date = d.day),
        'revenue', (select coalesce(sum(x.total), 0) from delivered x where x.delivered_at::date = d.day),
        'returned', (select count(*) from o where o.status = 'returned' and o.returned_at::date = d.day),
        'collected', (select coalesce(sum(p.amount), 0) from public.order_payments p join o on o.id = p.order_id
                       where p.deleted_at is null and p.received_at::date = d.day),
        'ad_spend', (select coalesce(sum(s.amount), 0) from public.ad_spend s where s.deleted_at is null and s.spend_date = d.day
                      and (p_campaign is null or s.campaign_id = p_campaign))
      ) order by d.day), '[]'::jsonb) from days d
    ),
    'channels', (
      select coalesce(jsonb_agg(c order by c->>'channel'), '[]'::jsonb) from (
        select jsonb_build_object('channel', o.channel,
          'created', count(*) filter (where o.created_at >= p_from and o.created_at < p_to),
          'confirmed', count(*) filter (where o.confirmed_at >= p_from and o.confirmed_at < p_to),
          'delivered', count(*) filter (where o.status = 'delivered' and o.delivered_at >= p_from and o.delivered_at < p_to),
          'returned', count(*) filter (where o.status = 'returned' and o.returned_at >= p_from and o.returned_at < p_to),
          'revenue', coalesce(sum(o.total) filter (where o.status = 'delivered' and o.delivered_at >= p_from and o.delivered_at < p_to), 0)
        ) as c
          from o group by o.channel
      ) x
    ),
    'products', (
      select coalesce(jsonb_agg(p order by (p->>'revenue')::numeric desc), '[]'::jsonb) from (
        select jsonb_build_object('product_id', l.product_id, 'name', max(l.product_name),
          'quantity', sum(l.quantity), 'revenue', sum(l.subtotal),
          'cost', sum(l.quantity * coalesce(l.unit_cost, 0)),
          'margin', round(sum(l.subtotal) / (1 + rate / 100), 3) - sum(l.quantity * coalesce(l.unit_cost, 0)),
          'missing_cost', bool_or(l.unit_cost is null)) as p
          from delivered_lines l group by l.product_id
         order by sum(l.subtotal) desc limit 15
      ) x
    ),
    'agents', (
      select coalesce(jsonb_agg(a order by (a->>'delivered_revenue')::numeric desc), '[]'::jsonb) from (
        select jsonb_build_object('agent_id', o.agent,
          'email', coalesce(max(o.assigned_to_email), max(o.created_by_email), max(b.email)),
          'created', count(*) filter (where o.created_at >= p_from and o.created_at < p_to),
          'confirmed', count(*) filter (where o.confirmed_at >= p_from and o.confirmed_at < p_to),
          'delivered', count(*) filter (where o.status = 'delivered' and o.delivered_at >= p_from and o.delivered_at < p_to),
          'returned', count(*) filter (where o.status = 'returned' and o.returned_at >= p_from and o.returned_at < p_to),
          'delivered_revenue', coalesce(sum(o.total) filter (where o.status = 'delivered' and o.delivered_at >= p_from and o.delivered_at < p_to), 0)
        ) as a
          from o left join public.back_office_users b on b.user_id = o.agent
         where o.agent is not null
         group by o.agent
      ) x
    ),
    'campaigns', (
      select coalesce(jsonb_agg(c order by (c->>'spend')::numeric desc), '[]'::jsonb) from (
        select jsonb_build_object('campaign_id', c.id, 'name', c.name, 'platform', c.platform,
          'spend', coalesce((select sum(s.amount) from public.ad_spend s where s.campaign_id = c.id and s.deleted_at is null
                              and s.spend_date >= p_from::date and s.spend_date < p_to::date + 1), 0),
          'orders', (select count(*) from o where o.campaign_id = c.id and o.created_at >= p_from and o.created_at < p_to),
          'delivered', (select count(*) from o where o.campaign_id = c.id and o.status = 'delivered' and o.delivered_at >= p_from and o.delivered_at < p_to),
          'revenue', (select coalesce(sum(o.total), 0) from o where o.campaign_id = c.id and o.status = 'delivered' and o.delivered_at >= p_from and o.delivered_at < p_to)
        ) as c
          from public.ad_campaigns c
         where c.deleted_at is null and (p_campaign is null or c.id = p_campaign)
      ) x
    )
  ) into result;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Daily alerts: bills due, expiring documents, plus part 1's
-- ---------------------------------------------------------------------------

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
  amount numeric;
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

  select count(*), coalesce(sum(total - paid_amount), 0) into n, amount from public.bills
   where deleted_at is null and status <> 'paid' and due_date <= current_date + 3;
  if n > 0 then
    sent := sent + private.notify(private.notification_recipients('finance'), 'system', 'bills_due', 'warning',
      private.i18n('{count} bill(s) due within 3 days', '{count} facture(s) à payer sous 3 jours', '{count} فاتورة مستحقة خلال 3 أيام', jsonb_build_object('count', n)),
      private.i18n('{amount} TND to pay (overdue included)', '{amount} TND à payer (retards compris)', '{amount} د.ت للدفع (مع المتأخرات)', jsonb_build_object('amount', trim(to_char(amount, 'FM999999990.000')))),
      '/admin/finance/bills', '{}'::jsonb);
  end if;

  select count(*) into n from public.documents where deleted_at is null and expires_on between current_date and current_date + 15;
  if n > 0 then
    sent := sent + private.notify(private.notification_recipients('finance'), 'system', 'documents_expiring', 'info',
      private.i18n('{count} document(s) expire within 15 days', '{count} document(s) expirent sous 15 jours', '{count} وثيقة تنتهي خلال 15 يوما', jsonb_build_object('count', n)),
      null, '/admin/finance/documents', '{}'::jsonb);
  end if;
  return sent;
end;
$$;

revoke all on function private.daily_alerts() from public, anon, authenticated;

-- Every morning at 08:00 Tunis (07:00 UTC), where pg_cron is available.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'kachabity-daily-alerts';
    perform cron.schedule('kachabity-daily-alerts', '0 7 * * *', 'select private.daily_alerts()');
  end if;
exception when others then
  raise warning 'daily alerts not scheduled: %', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function
  public.post_journal_entries(uuid[], uuid, text),
  public.save_manual_entry(uuid, jsonb, jsonb, uuid, text),
  public.reverse_journal_entry(uuid, date, uuid, text),
  public.issue_invoice(uuid, text, date, uuid, text),
  public.cancel_invoice(uuid, text, uuid, text),
  public.auto_match_bank(integer, uuid),
  public.book_stock_variation(date, uuid, text),
  public.trial_balance(date, date, boolean),
  public.vat_summary(date, date, boolean),
  public.treasury_balances(),
  public.owner_overview(timestamptz, timestamptz, text, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function
  public.post_journal_entries(uuid[], uuid, text),
  public.save_manual_entry(uuid, jsonb, jsonb, uuid, text),
  public.reverse_journal_entry(uuid, date, uuid, text),
  public.issue_invoice(uuid, text, date, uuid, text),
  public.cancel_invoice(uuid, text, uuid, text),
  public.auto_match_bank(integer, uuid),
  public.book_stock_variation(date, uuid, text),
  public.trial_balance(date, date, boolean),
  public.vat_summary(date, date, boolean),
  public.treasury_balances(),
  public.owner_overview(timestamptz, timestamptz, text, uuid, uuid, uuid)
  to service_role;

revoke all on function private.accounting_settings(), private.acct(text), private.next_number(text), private.protect_posted_entry(),
  private.protect_posted_lines(), private.request_actor(), private.book(text, date, text, text, uuid, text, jsonb),
  private.unbook(text, uuid, text, date), private.bill_category_account(text), private.refresh_bill_paid(), private.bill_status(),
  private.book_order(), private.book_order_payment(), private.book_remittance(), private.book_bill(), private.book_bill_payment(),
  private.book_treasury_movement(), private.book_ad_spend(), private.book_invoice_stamp()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Treasury helpers
-- ---------------------------------------------------------------------------

-- Moving money between the till and the bank: two movements through the internal transfer account.
create or replace function public.record_cash_transfer(p_from text, p_amount numeric, p_date date, p_label text,
                                                       p_actor uuid default null, p_actor_email text default null)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_transfer uuid := gen_random_uuid();
  v_to text := case p_from when 'cash' then 'bank' when 'bank' then 'cash' end;
begin
  if v_to is null then
    raise exception 'invalid_account';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'invalid_quantity';
  end if;
  insert into public.treasury_movements (account, direction, amount, category, occurred_on, label, transfer_id, created_by, created_by_email)
  values (p_from, 'out', p_amount, 'transfer', coalesce(p_date, current_date), coalesce(nullif(p_label, ''), 'Transfer to ' || v_to), v_transfer, p_actor, p_actor_email),
         (v_to, 'in', p_amount, 'transfer', coalesce(p_date, current_date), coalesce(nullif(p_label, ''), 'Transfer from ' || p_from), v_transfer, p_actor, p_actor_email);
  return v_transfer;
end;
$$;

-- Removes a carrier payout entered by mistake: its payments are owed by the carrier again.
create or replace function public.cancel_remittance(p_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.order_payments set remittance_id = null, updated_at = now() where remittance_id = p_id;
  update public.cod_remittances set deleted_at = now() where id = p_id and deleted_at is null;
  if not found then
    raise exception 'remittance_not_found';
  end if;
end;
$$;

-- Removes one side of a transfer together with the other.
create or replace function public.delete_treasury_movement(p_id uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  m public.treasury_movements;
  n integer;
begin
  select * into m from public.treasury_movements where id = p_id and deleted_at is null;
  if not found then
    raise exception 'movement_not_found';
  end if;
  if m.category = 'pos_difference' then
    raise exception 'pos_difference_locked';
  end if;
  update public.treasury_movements set deleted_at = now()
   where deleted_at is null and (id = p_id or (m.transfer_id is not null and transfer_id = m.transfer_id));
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.record_cash_transfer(text, numeric, date, text, uuid, text), public.cancel_remittance(uuid),
  public.delete_treasury_movement(uuid) from public, anon, authenticated;
grant execute on function public.record_cash_transfer(text, numeric, date, text, uuid, text), public.cancel_remittance(uuid),
  public.delete_treasury_movement(uuid) to service_role;

-- A bill paid on the spot (cash or bank): the bill and its payment together.
create or replace function public.create_paid_bill(p_bill jsonb, p_account text, p_method text,
                                                   p_actor uuid default null, p_actor_email text default null)
returns public.bills
language plpgsql
set search_path = ''
as $$
declare
  b public.bills;
begin
  insert into public.bills (supplier_id, payee, purchase_order_id, supplier_reference, category, cost_type, account_code,
                            bill_date, due_date, amount_ht, vat_amount, stamp, notes, document_id, created_by, created_by_email)
  values (nullif(p_bill->>'supplier_id', '')::uuid, nullif(p_bill->>'payee', ''), nullif(p_bill->>'purchase_order_id', '')::uuid,
          nullif(p_bill->>'supplier_reference', ''), p_bill->>'category', coalesce(nullif(p_bill->>'cost_type', ''), 'variable'),
          p_bill->>'account_code', coalesce(nullif(p_bill->>'bill_date', '')::date, current_date), nullif(p_bill->>'due_date', '')::date,
          (p_bill->>'amount_ht')::numeric, coalesce(nullif(p_bill->>'vat_amount', '')::numeric, 0), coalesce(nullif(p_bill->>'stamp', '')::numeric, 0),
          nullif(p_bill->>'notes', ''), nullif(p_bill->>'document_id', '')::uuid, p_actor, p_actor_email)
  returning * into b;
  if b.total > 0 then
    insert into public.bill_payments (bill_id, amount, paid_on, account, method, created_by, created_by_email)
    values (b.id, b.total, b.bill_date, p_account, p_method, p_actor, p_actor_email);
  end if;
  select * into b from public.bills where id = b.id;
  return b;
end;
$$;

revoke all on function public.create_paid_bill(jsonb, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.create_paid_bill(jsonb, text, text, uuid, text) to service_role;
