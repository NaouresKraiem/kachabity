import { z } from 'zod';
import supabase from '@/lib/supabase-admin';
import { HttpError, must, ok, params, readBody, route, zId } from '@/lib/erp/api';
import { MONEY_ACCOUNTS, PAYMENT_METHODS } from '@/lib/erp/constants';

export const dynamic = 'force-dynamic';

/**
 * Money received for orders (Finance → Payments). An order can be delivered and not paid yet:
 * each payment is its own row, and the order's paid amount and payment status follow them.
 * `account` says where the money is now: the till, the bank, or still with the delivery company.
 */

const SELECT = 'id, order_id, amount, method, account, received_at, reference, note, remittance_id, pos_session_id, created_by_email, created_at, order:orders(order_number, customer_first_name, customer_last_name, total, paid_amount, status, channel)';

// GET ?order_id= (one order's payments) or the list: ?account=&method=&from=&to=&open_carrier=1&limit=
export const GET = route('sales-payments', async (request) => {
    const q = params(request);
    let query = supabase.from('order_payments').select(SELECT).is('deleted_at', null).order('received_at', { ascending: false });
    const orderId = q.get('order_id');
    if (orderId) query = query.eq('order_id', orderId);
    else {
        if (q.get('account')) query = query.eq('account', q.get('account')!);
        if (q.get('method')) query = query.eq('method', q.get('method')!);
        if (q.get('from')) query = query.gte('received_at', q.get('from')!);
        if (q.get('to')) query = query.lt('received_at', q.get('to')!);
        if (q.bool('open_carrier')) query = query.eq('account', 'carrier').is('remittance_id', null);
        query = query.limit(q.int('limit', 300, 2000));
    }
    return ok(must(await query));
});

const createSchema = z.object({
    order_id: zId,
    // Negative: a refund.
    amount: z.number().finite().refine((v) => v !== 0, 'Amount cannot be zero').refine((v) => Math.abs(v) <= 1_000_000, 'Amount too large'),
    method: z.enum(PAYMENT_METHODS),
    account: z.enum(MONEY_ACCOUNTS).optional(),
    received_at: z.string().datetime({ offset: true }).optional(),
    reference: z.string().trim().max(200).optional(),
    note: z.string().trim().max(500).optional(),
});

// The usual account for a method: cash in the till, cash on delivery with the carrier, the rest in the bank.
const defaultAccount = (method: string) => (method === 'cash' ? 'cash' : method === 'cod' ? 'carrier' : 'bank');

export const POST = route('sales-payments', async (request, actor) => {
    const body = await readBody(request, createSchema);
    const order = must(await supabase.from('orders').select('id, total, paid_amount, status').eq('id', body.order_id).is('deleted_at', null).maybeSingle());
    if (!order) throw new HttpError('Order not found', 404);
    if (body.amount > 0 && Number(order.paid_amount) + body.amount > Number(order.total) + 0.0005) {
        throw new HttpError('This payment is more than what the order still owes.', 409, 'OVERPAID');
    }
    const data = must(await supabase.from('order_payments').insert({
        order_id: body.order_id,
        amount: body.amount,
        method: body.method,
        account: body.account ?? defaultAccount(body.method),
        received_at: body.received_at ?? new Date().toISOString(),
        reference: body.reference || null,
        note: body.note || null,
        created_by: actor.userId,
        created_by_email: actor.email,
    }).select(SELECT).single());
    return ok(data, 201);
});

// DELETE ?id= — a payment recorded by mistake (its accounting entry is reversed).
export const DELETE = route('sales-payments', async (request) => {
    const id = params(request).get('id');
    if (!id) throw new HttpError('Missing id');
    const payment = must(await supabase.from('order_payments').select('id, remittance_id, pos_session_id').eq('id', id).is('deleted_at', null).maybeSingle());
    if (!payment) throw new HttpError('This payment no longer exists.', 404);
    if (payment.remittance_id) throw new HttpError('This payment is part of a carrier payout. Cancel the payout first.', 409);
    must(await supabase.from('order_payments').update({ deleted_at: new Date().toISOString() }).eq('id', id));
    return ok({ id });
});
