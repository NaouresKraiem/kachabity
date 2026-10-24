import { z } from 'zod';
import supabase from '@/lib/supabase-admin';
import { HttpError, isManager, must, type Row, ok, params, readBody, route, zId, zMoney } from '@/lib/erp/api';
import { listSellable } from '@/lib/erp/catalog';
import { buildManualOrderLines, ManualLineError } from '@/lib/manual-order-lines';
import { generateOrderNumber } from '@/lib/order-number';
import { invalidateCatalog } from '@/lib/catalog-cache';

export const dynamic = 'force-dynamic';

/**
 * Point of sale (Admin → Point of sale). A till session is opened per shop location with a
 * starting float, sales are orders of channel "store" delivered on the spot (stock leaves the
 * shop's location, same products and rules as every channel), and closing compares the counted
 * cash with what should be there.
 */

const SESSION_SELECT = '*, location:locations(id, name)';

async function sessionSummary(sessionId: string) {
    const [session, orders, payments, movements, expected] = await Promise.all([
        supabase.from('pos_sessions').select(SESSION_SELECT).eq('id', sessionId).is('deleted_at', null).maybeSingle(),
        supabase.from('orders').select('id, order_number, total, discount_amount, created_at, customer_first_name, customer_last_name, status, items:order_items(product_name, variant_label, quantity, price)')
            .eq('pos_session_id', sessionId).is('deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('order_payments').select('amount, method, account').eq('pos_session_id', sessionId).is('deleted_at', null),
        supabase.from('treasury_movements').select('id, direction, amount, category, label, created_at, created_by_email').eq('pos_session_id', sessionId).is('deleted_at', null).order('created_at'),
        supabase.rpc('pos_expected_cash', { p_session_id: sessionId }),
    ]);
    const row = must(session);
    if (!row) throw new HttpError('This till session no longer exists.', 404);
    const byMethod: Record<string, number> = {};
    for (const p of must<Row[]>(payments) ?? []) byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount);
    const sales = must<Row[]>(orders) ?? [];
    return {
        session: row,
        sales,
        movements: must(movements),
        totals: {
            sales: sales.filter((o) => o.status === 'delivered').reduce((s, o) => s + Number(o.total), 0),
            count: sales.length,
            discounts: sales.reduce((s, o) => s + Number(o.discount_amount), 0),
            by_method: byMethod,
            expected_cash: Number(must(expected) ?? 0),
        },
    };
}

// GET ?catalog=1&location_id= — products with prices and stock at the shop.
// GET ?session_id= — one session (sales, cash in/out, totals).
// GET ?sessions=1 — session history. Otherwise: open sessions and shop locations.
export const GET = route('pos', async (request) => {
    const q = params(request);
    if (q.bool('catalog')) return ok(await listSellable(q.get('location_id')));
    // A till sale's receipt (items, payments and the shop's details).
    const receipt = q.get('receipt');
    if (receipt) {
        const [order, payments, settings] = await Promise.all([
            supabase.from('orders').select('id, order_number, created_at, subtotal, discount_amount, total, customer_first_name, customer_last_name, customer_phone, created_by_email, channel, pos_session:pos_sessions(number, location:locations(name)), items:order_items(product_name, variant_label, quantity, price, subtotal)')
                .eq('id', receipt).eq('channel', 'store').is('deleted_at', null).maybeSingle(),
            supabase.from('order_payments').select('amount, method').eq('order_id', receipt).is('deleted_at', null),
            supabase.from('erp_settings').select('value').eq('key', 'accounting').maybeSingle(),
        ]);
        const row = must(order);
        if (!row) throw new HttpError('This sale no longer exists.', 404);
        return ok({ ...row, payments: must(payments), company: (must(settings)?.value as { company?: unknown } | null)?.company ?? {} });
    }
    const sessionId = q.get('session_id');
    if (sessionId) return ok(await sessionSummary(sessionId));
    if (q.bool('sessions')) {
        return ok(must(await supabase.from('pos_sessions').select(SESSION_SELECT).is('deleted_at', null)
            .order('opened_at', { ascending: false }).limit(q.int('limit', 100, 500))));
    }
    const [open, locations, settings] = await Promise.all([
        supabase.from('pos_sessions').select(SESSION_SELECT).eq('status', 'open').is('deleted_at', null),
        supabase.from('locations').select('id, name, sells_online').is('deleted_at', null).order('name'),
        supabase.from('erp_settings').select('value').eq('key', 'pos').maybeSingle(),
    ]);
    return ok({ open_sessions: must(open), locations: must(locations), settings: must(settings)?.value ?? {} });
});

const saleSchema = z.object({
    action: z.literal('sale'),
    session_id: zId,
    items: z.array(z.object({ product_id: zId, variant_id: zId.nullish(), quantity: z.number().int().min(1).max(999) })).min(1).max(100),
    discount_amount: zMoney.default(0),
    customer: z.object({
        name: z.string().trim().max(150).default(''),
        phone: z.string().trim().regex(/^([24579]\d{7})?$/, 'Invalid Tunisian phone number').default(''),
    }).default({ name: '', phone: '' }),
    payments: z.array(z.object({
        method: z.enum(['cash', 'card', 'bank_transfer', 'check', 'mobile', 'other']),
        amount: z.number().positive().max(1_000_000),
        reference: z.string().trim().max(100).optional(),
    })).min(1).max(5),
    note: z.string().trim().max(500).optional(),
});

const bodySchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('open'), location_id: zId, opening_float: zMoney.default(0) }),
    saleSchema,
    z.object({ action: z.literal('cash'), session_id: zId, direction: z.enum(['in', 'out']), amount: z.number().positive().max(1_000_000), label: z.string().trim().min(1).max(200) }),
    z.object({ action: z.literal('close'), session_id: zId, counted_cash: zMoney, notes: z.string().trim().max(1000).optional() }),
]);

export const POST = route('pos', async (request, actor) => {
    const body = await readBody(request, bodySchema);

    if (body.action === 'open') {
        return ok(must(await supabase.rpc('open_pos_session', {
            p_location_id: body.location_id, p_opening_float: body.opening_float, p_actor: actor.userId, p_actor_email: actor.email,
        })), 201);
    }

    if (body.action === 'cash') {
        const session = must(await supabase.from('pos_sessions').select('status').eq('id', body.session_id).maybeSingle());
        if (session?.status !== 'open') throw new HttpError('This till session is closed. Open a new one.', 409);
        return ok(must(await supabase.from('treasury_movements').insert({
            account: 'cash', direction: body.direction, amount: body.amount, category: body.direction === 'in' ? 'other_income' : 'other_expense',
            label: body.label, pos_session_id: body.session_id, created_by: actor.userId, created_by_email: actor.email,
        }).select().single()), 201);
    }

    if (body.action === 'close') {
        const data = must(await supabase.rpc('close_pos_session', {
            p_session_id: body.session_id, p_counted: body.counted_cash, p_notes: body.notes ?? '', p_actor: actor.userId, p_actor_email: actor.email,
        }));
        return ok(data);
    }

    // A sale: lines priced from the catalog, discount within the allowed limit, payments covering the total.
    let lines;
    try {
        lines = await buildManualOrderLines(body.items);
    } catch (error) {
        if (error instanceof ManualLineError) throw new HttpError(error.message, 422, 'INVALID_ITEMS');
        throw error;
    }
    const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
    if (body.discount_amount > subtotal) throw new HttpError('The discount is larger than the sale.');
    if (body.discount_amount > 0 && !isManager(actor)) {
        const { data: pos } = await supabase.from('erp_settings').select('value').eq('key', 'pos').maybeSingle();
        const maxPercent = Number((pos?.value as { max_discount_percent?: number } | null)?.max_discount_percent ?? 10);
        if (body.discount_amount > (subtotal * maxPercent) / 100 + 0.0005) {
            throw new HttpError(`Discounts above ${maxPercent}% need an owner or admin.`, 403, 'DISCOUNT_LIMIT');
        }
    }
    const total = Math.round((subtotal - body.discount_amount) * 1000) / 1000;
    // Cash given beyond the total is change handed back: only what the sale costs is recorded.
    let remaining = total;
    const payments = body.payments.map((p) => {
        const amount = p.method === 'cash' ? Math.min(p.amount, Math.max(remaining, 0)) : p.amount;
        remaining -= amount;
        return { ...p, amount };
    }).filter((p) => p.amount > 0);
    if (remaining > 0.0005) throw new HttpError('The payments do not cover the total.', 409, 'PAYMENT_SHORT');
    if (remaining < -0.0005) throw new HttpError('Card and transfer payments cannot be more than the total.', 409);

    const [firstName, ...rest] = (body.customer.name || 'Walk-in customer').split(/\s+/);
    const result = must(await supabase.rpc('create_pos_sale', {
        p_session_id: body.session_id,
        p_order: {
            order_number: generateOrderNumber(),
            customer_first_name: firstName,
            customer_last_name: rest.join(' '),
            customer_phone: body.customer.phone,
            subtotal,
            shipping_cost: 0,
            total,
            discount_amount: body.discount_amount,
            order_notes: body.note ?? '',
        },
        p_items: lines,
        p_payments: payments,
        p_actor: actor.userId,
        p_actor_email: actor.email,
    })) as { order: { id: string; order_number: string; total: number } };
    invalidateCatalog();
    const tendered = body.payments.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0);
    const cashKept = payments.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0);
    return ok({ order: result.order, change: Math.max(0, Math.round((tendered - cashKept) * 1000) / 1000) }, 201);
});
