-- Product search (header suggestions and the products page).
--
-- Each product keeps two normalized texts, maintained by a trigger: search_name (its names
-- in en/fr/ar) and search_text (names, descriptions, code, and its category and parent
-- category names in all languages). Normalized means lower case, accents removed (é = e),
-- Arabic diacritics and tatweel removed, and Arabic letter variants unified (أ إ آ ٱ → ا,
-- ة → ه, ى → ي, ؤ → و, ئ → ي), so a search matches however the word was typed.
--
-- public.search_products(query) returns live products ranked by relevance: every word must
-- appear (in any order, anywhere in the text); a match in the name ranks above one in the
-- description. If no product contains all the words, it falls back to similar spellings
-- (pg_trgm word similarity), so small typos still find something.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create or replace function public.normalize_search_text(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select trim(regexp_replace(
    translate(
      regexp_replace(
        lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_text, ''))),
        '[ً-ٰٟـ]', '', 'g'
      ),
      'أإآٱةىؤئ', 'ااااهيوي'
    ),
    '[[:space:][:punct:]«»،؛؟“”‘’…–—]+', ' ', 'g'
  ));
$$;

grant execute on function public.normalize_search_text(text) to anon, authenticated, service_role;

alter table public.products
  add column search_name text not null default '',
  add column search_text text not null default '';

create or replace function private.set_product_search()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  category_words text := '';
begin
  select concat_ws(' ', c.name, c.name_ar, c.name_fr, parent.name, parent.name_ar, parent.name_fr)
    into category_words
    from public.categories c
    left join public.categories parent on parent.id = c.parent_id
   where c.id = new.category_id;

  new.search_name := public.normalize_search_text(concat_ws(' ', new.name, new.name_ar, new.name_fr));
  new.search_text := public.normalize_search_text(concat_ws(' ',
    new.name, new.name_ar, new.name_fr, new.code,
    new.description, new.description_ar, new.description_fr,
    category_words
  ));
  return new;
end;
$$;

create trigger set_product_search
  before insert or update of name, name_ar, name_fr, code, description, description_ar, description_fr, category_id
  on public.products
  for each row execute function private.set_product_search();

-- A renamed or moved category refreshes the search text of its products (and of its
-- subcategories' products, which carry the parent's name too).
create or replace function private.refresh_category_search()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.products p
     set category_id = p.category_id
   where p.category_id = new.id
      or p.category_id in (select c.id from public.categories c where c.parent_id = new.id);
  return null;
end;
$$;

create trigger refresh_category_search
  after update of name, name_ar, name_fr, parent_id on public.categories
  for each row execute function private.refresh_category_search();

-- Fill the new columns for existing products (the trigger fires on the category_id update).
-- (Without touching updated_at or writing 59 history lines.)
alter table public.products disable trigger log_activity;
alter table public.products disable trigger set_updated_at;
update public.products set category_id = category_id;
alter table public.products enable trigger set_updated_at;
alter table public.products enable trigger log_activity;

create index products_search_text_trgm_idx on public.products
  using gin (search_text extensions.gin_trgm_ops)
  where deleted_at is null;

-- Ranked ids of the live products matching p_query (most relevant first).
create or replace function public.search_products(p_query text, p_limit integer default 200)
returns table (product_id uuid, rank real)
language sql
stable
set search_path = ''
as $$
  with q as (
    select public.normalize_search_text(p_query) as phrase
  ),
  words as (
    select distinct w
      from q, regexp_split_to_table(q.phrase, ' ') as w
     where length(w) >= 2 or (length(w) = 1 and w ~ '[0-9]')
  ),
  word_count as (
    select count(*) as n from words
  ),
  live as (
    select p.id, p.search_name, p.search_text, p.sold_count
      from public.products p
     where p.deleted_at is null and p.status = 'active'
  ),
  scored as (
    select l.id,
           count(*) filter (where position(w in l.search_text) > 0) as exact_hits,
           count(*) filter (where position(w in l.search_text) > 0
                               or extensions.word_similarity(w, l.search_text) >= 0.5) as fuzzy_hits,
           sum(case
                 when position(w in l.search_name) > 0 then 3
                 when position(w in l.search_text) > 0 then 1
                 else extensions.word_similarity(w, l.search_text)
               end) as score,
           max(l.sold_count) as sold_count,
           bool_or(position(q.phrase in l.search_name) > 0) as phrase_in_name
      from live l
      cross join words
      cross join q
     group by l.id
  ),
  exact as (
    select s.* from scored s, word_count wc where s.exact_hits = wc.n
  ),
  matched as (
    select * from exact
    union all
    select s.* from scored s, word_count wc
     where s.fuzzy_hits = wc.n and not exists (select 1 from exact)
  )
  select m.id,
         (m.score + case when m.phrase_in_name then 5 else 0 end + least(m.sold_count, 100) / 1000.0)::real
    from matched m
   order by 2 desc
   limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;

grant execute on function public.search_products(text, integer) to anon, authenticated, service_role;

-- The activity log ignores the derived search columns (same function as before otherwise).
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
       and n.key not in ('updated_at', 'search_text', 'search_name');
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
