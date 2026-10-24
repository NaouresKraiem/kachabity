import { z } from 'zod';
import supabase from '@/lib/supabase-admin';
import { HttpError, must, ok, params, readBody, route, zId } from '@/lib/erp/api';
import { memberEmail } from '@/lib/erp/team';

export const dynamic = 'force-dynamic';

/** Follow-ups and reminders (call back, send photos, confirm an order...), each with a due date and an agent. */

const SELECT = '*, customer:customers(id, full_name, phone, stage), order:orders(id, order_number, status)';

// GET ?customer_id= | ?mine=1 | ?status=open|done|overdue&assigned=<id>
export const GET = route('crm-tasks', async (request, actor) => {
    const q = params(request);
    let query = supabase.from('crm_tasks').select(SELECT).is('deleted_at', null);
    if (q.get('customer_id')) query = query.eq('customer_id', q.get('customer_id')!);
    if (q.bool('mine')) query = query.eq('assigned_to', actor.userId!);
    else if (q.get('assigned')) query = query.eq('assigned_to', q.get('assigned')!);
    const status = q.get('status');
    if (status === 'open') query = query.is('done_at', null);
    if (status === 'done') query = query.not('done_at', 'is', null);
    if (status === 'overdue') query = query.is('done_at', null).lt('due_at', new Date().toISOString());
    return ok(must(await query.order('due_at').limit(q.int('limit', 300, 1000))));
});

const createSchema = z.object({
    title: z.string().trim().min(1).max(200),
    notes: z.string().trim().max(2000).optional(),
    due_at: z.string().datetime({ offset: true }),
    customer_id: zId.nullish(),
    order_id: zId.nullish(),
    assigned_to: zId.nullish(),
});

export const POST = route('crm-tasks', async (request, actor) => {
    const body = await readBody(request, createSchema);
    const assignee = body.assigned_to === undefined ? actor.userId : body.assigned_to;
    const email = assignee ? (assignee === actor.userId ? actor.email : await memberEmail(assignee)) : null;
    const data = must(await supabase.from('crm_tasks').insert({
        title: body.title,
        notes: body.notes || null,
        due_at: body.due_at,
        customer_id: body.customer_id ?? null,
        order_id: body.order_id ?? null,
        assigned_to: assignee,
        assigned_to_email: email,
        created_by: actor.userId,
        created_by_email: actor.email,
    }).select(SELECT).single());
    return ok(data, 201);
});

const updateSchema = z.object({
    id: zId,
    done: z.boolean().optional(),
    title: z.string().trim().min(1).max(200).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    due_at: z.string().datetime({ offset: true }).optional(),
    assigned_to: zId.nullable().optional(),
});

export const PUT = route('crm-tasks', async (request, actor) => {
    const body = await readBody(request, updateSchema);
    const row: Record<string, unknown> = {};
    if (body.done !== undefined) {
        row.done_at = body.done ? new Date().toISOString() : null;
        row.done_by = body.done ? actor.userId : null;
    }
    if (body.title !== undefined) row.title = body.title;
    if (body.notes !== undefined) row.notes = body.notes;
    if (body.due_at !== undefined) row.due_at = body.due_at;
    if (body.assigned_to !== undefined) {
        row.assigned_to = body.assigned_to;
        row.assigned_to_email = body.assigned_to ? await memberEmail(body.assigned_to) : null;
    }
    const data = must(await supabase.from('crm_tasks').update(row).eq('id', body.id).is('deleted_at', null).select(SELECT).single());
    return ok(data);
});

export const DELETE = route('crm-tasks', async (request) => {
    const id = params(request).get('id');
    if (!id) throw new HttpError('Missing id');
    must(await supabase.from('crm_tasks').update({ deleted_at: new Date().toISOString() }).eq('id', id));
    return ok({ id });
});
