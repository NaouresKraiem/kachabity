import supabase from '@/lib/supabase-admin';
import { must, ok, route } from '@/lib/erp/api';
import { monthProgress, teamProgress } from '@/lib/erp/goals';

export const dynamic = 'force-dynamic';

/**
 * An agent's day (any back-office user, about themselves): their orders to confirm and in
 * delivery, orders nobody handles yet, follow-ups due, unread customer messages, and this
 * month's results against their objective.
 */
export const GET = route('my-work', async (_request, actor) => {
    const me = actor.userId!;
    const can = (p: string) => actor.role === 'owner' || actor.role === 'admin' || actor.permissions.includes(p as never);
    const month = new Date().toISOString().slice(0, 7);
    const orderSelect = 'id, order_number, status, total, channel, created_at, customer_first_name, customer_last_name, customer_phone, shipping_city, customer_id';

    const [toConfirm, inDelivery, unassigned, tasks, unread, progress] = await Promise.all([
        can('orders')
            ? supabase.from('orders').select(orderSelect).is('deleted_at', null).in('status', ['pending', 'confirmed'])
                .or(`assigned_to.eq.${me},and(assigned_to.is.null,created_by.eq.${me})`).order('created_at').limit(100)
            : Promise.resolve({ data: [], error: null }),
        can('orders')
            ? supabase.from('orders').select(orderSelect).is('deleted_at', null).in('status', ['processing', 'shipped'])
                .eq('assigned_to', me).order('created_at').limit(100)
            : Promise.resolve({ data: [], error: null }),
        can('orders')
            ? supabase.from('orders').select('id', { count: 'exact', head: true }).is('deleted_at', null).in('status', ['pending', 'confirmed'])
                .is('assigned_to', null).is('created_by', null)
            : Promise.resolve({ count: 0, error: null }),
        can('customers')
            ? supabase.from('crm_tasks').select('*, customer:customers(id, full_name, phone), order:orders(id, order_number)')
                .eq('assigned_to', me).is('done_at', null).is('deleted_at', null).order('due_at').limit(100)
            : Promise.resolve({ data: [], error: null }),
        can('customers')
            ? supabase.from('customer_interactions').select('customer_id, customer:customers!inner(assigned_to)', { count: 'exact', head: false })
                .eq('direction', 'in').is('read_at', null).is('deleted_at', null).eq('customer.assigned_to', me).limit(500)
            : Promise.resolve({ data: [], error: null }),
        monthProgress(month, me),
    ]);
    // The business's goal for the month, so agents see what the team is aiming for.
    const team = await teamProgress(month);

    return ok({
        to_confirm: must(toConfirm as { data: unknown; error: unknown }),
        in_delivery: must(inDelivery as { data: unknown; error: unknown }),
        unassigned_count: (unassigned as { count: number | null }).count ?? 0,
        tasks: must(tasks as { data: unknown; error: unknown }),
        unread_customers: new Set(((must(unread as { data: unknown; error: unknown }) ?? []) as { customer_id: string }[]).map((r) => r.customer_id)).size,
        month: progress[0] ?? null,
        team: team.goal ? { goal: team.goal, delivered_revenue: team.delivered_revenue, delivered: team.delivered, created: team.created, confirmed: team.confirmed, days_elapsed: team.days_elapsed, days_in_month: team.days_in_month } : null,
    });
});
