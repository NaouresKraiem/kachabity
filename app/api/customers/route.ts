import { z } from 'zod';
import supabase from '@/lib/supabase-admin';
import { HttpError, isManager, must, type Row, ok, params, readBody, route, zId } from '@/lib/erp/api';
import { CHANNELS, CUSTOMER_STAGES } from '@/lib/erp/constants';
import { memberEmail } from '@/lib/erp/team';

export const dynamic = 'force-dynamic';

/**
 * Customers (CRM). One record per phone number, created automatically from orders (website,
 * agents, till) and by hand for contacts who haven't ordered yet. Personal data: only staff with
 * the customers permission manage records; orders and the till can look one up by phone.
 */

const LIST_SELECT = 'id, phone, phone_alt, full_name, email, governorate, city, channel, stage, assigned_to, assigned_to_email, tags, created_at, updated_at, anonymized_at';

// GET ?id= (record with orders, conversations, follow-ups) | ?duplicates=1 | list: ?q=&stage=&channel=&assigned=me|none|<id>&page=&size=
export const GET = route('customers', async (request, actor) => {
    const q = params(request);
    const id = q.get('id');
    if (id) {
        const [customer, orders, interactions, tasks] = await Promise.all([
            supabase.from('customers').select('*').eq('id', id).is('deleted_at', null).maybeSingle(),
            supabase.from('orders').select('id, order_number, status, payment_status, total, paid_amount, channel, created_at, delivered_at, assigned_to_email, items:order_items(product_name, variant_label, quantity)')
                .eq('customer_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
            supabase.from('customer_interactions').select('*').eq('customer_id', id).is('deleted_at', null).order('created_at', { ascending: false }).limit(300),
            supabase.from('crm_tasks').select('*').eq('customer_id', id).is('deleted_at', null).order('due_at'),
        ]);
        const record = must(customer);
        if (!record) throw new HttpError('This customer no longer exists.', 404);
        const list = must<Row[]>(orders) ?? [];
        const finished = list.filter((o) => ['delivered', 'returned'].includes(o.status));
        return ok({
            customer: record,
            orders: list,
            interactions: must(interactions),
            tasks: must(tasks),
            stats: {
                orders: list.length,
                delivered: list.filter((o) => o.status === 'delivered').length,
                returned: list.filter((o) => o.status === 'returned').length,
                spent: list.filter((o) => o.status === 'delivered').reduce((sum, o) => sum + Number(o.total), 0),
                delivery_rate: finished.length ? Math.round((list.filter((o) => o.status === 'delivered').length / finished.length) * 100) : null,
            },
        });
    }

    if (q.bool('duplicates')) {
        const pairs = must(await supabase.rpc('find_customer_duplicates')) as { customer_id: string; duplicate_id: string; reason: string }[];
        const ids = [...new Set(pairs.flatMap((p) => [p.customer_id, p.duplicate_id]))];
        const people = ids.length ? must<Row[]>(await supabase.from('customers').select(LIST_SELECT).in('id', ids)) : [];
        const byId = new Map(people.map((p) => [p.id, p]));
        return ok(pairs.map((p) => ({ reason: p.reason, a: byId.get(p.customer_id), b: byId.get(p.duplicate_id) })));
    }

    const page = q.int('page', 1, 10_000);
    const size = q.int('size', 50, 200);
    let query = supabase.from('customers').select(LIST_SELECT, { count: 'exact' }).is('deleted_at', null);
    const term = q.get('q');
    if (term) {
        const digits = term.replace(/\D/g, '');
        const safe = term.replace(/[%,()]/g, ' ');
        query = query.or([`full_name.ilike.%${safe}%`, `email.ilike.%${safe}%`, `city.ilike.%${safe}%`, ...(digits.length >= 3 ? [`phone.ilike.%${digits}%`, `phone_alt.ilike.%${digits}%`] : [])].join(','));
    }
    if (q.get('stage')) query = query.eq('stage', q.get('stage')!);
    if (q.get('channel')) query = query.eq('channel', q.get('channel')!);
    const assigned = q.get('assigned');
    if (assigned === 'me') query = query.eq('assigned_to', actor.userId!);
    else if (assigned === 'none') query = query.is('assigned_to', null);
    else if (assigned) query = query.eq('assigned_to', assigned);
    const { data, count, error } = await query.order('updated_at', { ascending: false }).range((page - 1) * size, page * size - 1);
    if (error) throw error;

    // Pipeline counts for the stage tabs.
    const stageCounts = Object.fromEntries(await Promise.all(CUSTOMER_STAGES.map(async (stage) => {
        const { count: n } = await supabase.from('customers').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('stage', stage);
        return [stage, n ?? 0];
    })));
    return ok({ rows: data ?? [], total: count ?? 0, page, size, stages: stageCounts });
});

const fields = {
    phone: z.string().trim().regex(/^\+?[\d\s.-]{8,20}$/, 'Invalid phone number').nullable(),
    phone_alt: z.string().trim().regex(/^\+?[\d\s.-]{8,20}$/, 'Invalid phone number').nullable().or(z.literal('')),
    full_name: z.string().trim().min(1).max(150),
    email: z.string().trim().email().nullable().or(z.literal('')),
    governorate: z.string().trim().max(60).nullable(),
    city: z.string().trim().max(100).nullable(),
    address: z.string().trim().max(250).nullable(),
    channel: z.enum(CHANNELS),
    stage: z.enum(CUSTOMER_STAGES),
    tags: z.array(z.string().trim().min(1).max(40)).max(20),
    notes: z.string().trim().max(5000).nullable(),
    assigned_to: zId.nullable(),
};

const createSchema = z.object(fields).partial().required({ full_name: true });
const updateSchema = z.object({ id: zId, ...fields }).partial().required({ id: true });

async function normalized(phone: string | null | undefined) {
    if (!phone) return null;
    const value = must(await supabase.rpc('normalize_phone', { p_phone: phone })) as string | null;
    return value;
}

async function rowFrom(body: Partial<z.infer<typeof updateSchema>>) {
    const row: Record<string, unknown> = { ...body };
    delete row.id;
    if ('phone' in body) row.phone = await normalized(body.phone);
    if ('phone_alt' in body) row.phone_alt = await normalized(body.phone_alt || null);
    if ('email' in body) row.email = body.email || null;
    if ('assigned_to' in body) row.assigned_to_email = body.assigned_to ? await memberEmail(body.assigned_to) : null;
    return row;
}

async function phoneTaken(phone: unknown, exceptId?: string) {
    if (!phone) return null;
    let query = supabase.from('customers').select('id, full_name').eq('phone', phone as string).is('deleted_at', null);
    if (exceptId) query = query.neq('id', exceptId);
    return must(await query.maybeSingle());
}

export const POST = route('customers', async (request, actor) => {
    const body = await readBody(request, createSchema);
    const row = await rowFrom(body);
    const existing = await phoneTaken(row.phone);
    if (existing) throw new HttpError(`This phone already belongs to ${existing.full_name || 'another customer'}.`, 409, 'DUPLICATE_PHONE');
    const data = must(await supabase.from('customers').insert({
        channel: 'phone',
        ...row,
        assigned_to: row.assigned_to === undefined ? actor.userId : row.assigned_to,
        assigned_to_email: row.assigned_to === undefined ? actor.email : row.assigned_to_email,
        created_by: actor.userId,
        created_by_email: actor.email,
    }).select().single());
    return ok(data, 201);
});

export const PUT = route('customers', async (request) => {
    const body = await readBody(request, updateSchema);
    const row = await rowFrom(body);
    const existing = await phoneTaken(row.phone, body.id);
    if (existing) throw new HttpError(`This phone already belongs to ${existing.full_name || 'another customer'}.`, 409, 'DUPLICATE_PHONE');
    const data = must(await supabase.from('customers').update(row).eq('id', body.id).is('deleted_at', null).select().single());
    return ok(data);
});

const actionSchema = z.discriminatedUnion('action', [
    // Same person twice: keep one record, move the other's orders and conversations onto it.
    z.object({ action: z.literal('merge'), keep_id: zId, remove_id: zId }),
    // Erase personal data on request (orders keep their amounts).
    z.object({ action: z.literal('anonymize'), id: zId }),
    z.object({ action: z.literal('assign'), ids: z.array(zId).min(1).max(500), user_id: zId.nullable() }),
]);

export const PATCH = route('customers', async (request, actor) => {
    const body = await readBody(request, actionSchema);
    if (body.action === 'merge') {
        if (!isManager(actor) && !actor.permissions.includes('delete')) throw new HttpError('Merging needs the delete permission.', 403);
        return ok(must(await supabase.rpc('merge_customers', { p_keep: body.keep_id, p_remove: body.remove_id })));
    }
    if (body.action === 'anonymize') {
        if (!isManager(actor)) throw new HttpError('Only owners and admins can erase personal data.', 403);
        must(await supabase.rpc('anonymize_customer', { p_id: body.id }));
        return ok({ id: body.id });
    }
    const email = body.user_id ? await memberEmail(body.user_id) : null;
    if (body.user_id && !email) throw new HttpError('This agent is not on the team.');
    must(await supabase.from('customers').update({ assigned_to: body.user_id, assigned_to_email: email }).in('id', body.ids));
    return ok({ changed: body.ids.length });
});

// DELETE ?id= — removes a customer record (their orders stay).
export const DELETE = route('customers', async (request) => {
    const id = params(request).get('id');
    if (!id) throw new HttpError('Missing id');
    must(await supabase.from('customers').update({ deleted_at: new Date().toISOString() }).eq('id', id));
    return ok({ id });
});
