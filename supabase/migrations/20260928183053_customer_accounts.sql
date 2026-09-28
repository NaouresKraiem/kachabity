-- Customer accounts: email/password sign-up on the storefront.
--
--   * Every auth user gets a public.users profile row (name + avatar only; the table
--     is publicly readable, so it never holds the email). The row is kept in sync
--     from the user's metadata by a trigger, so the browser never writes it.
--   * Reviews now require a signed-in customer, posting as themselves.

-- ---------------------------------------------------------------------------
-- Profile sync
-- ---------------------------------------------------------------------------

create or replace function private.sync_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, name, avatar_url)
  values (
    new.id,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), 100), ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do update
    set name = excluded.name,
        avatar_url = excluded.avatar_url;
  return new;
end;
$$;

revoke all on function private.sync_user_profile() from public, anon, authenticated;

create trigger sync_user_profile_on_insert
  after insert on auth.users
  for each row execute function private.sync_user_profile();

create trigger sync_user_profile_on_update
  after update of raw_user_meta_data on auth.users
  for each row
  when (old.raw_user_meta_data is distinct from new.raw_user_meta_data)
  execute function private.sync_user_profile();

-- Accounts created before this migration (the admins).
insert into public.users (id, name, avatar_url)
select
  u.id,
  nullif(left(trim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')), 100), ''),
  nullif(u.raw_user_meta_data ->> 'avatar_url', '')
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Reviews: signed-in customers only
-- ---------------------------------------------------------------------------

drop policy "Anyone can post a review as themselves" on public.reviews;

create policy "Customers can post a review as themselves" on public.reviews
  for insert to authenticated
  with check (user_id = (select auth.uid()));

revoke insert on public.reviews from anon;
