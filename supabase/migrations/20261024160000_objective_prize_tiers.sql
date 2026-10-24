-- Objectives & commissions: prizes by number of delivered orders, and a start date for analytics.

-- 1. A new commission type, 'tiers': prizes for reaching numbers of delivered orders in the month,
--    e.g. [{"orders": 50, "prize": 100}, {"orders": 80, "prize": 200}]. The agent earns the prize of
--    the highest tier reached (lib/erp/objectives.ts).
alter table public.agent_goals
  add column if not exists prize_tiers jsonb not null default '[]'::jsonb
    check (jsonb_typeof(prize_tiers) = 'array');

alter table public.agent_goals drop constraint if exists agent_goals_commission_type_check;
alter table public.agent_goals add constraint agent_goals_commission_type_check
  check (commission_type in ('none', 'percent', 'per_order', 'tiers'));

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
                                  commission_type, commission_value, prize_tiers, created_by, created_by_email)
  select p_user, p_user_email, m, nullif(p_goal->>'target_orders', '')::integer, nullif(p_goal->>'target_confirmed', '')::integer,
         nullif(p_goal->>'target_delivered', '')::integer, nullif(p_goal->>'target_revenue', '')::numeric,
         coalesce(nullif(p_goal->>'commission_type', ''), 'none'), coalesce(nullif(p_goal->>'commission_value', '')::numeric, 0),
         case when jsonb_typeof(p_goal->'prize_tiers') = 'array' then p_goal->'prize_tiers' else '[]'::jsonb end,
         p_actor, p_actor_email
    from unnest(p_months) as m
  returning *;
end;
$$;

-- 2. Analytics start date: the owner can "reset" the numbers (Business overview, Agent performance,
--    Objectives, My day) to count only from a date. Nothing is deleted; clearing it shows everything.
insert into public.erp_settings (key, value) values ('analytics', '{"start_date": null}'::jsonb)
on conflict (key) do nothing;
