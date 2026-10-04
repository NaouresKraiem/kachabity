-- Back-office notifications.
--
-- * New orders notify everyone who handles orders (owner, admins, staff with `orders`).
-- * Owner alerts: what admins and staff do that the owner should know about (deletes,
--   permanent erases, blocked attempts, team changes, big price cuts or discounts, large
--   stock adjustments, settings changes, cancelled or refunded orders). They are derived
--   from activity_log, so they cover every route and every way of changing data.
-- * Each notification is a row per recipient. The admin UI shows them live (Realtime) and
--   a trigger hands each new row to the `send-push` Edge Function, which delivers it as a
--   desktop notification to every browser the recipient enabled (Web Push).
--
-- Titles and bodies are stored in en/fr/ar so the admin UI and the push message use the
-- recipient's language.

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Back-office users (who gets what)
-- ---------------------------------------------------------------------------

-- Mirror of each back-office user's role, refreshed by GET /api/admin/me on every admin
-- visit and by the Team API. Needed because roles also come from the ADMIN_EMAILS and
-- OWNER_EMAILS settings, which the database can't see.
create table public.back_office_users (
  user_id uuid primary key,
  email text,
  role text not null check (role in ('owner', 'admin', 'staff')),
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger set_updated_at before update on public.back_office_users
  for each row execute function private.set_updated_at();

alter table public.back_office_users enable row level security;
revoke all on public.back_office_users from anon, authenticated;
grant all on public.back_office_users to service_role;

-- Live back-office users for an audience: 'orders' or 'owner' (owners; admins when the
-- business has no owner yet, so alerts are never lost).
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
           when 'orders' then role in ('owner', 'admin') or 'orders' = any (permissions)
           when 'owner' then role = 'owner'
                          or (role = 'admin' and not exists (select 1 from live where role = 'owner'))
           else false
         end;
$$;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create table public.notifications (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  recipient_id uuid not null,
  kind text not null check (kind in ('order', 'security', 'system')),
  type text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  title jsonb not null,
  body jsonb,
  url text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc)
  where deleted_at is null;
create index notifications_recipient_unread_idx on public.notifications (recipient_id)
  where read_at is null and deleted_at is null;

create trigger set_updated_at before update on public.notifications
  for each row execute function private.set_updated_at();
create trigger prevent_hard_delete before delete on public.notifications
  for each row execute function private.prevent_hard_delete();

-- Each user reads their own (the admin bell subscribes through Realtime); writes go through the API.
alter table public.notifications enable row level security;
create policy "Users read their own notifications" on public.notifications
  for select to authenticated using (recipient_id = (select auth.uid()) and deleted_at is null);
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant all on public.notifications to service_role;

alter publication supabase_realtime add table public.notifications;

-- Browsers that receive desktop notifications.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  locale text not null default 'en' check (locale in ('en', 'fr', 'ar')),
  user_agent text,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id) where deleted_at is null;

create trigger set_updated_at before update on public.push_subscriptions
  for each row execute function private.set_updated_at();
create trigger prevent_hard_delete before delete on public.push_subscriptions
  for each row execute function private.prevent_hard_delete();

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant all on public.push_subscriptions to service_role;

-- One row per recipient.
create or replace function private.notify(
  p_recipients uuid[],
  p_kind text,
  p_type text,
  p_severity text,
  p_title jsonb,
  p_body jsonb,
  p_url text,
  p_data jsonb default '{}'::jsonb
)
returns integer
language sql
security definer
set search_path = ''
as $$
  with inserted as (
    insert into public.notifications (recipient_id, kind, type, severity, title, body, url, data)
    select distinct r, p_kind, p_type, p_severity, p_title, p_body, p_url, coalesce(p_data, '{}'::jsonb)
      from unnest(p_recipients) as r
     where r is not null
    returning 1
  )
  select count(*)::integer from inserted;
$$;

revoke all on function private.notify(uuid[], text, text, text, jsonb, jsonb, text, jsonb) from public, anon, authenticated;

-- {en, fr, ar} text, with {placeholders} filled from p_values (applied to every language).
create or replace function private.i18n(p_en text, p_fr text, p_ar text, p_values jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
  v text;
  en text := p_en;
  fr text := p_fr;
  ar text := p_ar;
begin
  for k, v in select key, value from jsonb_each_text(coalesce(p_values, '{}'::jsonb)) loop
    en := replace(en, '{' || k || '}', coalesce(v, ''));
    fr := replace(fr, '{' || k || '}', coalesce(v, ''));
    ar := replace(ar, '{' || k || '}', coalesce(v, ''));
  end loop;
  return jsonb_build_object('en', en, 'fr', fr, 'ar', ar);
end;
$$;

-- What a table's rows are called, per language.
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
    when 'shipping_rates' then '{"en":"shipping rate","fr":"tarif de livraison","ar":"سعر شحن"}'
    when 'country_tax_rates' then '{"en":"tax rate","fr":"taux de taxe","ar":"نسبة ضريبة"}'
    when 'reviews' then '{"en":"review","fr":"avis","ar":"تقييم"}'
    when 'team_member' then '{"en":"team account","fr":"compte d''équipe","ar":"حساب فريق"}'
    else jsonb_build_object('en', p_entity, 'fr', p_entity, 'ar', p_entity)::text
  end::jsonb;
$$;

-- ---------------------------------------------------------------------------
-- New orders
-- ---------------------------------------------------------------------------

-- Deferred to the end of the transaction, so create_order has inserted the lines too.
create or replace function private.notify_new_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  items integer;
  vals jsonb;
begin
  select coalesce(sum(quantity), 0) into items from public.order_items where order_id = new.id;
  vals := jsonb_build_object(
    'number', new.order_number,
    'name', trim(concat_ws(' ', new.customer_first_name, new.customer_last_name)),
    'city', coalesce(nullif(new.shipping_city, ''), nullif(new.shipping_state, ''), '—'),
    'total', trim(to_char(new.total, 'FM999999990.##')),
    'items', items
  );
  perform private.notify(
    private.notification_recipients('orders'),
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

create constraint trigger notify_new_order
  after insert on public.orders
  deferrable initially deferred
  for each row execute function private.notify_new_order();

-- ---------------------------------------------------------------------------
-- Owner alerts
-- ---------------------------------------------------------------------------

create or replace function private.owner_alerts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owners uuid[];
  who text := coalesce(nullif(new.actor_email, ''), 'Someone');
  what jsonb := private.entity_names(new.entity);
  item text := coalesce(nullif(new.label, ''), new.entity_id, '');
  url text := '/admin/activity?actor=' || coalesce(new.actor_id::text, '');
  vals jsonb;
  ch jsonb := coalesce(new.changes, '{}'::jsonb);
  old_price numeric;
  new_price numeric;
  pct numeric;
  qty integer;
  recent integer;
  existing bigint;
begin
  -- The owner's own actions, and direct database edits (migrations, SQL editor), don't alert.
  if new.source <> 'admin' or new.actor_role = 'owner' or new.actor_id is null then
    return null;
  end if;

  owners := private.notification_recipients('owner');
  if cardinality(owners) = 0 then
    return null;
  end if;

  vals := jsonb_build_object('who', who, 'item', item,
    'what_en', what->>'en', 'what_fr', what->>'fr', 'what_ar', what->>'ar');

  -- Deletes (soft): one alert per person every 10 minutes, counting further deletes into it.
  if new.action = 'delete' then
    select n.id into existing
      from public.notifications n
     where n.kind = 'security' and n.type = 'delete' and n.recipient_id = owners[1]
       and n.data->>'actor_id' = new.actor_id::text
       and n.created_at > now() - interval '10 minutes' and n.deleted_at is null
     order by n.created_at desc
     limit 1;

    if existing is not null then
      select count(*) into recent
        from public.activity_log a
       where a.actor_id = new.actor_id and a.action = 'delete' and a.created_at > now() - interval '10 minutes';
      update public.notifications n
         set title = private.i18n('{who} deleted {count} items', '{who} a supprimé {count} éléments', '{who} حذف {count} عناصر',
                                  vals || jsonb_build_object('count', recent)),
             body = private.i18n('Latest: {what_en} “{item}”', 'Dernier : {what_fr} « {item} »', 'آخرها: {what_ar} «{item}»', vals),
             data = n.data || jsonb_build_object('count', recent),
             read_at = null
       where n.kind = 'security' and n.type = 'delete' and n.recipient_id = any (owners)
         and n.data->>'actor_id' = new.actor_id::text
         and n.created_at > now() - interval '10 minutes' and n.deleted_at is null;

      -- Many deletes in a short time: a separate, critical alert (sent once per threshold).
      if recent in (10, 25, 50, 100, 250) then
        perform private.notify(owners, 'security', 'bulk_delete', 'critical',
          private.i18n('{who} deleted {count} items in 10 minutes', '{who} a supprimé {count} éléments en 10 minutes',
                       '{who} حذف {count} عنصراً خلال 10 دقائق', vals || jsonb_build_object('count', recent)),
          private.i18n('Check the activity history. Deleted items can be restored from Deleted items.',
                       'Vérifiez l''historique. Les éléments supprimés peuvent être restaurés depuis Éléments supprimés.',
                       'راجع سجل النشاط. يمكن استعادة العناصر المحذوفة من صفحة العناصر المحذوفة.', vals),
          url, jsonb_build_object('actor_id', new.actor_id, 'count', recent));
      end if;
      return null;
    end if;

    perform private.notify(owners, 'security', 'delete', 'warning',
      private.i18n('{who} deleted a {what_en}', '{who} a supprimé : {what_fr}', '{who} حذف {what_ar}', vals),
      private.i18n('“{item}”', '« {item} »', '«{item}»', vals),
      url, jsonb_build_object('actor_id', new.actor_id, 'entity', new.entity, 'entity_id', new.entity_id, 'count', 1));
    return null;
  end if;

  -- Permanent erase.
  if new.action = 'purge' then
    perform private.notify(owners, 'security', 'purge', 'critical',
      private.i18n('{who} permanently erased a {what_en}', '{who} a effacé définitivement : {what_fr}', '{who} حذف نهائياً {what_ar}', vals),
      private.i18n('“{item}” can no longer be restored.', '« {item} » ne peut plus être restauré.', 'لم يعد بالإمكان استعادة «{item}».', vals),
      url, jsonb_build_object('actor_id', new.actor_id, 'entity', new.entity, 'entity_id', new.entity_id));
    return null;
  end if;

  -- Blocked attempt (logged by middleware): once per person and target per hour.
  if new.action = 'access_denied' then
    if exists (
      select 1 from public.notifications n
       where n.kind = 'security' and n.type = 'access_denied' and n.recipient_id = owners[1]
         and n.data->>'actor_id' = new.actor_id::text and n.data->>'target' = item
         and n.created_at > now() - interval '1 hour'
    ) then
      return null;
    end if;
    perform private.notify(owners, 'security', 'access_denied', 'warning',
      private.i18n('{who} tried something they are not allowed to do', '{who} a tenté une action non autorisée', '{who} حاول القيام بعملية غير مسموح بها', vals),
      private.i18n('Blocked: {item}', 'Bloqué : {item}', 'تم الحظر: {item}', vals),
      url, jsonb_build_object('actor_id', new.actor_id, 'target', item));
    return null;
  end if;

  -- Team and access changes.
  if new.entity = 'team_member' then
    perform private.notify(owners, 'security', 'team_' || new.action,
      case when new.action in ('delete', 'remove_access') then 'warning' else 'info' end,
      case new.action
        when 'create' then private.i18n('{who} added {item} to the team', '{who} a ajouté {item} à l''équipe', '{who} أضاف {item} إلى الفريق', vals)
        when 'delete' then private.i18n('{who} deleted the account of {item}', '{who} a supprimé le compte de {item}', '{who} حذف حساب {item}', vals)
        when 'remove_access' then private.i18n('{who} removed the access of {item}', '{who} a retiré l''accès de {item}', '{who} أزال صلاحيات {item}', vals)
        else private.i18n('{who} changed the role or permissions of {item}', '{who} a modifié le rôle ou les permissions de {item}', '{who} غيّر دور أو صلاحيات {item}', vals)
      end,
      private.i18n('Role: {role}', 'Rôle : {role}', 'الدور: {role}',
        jsonb_build_object('role', coalesce(ch #>> '{role,to}', ch->>'role', '—'))),
      url, jsonb_build_object('actor_id', new.actor_id, 'member', new.entity_id));
    return null;
  end if;

  -- Price cut by half or more (product base price or a variant's own price).
  if new.action = 'update' and new.entity in ('products', 'product_variants') then
    begin
      old_price := coalesce(ch #>> '{base_price,from}', ch #>> '{price,from}')::numeric;
      new_price := coalesce(ch #>> '{base_price,to}', ch #>> '{price,to}')::numeric;
    exception when others then
      old_price := null;
    end;
    if old_price is not null and old_price > 0 and new_price is not null and new_price <= old_price * 0.5 then
      pct := round((1 - new_price / old_price) * 100);
      perform private.notify(owners, 'security', 'price_cut', 'warning',
        private.i18n('{who} cut a price by {pct}%', '{who} a baissé un prix de {pct} %', '{who} خفّض سعراً بنسبة {pct}%', vals || jsonb_build_object('pct', pct)),
        private.i18n('{item}: {from} → {to} TND', '{item} : {from} → {to} TND', '{item}: {from} ← {to} د.ت',
          vals || jsonb_build_object('from', old_price, 'to', new_price)),
        url, jsonb_build_object('actor_id', new.actor_id, 'entity', new.entity, 'entity_id', new.entity_id));
    end if;
    return null;
  end if;

  -- Discount of 50% or more.
  if new.entity = 'product_discounts' and new.action in ('create', 'update') then
    begin
      pct := coalesce(ch #>> '{discount_percent,to}', ch->>'discount_percent')::numeric;
    exception when others then
      pct := null;
    end;
    if pct is not null and pct >= 50 then
      select p.name into item
        from public.products p
       where p.id = coalesce(ch #>> '{product_id,to}', ch->>'product_id',
                             (select d.product_id::text from public.product_discounts d where d.id::text = new.entity_id))::uuid;
      perform private.notify(owners, 'security', 'big_discount', 'warning',
        private.i18n('{who} set a {pct}% discount', '{who} a mis une remise de {pct} %', '{who} وضع تخفيضاً بنسبة {pct}%', vals || jsonb_build_object('pct', pct)),
        private.i18n('{item}', '{item}', '{item}', jsonb_build_object('item', coalesce(item, '—'))),
        url, jsonb_build_object('actor_id', new.actor_id, 'entity_id', new.entity_id));
    end if;
    return null;
  end if;

  -- Large manual stock adjustment (20 units or more at once).
  if new.entity = 'stock_movements' and new.action = 'create' and ch->>'type' = 'adjustment' then
    begin
      qty := (ch->>'quantity')::integer;
    exception when others then
      qty := null;
    end;
    if qty is not null and abs(qty) >= 20 then
      perform private.notify(owners, 'security', 'stock_adjustment', 'warning',
        private.i18n('{who} adjusted stock by {qty}', '{who} a ajusté le stock de {qty}', '{who} عدّل المخزون بمقدار {qty}', vals || jsonb_build_object('qty', qty)),
        private.i18n('{item}', '{item}', '{item}', jsonb_build_object('item', coalesce(ch->>'product_name', ch->>'sku', item))),
        url, jsonb_build_object('actor_id', new.actor_id, 'entity_id', new.entity_id));
    end if;
    return null;
  end if;

  -- Cancelled or refunded orders.
  if new.entity = 'orders' and new.action = 'update' then
    if ch #>> '{payment_status,to}' = 'refunded' or ch #>> '{status,to}' = 'cancelled' then
      perform private.notify(owners, 'security',
        case when ch #>> '{payment_status,to}' = 'refunded' then 'order_refunded' else 'order_cancelled' end, 'info',
        case when ch #>> '{payment_status,to}' = 'refunded'
          then private.i18n('{who} marked order {item} refunded', '{who} a marqué la commande {item} remboursée', '{who} سجّل الطلب {item} كمسترد', vals)
          else private.i18n('{who} cancelled order {item}', '{who} a annulé la commande {item}', '{who} ألغى الطلب {item}', vals)
        end,
        null, '/admin/orders/' || new.entity_id, jsonb_build_object('actor_id', new.actor_id, 'order_id', new.entity_id));
    end if;
    return null;
  end if;

  -- Shop settings (prices, shipping, taxes, home page config).
  if new.entity in ('site_settings', 'shipping_rates', 'country_tax_rates') and new.action in ('create', 'update') then
    perform private.notify(owners, 'security', 'settings_change', 'info',
      private.i18n('{who} changed a {what_en}', '{who} a modifié : {what_fr}', '{who} غيّر {what_ar}', vals),
      private.i18n('“{item}”', '« {item} »', '«{item}»', vals),
      url, jsonb_build_object('actor_id', new.actor_id, 'entity', new.entity, 'entity_id', new.entity_id));
    return null;
  end if;

  -- Restores are worth knowing about too.
  if new.action = 'restore' then
    perform private.notify(owners, 'security', 'restore', 'info',
      private.i18n('{who} restored a {what_en}', '{who} a restauré : {what_fr}', '{who} استعاد {what_ar}', vals),
      private.i18n('“{item}”', '« {item} »', '«{item}»', vals),
      url, jsonb_build_object('actor_id', new.actor_id, 'entity', new.entity, 'entity_id', new.entity_id));
  end if;

  return null;
end;
$$;

revoke all on function private.owner_alerts() from public, anon, authenticated;

create trigger owner_alerts after insert on public.activity_log
  for each row execute function private.owner_alerts();

-- ---------------------------------------------------------------------------
-- Desktop delivery
-- ---------------------------------------------------------------------------

-- Hands each new notification to the send-push Edge Function. Its URL and shared secret
-- are Vault secrets (push_function_url, push_webhook_secret); without them nothing is sent
-- and the notification still shows in the admin.
create or replace function private.dispatch_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fn_url text;
  secret text;
begin
  select decrypted_secret into fn_url from vault.decrypted_secrets where name = 'push_function_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'push_webhook_secret';
  if fn_url is null or secret is null then
    return null;
  end if;
  if not exists (select 1 from public.push_subscriptions s where s.user_id = new.recipient_id and s.deleted_at is null) then
    return null;
  end if;
  perform net.http_post(
    url := fn_url,
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', secret),
    timeout_milliseconds := 10000
  );
  return null;
exception when others then
  -- Never let delivery problems block the change that caused the notification.
  raise warning 'dispatch_push failed: %', sqlerrm;
  return null;
end;
$$;

revoke all on function private.dispatch_push() from public, anon, authenticated;

create trigger dispatch_push after insert on public.notifications
  for each row execute function private.dispatch_push();
