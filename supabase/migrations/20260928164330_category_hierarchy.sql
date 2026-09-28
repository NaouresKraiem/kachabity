-- Nested categories (e.g. Kachabia tunisienne > Kachabia longue > Kachabia laine).
-- A category page lists products from the category and all of its descendants.
alter table public.categories
  add column parent_id uuid references public.categories (id) on delete set null,
  add constraint categories_parent_not_self check (parent_id is null or parent_id <> id);

create index categories_parent_id_idx on public.categories (parent_id);
