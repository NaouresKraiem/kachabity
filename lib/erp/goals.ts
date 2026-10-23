import supabase from '@/lib/supabase-admin';
import { must } from '@/lib/erp/api';
import { listTeam } from '@/lib/erp/team';

export interface AgentGoal {
    id: string;
    user_id: string;
    month: string;
    target_orders: number | null;
    target_confirmed: number | null;
    target_delivered: number | null;
    target_revenue: number | null;
    commission_type: 'none' | 'percent' | 'per_order';
    commission_value: number;
}

export interface GoalProgress {
    user_id: string;
    email: string | null;
    role: string;
    goal: AgentGoal | null;
    created: number;
    confirmed: number;
    delivered: number;
    delivered_revenue: number;
    commission: number;
}

export interface BusinessGoal {
    id: string;
    month: string;
    target_revenue: number | null;
    target_orders: number | null;
    target_confirmed: number | null;
    target_delivered: number | null;
    target_gross_margin: number | null;
    max_return_rate: number | null;
    ad_budget: number | null;
    notes: string | null;
}

export interface TeamProgress {
    goal: BusinessGoal | null;
    created: number;
    confirmed: number;
    delivered: number;
    returned: number;
    delivered_revenue: number;
    gross_margin: number;
    ad_spend: number;
    return_rate: number | null;
    days_in_month: number;
    days_elapsed: number;
}

/** [start, end) of a month (YYYY-MM) in Tunis time (UTC+1, no daylight saving). */
export function monthRange(month: string) {
    const start = new Date(`${month}-01T00:00:00+01:00`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return { start, end };
}

/**
 * The whole business against its goal for a month: every order (website, agents, till), from
 * the same figures as the owner overview. days_elapsed lets the page show whether it's on pace.
 */
export async function teamProgress(month: string): Promise<TeamProgress> {
    const { start, end } = monthRange(month);
    const [goal, overview] = await Promise.all([
        supabase.from('business_goals').select('*').eq('month', `${month}-01`).is('deleted_at', null).maybeSingle(),
        supabase.rpc('owner_overview', { p_from: start.toISOString(), p_to: end.toISOString(), p_channel: null, p_agent: null, p_product: null, p_campaign: null }),
    ]);
    const data = must<{ orders: Record<string, number>; money: Record<string, number> }>(overview);
    const delivered = Number(data.orders.delivered);
    const returned = Number(data.orders.returned);
    const now = Date.now();
    const total = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    return {
        goal: must<BusinessGoal | null>(goal),
        created: Number(data.orders.created),
        confirmed: Number(data.orders.confirmed),
        delivered,
        returned,
        delivered_revenue: Number(data.money.delivered_revenue),
        gross_margin: Number(data.money.gross_margin),
        ad_spend: Number(data.money.ad_spend),
        return_rate: delivered + returned ? Math.round((returned / (delivered + returned)) * 1000) / 10 : null,
        days_in_month: total,
        days_elapsed: Math.max(0, Math.min(total, Math.ceil((now - start.getTime()) / 86_400_000))),
    };
}

/**
 * Each team member's objective and results for a month (YYYY-MM, Tunis time). Results count the
 * orders the agent handles (assigned, else entered): created, confirmed and delivered in the month.
 * Commission: % of delivered revenue, or an amount per delivered order.
 */
export async function monthProgress(month: string, onlyUser?: string): Promise<GoalProgress[]> {
    const { start, end } = monthRange(month);
    const since = start.toISOString();
    let ordersQuery = supabase.from('orders').select('assigned_to, created_by, created_at, confirmed_at, delivered_at, status, total')
        .is('deleted_at', null)
        .or(`created_at.gte.${since},confirmed_at.gte.${since},delivered_at.gte.${since}`);
    if (onlyUser) ordersQuery = ordersQuery.or(`assigned_to.eq.${onlyUser},and(assigned_to.is.null,created_by.eq.${onlyUser})`);
    const [team, goals, orders] = await Promise.all([
        listTeam(),
        supabase.from('agent_goals').select('*').eq('month', `${month}-01`).is('deleted_at', null),
        ordersQuery,
    ]);
    const goalRows = (must(goals) ?? []) as AgentGoal[];
    const orderRows = (must(orders) ?? []) as { assigned_to: string | null; created_by: string | null; created_at: string; confirmed_at: string | null; delivered_at: string | null; status: string; total: number }[];
    const inMonth = (d: string | null) => !!d && new Date(d) >= start && new Date(d) < end;
    return team
        .filter((member) => !onlyUser || member.user_id === onlyUser)
        .map((member) => {
            const mine = orderRows.filter((o) => (o.assigned_to ?? o.created_by) === member.user_id);
            const delivered = mine.filter((o) => o.status === 'delivered' && inMonth(o.delivered_at));
            const revenue = delivered.reduce((s, o) => s + Number(o.total), 0);
            const goal = goalRows.find((g) => g.user_id === member.user_id) ?? null;
            const commission = !goal ? 0
                : goal.commission_type === 'percent' ? Math.round(revenue * Number(goal.commission_value) * 10) / 1000
                : goal.commission_type === 'per_order' ? delivered.length * Number(goal.commission_value) : 0;
            return {
                user_id: member.user_id,
                email: member.email,
                role: member.role,
                goal,
                created: mine.filter((o) => inMonth(o.created_at)).length,
                confirmed: mine.filter((o) => inMonth(o.confirmed_at)).length,
                delivered: delivered.length,
                delivered_revenue: revenue,
                commission,
            };
        });
}
