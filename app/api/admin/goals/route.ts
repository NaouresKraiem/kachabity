import { z } from 'zod';
import supabase from '@/lib/supabase-admin';
import { HttpError, must, ok, params, readBody, route, zId } from '@/lib/erp/api';
import { listTeam } from '@/lib/erp/team';
import { monthProgress, teamProgress } from '@/lib/erp/goals';

export const dynamic = 'force-dynamic';

/**
 * Monthly goals (owners and admins): the business's goal for the month (business_goals) and each
 * agent's objective and commission (agent_goals), with progress.
 */

// GET ?month=YYYY-MM (default: this month)
export const GET = route('admin-goals', async (request) => {
    const month = params(request).get('month') ?? new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError('Invalid month');
    const [rows, team] = await Promise.all([monthProgress(month), teamProgress(month)]);
    return ok({ month, rows, team });
});

const goalSchema = z.object({
    user_id: zId,
    month: z.string().regex(/^\d{4}-\d{2}$/),
    target_orders: z.number().int().min(0).nullable().optional(),
    target_confirmed: z.number().int().min(0).nullable().optional(),
    target_delivered: z.number().int().min(0).nullable().optional(),
    target_revenue: z.number().min(0).nullable().optional(),
    commission_type: z.enum(['none', 'percent', 'per_order']).default('none'),
    commission_value: z.number().min(0).max(1_000_000).default(0),
    // Copy to the following months too (same objective for the quarter, for example).
    repeat_months: z.number().int().min(0).max(11).default(0),
});

// POST — sets an agent's objective for a month (replacing the previous one).
export const POST = route('admin-goals', async (request, actor) => {
    const body = await readBody(request, goalSchema);
    const member = (await listTeam()).find((m) => m.user_id === body.user_id);
    if (!member) throw new HttpError('This person is not on the team.');
    const { repeat_months, month, user_id, ...goal } = body;
    const months = Array.from({ length: repeat_months + 1 }, (_, i) => {
        const d = new Date(`${month}-01T00:00:00Z`);
        d.setUTCMonth(d.getUTCMonth() + i);
        return d.toISOString().slice(0, 10);
    });
    return ok(must(await supabase.rpc('set_agent_goal', {
        p_user: user_id, p_user_email: member.email, p_months: months, p_goal: goal, p_actor: actor.userId, p_actor_email: actor.email,
    })), 201);
});

export const DELETE = route('admin-goals', async (request) => {
    const q = params(request);
    const businessId = q.get('business_id');
    if (businessId) {
        must(await supabase.from('business_goals').update({ deleted_at: new Date().toISOString() }).eq('id', businessId));
        return ok({ id: businessId });
    }
    const id = q.get('id');
    if (!id) throw new HttpError('Missing id');
    must(await supabase.from('agent_goals').update({ deleted_at: new Date().toISOString() }).eq('id', id));
    return ok({ id });
});

const teamSchema = z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    target_revenue: z.number().min(0).nullable().optional(),
    target_orders: z.number().int().min(0).nullable().optional(),
    target_confirmed: z.number().int().min(0).nullable().optional(),
    target_delivered: z.number().int().min(0).nullable().optional(),
    target_gross_margin: z.number().min(0).nullable().optional(),
    max_return_rate: z.number().min(0).max(100).nullable().optional(),
    ad_budget: z.number().min(0).nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
});

// PUT — sets the business's goal for a month (replaces it).
export const PUT = route('admin-goals', async (request, actor) => {
    const { month, ...goal } = await readBody(request, teamSchema);
    return ok(must(await supabase.from('business_goals').upsert({
        ...goal, month: `${month}-01`, deleted_at: null, created_by: actor.userId, created_by_email: actor.email,
    }, { onConflict: 'month' }).select().single()));
});
